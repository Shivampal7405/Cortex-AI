/**
 * feature.handlers.ts
 * Handlers for Compare mode and the Prompts library,
 * extracted from message.router.ts to stay under the 200-line limit.
 * All handlers run in the background service worker.
 */

import type { Provider, SavedPrompt } from '../shared/types'
import { streamTargetResponse } from './compare.scraper'
import { injectComposer } from './inject.dom'

const PROMPTS_KEY = 'cortex_prompts'

const TAB_URL_PATTERNS: Record<string, string> = {
  claude:  'https://claude.ai/*',
  chatgpt: 'https://chatgpt.com/*',
  gemini:  'https://gemini.google.com/*',
  grok:    'https://grok.com/*',
}

const OPEN_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  gemini:  'https://gemini.google.com/',
  grok:    'https://grok.com/',
}

// Patterns to find an existing target tab. Grok lives on both domains.
export function queryPatternsFor(provider: string): string[] {
  if (provider === 'grok') return ['https://grok.com/*', 'https://x.com/*']
  return [TAB_URL_PATTERNS[provider] ?? '']
}

export async function handleCompareStart(
  prompt:         string,
  targetProvider: Provider,
  sourceTabId:    number
): Promise<void> {
  await chrome.storage.local.set({
    compare_mode: { active: true, prompt, target: targetProvider, sourceTabId },
  })

  let targetTabs = await chrome.tabs.query({ url: queryPatternsFor(targetProvider) })

  if (targetTabs.length === 0) {
    const newTab = await chrome.tabs.create({ url: OPEN_URLS[targetProvider] ?? '', active: false })
    await new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        chrome.tabs.onUpdated.removeListener(listener)
        resolve()
      }
      const listener = (id: number, info: chrome.tabs.TabChangeInfo) => {
        if (id === newTab.id && info.status === 'complete') setTimeout(finish, 1200)
      }
      chrome.tabs.onUpdated.addListener(listener)
      setTimeout(finish, 6000)
    })
    targetTabs = [newTab]
  }

  const target = [...targetTabs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)
  })[0]
  const targetTabId = target?.id
  if (!targetTabId) { console.warn('[Cortex] compare: no target tab for', targetProvider); return }

  console.log('[Cortex] compare: injecting into', targetProvider, 'tab', targetTabId)
  await chrome.scripting.executeScript({
    target: { tabId: targetTabId },
    func:   injectComposer,
    args:   [prompt, targetProvider, true],
    world:  'MAIN',
  }).catch(err => console.warn('[Cortex] Compare inject failed:', err))

  // Scrape the target tab from the background - independent of its content script.
  void streamTargetResponse(targetTabId, sourceTabId, targetProvider, prompt)
}

export async function handleCompareResult(
  chunk:    string,
  done:     boolean,
  provider: Provider
): Promise<void> {
  const storage = await chrome.storage.local.get('compare_mode')
  const mode    = storage['compare_mode'] as { sourceTabId: number } | undefined
  if (!mode?.sourceTabId) return

  chrome.tabs.sendMessage(mode.sourceTabId, {
    type: done ? 'COMPARE_DONE' : 'COMPARE_RESULT',
    chunk,
    provider,
  }).catch(() => {})

  if (done) await chrome.storage.local.remove('compare_mode')
}

export async function getPrompts(): Promise<SavedPrompt[]> {
  const result = await chrome.storage.local.get(PROMPTS_KEY)
  const data   = result[PROMPTS_KEY]
  return Array.isArray(data) ? (data as SavedPrompt[]) : []
}

export async function savePrompt(prompt: SavedPrompt): Promise<void> {
  const prompts = await getPrompts()
  const idx     = prompts.findIndex(p => p.id === prompt.id)
  if (idx >= 0) prompts[idx] = prompt
  else          prompts.push(prompt)
  await chrome.storage.local.set({ [PROMPTS_KEY]: prompts })
}

export async function deletePrompt(id: string): Promise<void> {
  const prompts = await getPrompts()
  await chrome.storage.local.set({ [PROMPTS_KEY]: prompts.filter(p => p.id !== id) })
}

// Inject a saved prompt straight into the active provider's composer (no submit),
// directly via executeScript so it works on every provider, not just Claude.
export async function injectPrompt(content: string, provider: string): Promise<void> {
  const tabs = await chrome.tabs.query({ url: queryPatternsFor(provider) })
  const tab = [...tabs].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0)
  })[0]
  if (!tab?.id) return
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func:   injectComposer,
    args:   [content, provider, false],
    world:  'MAIN',
  }).catch(err => console.warn('[Cortex] Prompt inject failed:', err))
}