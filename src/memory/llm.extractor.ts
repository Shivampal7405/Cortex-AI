/**
 * llm.extractor.ts
 * LLM-powered memory extraction from conversation history.
 * Tries Claude → OpenAI → Gemini in priority order.
 * Falls back to regex when no API key is configured.
 * Passive mode: triggered every 5 messages via background alarm.
 */

import type { MemoryJSON }  from './memory.types'
import type { ChatMessage } from './conversation.fetcher'
import { extractFacts }     from './memory.extractor'

const PROMPT_BASE = `Analyze this AI conversation and extract a structured user profile.
Return ONLY valid JSON — no markdown, no explanation. Schema:
{"identity":{"name":null,"role":null,"location":null,"background":null},"projects":[{"id":"proj_example","name":"","description":"","stack":[],"status":"","goals":[],"notes":""}],"preferences":{"languages":[],"frameworks":[],"tools":[],"patterns":[],"style":null},"decisions":[{"topic":"","decision":"","reasoning":null,"date":null}],"interests":[],"open_questions":[],"context_summary":""}
Rules: Only include explicitly mentioned facts. null for absent fields. projects.id = "proj_" + lowercase-with-underscores. context_summary: 2-3 sentences briefing another AI about this user. decisions: technical/product choices only.

Conversation:`

export function formatMessages(msgs: ChatMessage[], label: string): string {
  return `=== ${label} ===\n` + msgs
    .filter(m => m.content.trim())
    .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content.trim()}`)
    .join('\n\n')
}

function truncate(text: string, max = 80_000): string {
  return text.length <= max ? text : `[Earlier history truncated]\n\n${text.slice(-max)}`
}

function parseJSON(raw: string): MemoryJSON | null {
  try {
    return JSON.parse(
      raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim()
    ) as MemoryJSON
  } catch {
    console.warn('[Cortex] LLM JSON parse failed — raw:', raw.slice(0, 150))
    return null
  }
}

async function getKeys(): Promise<{ claude: string | null; openai: string | null; gemini: string | null }> {
  const r = await chrome.storage.local.get(['api_key_claude', 'api_key_openai', 'api_key_gemini'])

  // Trim whitespace — common paste error
  const keys = {
    claude: ((r['api_key_claude'] as string) || '').trim() || null,
    openai: ((r['api_key_openai'] as string) || '').trim() || null,
    gemini: ((r['api_key_gemini'] as string) || '').trim() || null,
  }

  // Minimal format guard — flag obvious mistakes without blocking valid keys
  if (keys.claude && !keys.claude.startsWith('sk-ant-')) {
    console.warn('[Cortex] Claude key format unexpected (expected sk-ant-...)')
    keys.claude = null
  }
  if (keys.openai && !keys.openai.startsWith('sk-')) {
    console.warn('[Cortex] OpenAI key format unexpected (expected sk-...)')
    keys.openai = null
  }
  if (keys.gemini && !keys.gemini.startsWith('AIza')) {
    console.warn('[Cortex] Gemini key format unexpected (expected AIza...)')
    keys.gemini = null
  }

  console.log('[Cortex] API keys:', {
    claude: keys.claude ? 'SET' : 'MISSING',
    openai: keys.openai ? 'SET' : 'MISSING',
    gemini: keys.gemini ? 'SET' : 'MISSING',
  })
  return keys
}

async function callClaude(key: string, body: string): Promise<MemoryJSON | null> {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body:    JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 2000, messages: [{ role: 'user', content: body }] }),
  })
  if (!r.ok) {
    const err = await r.text().catch(() => 'unreadable')
    console.error('[Cortex] Claude API error:', r.status, err.slice(0, 200))
    return null
  }
  return parseJSON((await r.json())?.content?.[0]?.text ?? '')
}

async function callOpenAI(key: string, body: string): Promise<MemoryJSON | null> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 2000, messages: [{ role: 'user', content: body }] }),
  })
  if (!r.ok) {
    const err = await r.text().catch(() => 'unreadable')
    console.error('[Cortex] OpenAI API error:', r.status, err.slice(0, 200))
    return null
  }
  return parseJSON((await r.json())?.choices?.[0]?.message?.content ?? '')
}

async function callGemini(key: string, body: string): Promise<MemoryJSON | null> {
  console.log('[Cortex] Calling Gemini API...')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`

  let res: Response
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents:         [{ parts: [{ text: body }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.1 },
      }),
    })
  } catch (err) {
    console.error('[Cortex] Gemini fetch threw:', err)
    return null
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => 'unreadable')
    console.error('[Cortex] Gemini API error:', res.status, errBody.slice(0, 300))
    return null
  }

  let data: unknown
  try { data = await res.json() } catch {
    console.error('[Cortex] Gemini response is not JSON')
    return null
  }

  const text = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  })?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!text) {
    console.error('[Cortex] Gemini returned empty text. Response:', JSON.stringify(data).slice(0, 300))
    return null
  }

  console.log('[Cortex] Gemini response preview:', text.slice(0, 200))
  return parseJSON(text)
}

export async function extractWithLLM(conversationText: string): Promise<MemoryJSON | null> {
  const keys = await getKeys()
  const body = PROMPT_BASE + truncate(conversationText)
  if (keys.claude) { const r = await callClaude(keys.claude, body); if (r) return r }
  if (keys.openai) { const r = await callOpenAI(keys.openai, body); if (r) return r }
  if (keys.gemini) { const r = await callGemini(keys.gemini, body); if (r) return r }
  return null
}

export async function passiveExtraction(
  messages:       ChatMessage[],
  provider:       string,
  conversationId: string
): Promise<void> {
  const userMsgs = messages.filter(m => m.role === 'user')
  if (userMsgs.length === 0) return

  const result = await extractWithLLM(formatMessages(messages, provider))
  if (result) {
    const { mergeMemory } = await import('./llm.rebuilder')
    await mergeMemory(result)
    console.log('[Cortex] Passive LLM extraction complete')
  } else {
    const facts = extractFacts(
      userMsgs.map(m => m.content).join('\n'),
      provider as 'claude',
      conversationId
    )
    for (const fact of facts) {
      await chrome.runtime.sendMessage({ type: 'SAVE_FACT', fact }).catch(() => {})
    }
    console.log('[Cortex] Regex fallback:', facts.length, 'facts')
  }
  chrome.runtime.sendMessage({ type: 'MEMORY_UPDATED' }).catch(() => {})
}
