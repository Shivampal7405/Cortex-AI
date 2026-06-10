/**
 * llm.rebuilder.ts
 * Merges LLM-extracted MemoryJSON into existing storage.
 * Active rebuild: gathers all provider histories and rebuilds from scratch.
 */

import type { MemoryJSON, MemoryJSONProject } from './memory.types'
import { extractWithLLM, formatMessages }      from './llm.extractor'

const MEMORY_KEY = 'cortex_memory_json'

function unique(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.toLowerCase()))]
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
}

function mergeProjects(
  existing: MemoryJSONProject[],
  incoming: MemoryJSONProject[]
): MemoryJSONProject[] {
  const merged = [...existing]
  for (const p of incoming) {
    const idx  = merged.findIndex(e => e.name.toLowerCase() === p.name.toLowerCase())
    if (idx >= 0) {
      const curr = merged[idx] as MemoryJSONProject   // safe: idx came from findIndex
      merged[idx] = {
        id:          curr.id,
        name:        curr.name,
        description: curr.description,
        status:      p.status || curr.status,
        notes:       p.notes  || curr.notes,
        stack:       unique([...curr.stack, ...p.stack]),
        goals:       unique([...curr.goals, ...p.goals]),
      }
    } else {
      merged.push(p)
    }
  }
  return merged
}

function mergeDecisions(
  existing: MemoryJSON['decisions'],
  incoming: MemoryJSON['decisions']
): MemoryJSON['decisions'] {
  const merged = [...existing]
  for (const d of incoming) {
    if (!merged.some(e => e.topic.toLowerCase() === d.topic.toLowerCase())) {
      merged.push(d)
    }
  }
  return merged
}

export async function mergeMemory(newData: MemoryJSON): Promise<void> {
  const r        = await chrome.storage.local.get(MEMORY_KEY)
  const existing = r[MEMORY_KEY] as MemoryJSON | undefined

  if (!existing) {
    await chrome.storage.local.set({ [MEMORY_KEY]: newData })
    return
  }

  // Conditionally include optional fields to satisfy exactOptionalPropertyTypes
  const bgValue      = existing.identity.background ?? newData.identity.background
  const styleValue   = existing.preferences.style   ?? newData.preferences.style
  const summaryValue = newData.context_summary       || existing.context_summary

  const merged: MemoryJSON = {
    identity: {
      name:     existing.identity.name     ?? newData.identity.name,
      role:     existing.identity.role     ?? newData.identity.role,
      location: existing.identity.location ?? newData.identity.location,
      ...(bgValue != null ? { background: bgValue } : {}),
    },
    projects: mergeProjects(existing.projects, newData.projects),
    preferences: {
      languages:  unique([...existing.preferences.languages,  ...(newData.preferences.languages  ?? [])]),
      frameworks: unique([...existing.preferences.frameworks, ...(newData.preferences.frameworks ?? [])]),
      tools:      unique([...existing.preferences.tools,      ...(newData.preferences.tools      ?? [])]),
      patterns:   unique([...(existing.preferences.patterns ?? []), ...(newData.preferences.patterns ?? [])]),
      ...(styleValue != null ? { style: styleValue } : {}),
    },
    decisions:      mergeDecisions(existing.decisions, newData.decisions),
    interests:      unique([...(existing.interests ?? []), ...(newData.interests ?? [])]),
    open_questions: newData.open_questions,
    ...(summaryValue ? { context_summary: summaryValue } : {}),
  }

  await chrome.storage.local.set({ [MEMORY_KEY]: merged })
}

export async function activeRebuild(): Promise<{
  success:   boolean
  message:   string
  factCount: number
}> {
  console.log('[Cortex] Starting active memory rebuild')
  const { forceFreshHistory } = await import('./conversation.fetcher')
  const providers = ['claude', 'chatgpt', 'gemini', 'grok'] as const

  // Collect as typed tuples so noUncheckedIndexedAccess never sees T | undefined
  const fetched = await Promise.all(
    providers.map(async (prov): Promise<[string, import('./conversation.fetcher').ChatMessage[]]> =>
      [prov, await forceFreshHistory(prov)]
    )
  )

  const parts: string[] = []
  for (const [prov, msgs] of fetched) {
    if (msgs.length > 0) parts.push(formatMessages(msgs, prov))
  }

  if (parts.length === 0) {
    return { success: false, message: 'No conversation history found. Visit your AI providers first.', factCount: 0 }
  }

  const result = await extractWithLLM(parts.join('\n\n'))
  if (!result) {
    return { success: false, message: 'No API key configured. Add one in Settings to enable smart extraction.', factCount: 0 }
  }

  await chrome.storage.local.set({ [MEMORY_KEY]: result })

  // Sync extracted projects to the project store
  const { saveProject } = await import('./memory.store')
  const now = Date.now()
  for (const proj of result.projects) {
    await saveProject({ ...proj, created_at: now, updated_at: now })
  }

  const factCount =
    (result.identity.name ? 1 : 0) +
    result.projects.length          +
    result.decisions.length         +
    (result.interests?.length ?? 0)

  const summary = result.context_summary
  chrome.runtime.sendMessage({
    type: 'MEMORY_REBUILT', factCount, ...(summary ? { summary } : {}),
  }).catch(() => {})

  console.log('[Cortex] Active rebuild complete:', factCount, 'facts')
  return { success: true, message: `Memory rebuilt — ${factCount} facts extracted`, factCount }
}
