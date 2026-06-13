/**
 * llm.extractor.ts
 * LLM-powered memory extraction from conversation history.
 * Tries Groq → OpenAI → Gemini → NVIDIA NIM in priority order.
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

interface KeySet {
  groq:   string | null
  openai: string | null
  gemini: string | null
  nvidia: string | null
}

async function getKeys(): Promise<KeySet> {
  const r = await chrome.storage.local.get(['api_key_groq', 'api_key_openai', 'api_key_gemini', 'api_key_nvidia'])
  const raw: KeySet = {
    groq:   ((r['api_key_groq']   as string | undefined) ?? '').trim() || null,
    openai: ((r['api_key_openai'] as string | undefined) ?? '').trim() || null,
    gemini: ((r['api_key_gemini'] as string | undefined) ?? '').trim() || null,
    nvidia: ((r['api_key_nvidia'] as string | undefined) ?? '').trim() || null,
  }
  if (raw.groq   && !raw.groq.startsWith('gsk_'))    { console.warn('[Cortex] Groq key format invalid');   raw.groq   = null }
  if (raw.openai && !raw.openai.startsWith('sk-'))   { console.warn('[Cortex] OpenAI key format invalid'); raw.openai = null }
  if (raw.gemini && !raw.gemini.startsWith('AIza'))  { console.warn('[Cortex] Gemini key format invalid'); raw.gemini = null }
  if (raw.nvidia && !raw.nvidia.startsWith('nvapi-')){ console.warn('[Cortex] NVIDIA key format invalid'); raw.nvidia = null }
  return raw
}

async function callOpenAICompat(
  url:   string,
  model: string,
  key:   string,
  body:  string,
  label: string
): Promise<MemoryJSON | null> {
  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: body }] }),
  })
  if (!r.ok) {
    const err = await r.text().catch(() => 'unreadable')
    console.error(`[Cortex] ${label} API error:`, r.status, err.slice(0, 200))
    return null
  }
  return parseJSON((await r.json() as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]?.message?.content ?? '')
}

async function callGemini(apiKey: string, content: string): Promise<MemoryJSON | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  let res: Response
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: content }] }],
        generationConfig: { maxOutputTokens: 2000, temperature: 0.1, responseMimeType: 'application/json' },
      }),
    })
  } catch (err) {
    console.error('[Cortex] Gemini network error:', err)
    return null
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => 'unreadable')
    console.error('[Cortex] Gemini API error:', res.status, errText)
    return null
  }
  const data = await res.json().catch(() => null) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } | null
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  return text ? parseJSON(text) : null
}

export async function extractWithLLM(conversationText: string): Promise<MemoryJSON | null> {
  const keys = await getKeys()
  const body = PROMPT_BASE + truncate(conversationText)
  if (keys.groq) {
    const r = await callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', 'llama-3.3-70b-versatile', keys.groq, body, 'Groq')
    if (r) return r
  }
  if (keys.openai) {
    const r = await callOpenAICompat('https://api.openai.com/v1/chat/completions', 'gpt-4o-mini', keys.openai, body, 'OpenAI')
    if (r) return r
  }
  if (keys.gemini) {
    const r = await callGemini(keys.gemini, body)
    if (r) return r
  }
  if (keys.nvidia) {
    const r = await callOpenAICompat('https://integrate.api.nvidia.com/v1/chat/completions', 'meta/llama-3.1-8b-instruct', keys.nvidia, body, 'NVIDIA')
    if (r) return r
  }
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
