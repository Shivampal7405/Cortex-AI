/**
 * conversation.fetcher.ts
 * Fetches full conversation history for any provider.
 * Used by context transfer engine in Phase 4.
 * Reads from chrome.storage cache first (set by trackers).
 * Falls back to direct API fetch if cache is stale.
 */

import type { Provider }              from '../shared/types'
import { fetchConversationFromPage } from './page.fetchers'

export interface ChatMessage {
  role:      'user' | 'assistant'
  content:   string
  timestamp: number
}

// Storage keys matching tracker files
const HISTORY_KEYS: Record<Provider, string> = {
  claude:  'claude_conv_history',
  chatgpt: 'chatgpt_conv_history',
  gemini:  'gemini_conv_history',
  grok:    'grok_conv_history',
}

const CONV_ID_KEYS: Record<Provider, string> = {
  claude:  'claude_conv_id',
  chatgpt: 'chatgpt_conv_id',
  gemini:  'gemini_conv_id',
  grok:    'grok_conv_id',
}

// Get cached history from storage (set by tracker scripts)
export async function getCachedHistory(
  provider: Provider
): Promise<ChatMessage[]> {
  const key = HISTORY_KEYS[provider]
  if (!key) return []
  const result = await chrome.storage.local.get(key)
  const data   = result[key]
  if (!Array.isArray(data)) return []
  return data as ChatMessage[]
}

// Get active conversation ID from storage
export async function getActiveConvId(
  provider: Provider
): Promise<string | null> {
  const key = CONV_ID_KEYS[provider]
  if (!key) return null

  const result = await chrome.storage.local.get(key)
  const value  = result[key]

  if (typeof value !== 'string' || value.length === 0) return null
  return value
}

// Fetch Claude conversation directly via API
// (Claude content script saves orgId to storage)
async function fetchClaudeHistory(
  convId: string
): Promise<ChatMessage[]> {
  const orgResult = await chrome.storage.local.get('claude_org_id')
  const orgId     = orgResult['claude_org_id'] as string
  if (!orgId) return []

  const url = `https://claude.ai/api/organizations/${orgId}` +
              `/chat_conversations/${convId}` +
              `?tree=true&rendering_mode=messages&render_all_tools=true`

  const res = await fetch(url, {
    credentials: 'include',
  })
  if (!res.ok) return []

  const data     = await res.json()
  const messages = data?.chat_messages ?? []

  return messages
    .map((msg: {
      role:       string
      content:    Array<{ type: string; text?: string }>
      created_at: string
    }) => ({
      role:      msg.role === 'human' ? 'user' : 'assistant',
      content:   msg.content
                   ?.filter((c) => c.type === 'text')
                   ?.map((c)  => c.text ?? '')
                   ?.join('')
                   ?.trim() ?? '',
      timestamp: new Date(msg.created_at).getTime(),
    }))
    .filter((m: ChatMessage) => m.content.length > 0)
}

// Execute fetch inside the provider's own tab so session cookies are valid
async function fetchInProviderTab(
  provider: Provider
): Promise<ChatMessage[]> {
  const urlMap: Record<Provider, string> = {
    claude:  'https://claude.ai/*',
    chatgpt: 'https://chatgpt.com/*',
    gemini:  'https://gemini.google.com/*',
    grok:    'https://x.com/*',
  }

  const tabs = await chrome.tabs.query({ url: urlMap[provider] })
  if (!tabs[0]?.id) {
    console.warn(`[Cortex] No active tab for ${provider} — falling back to cache`)
    return []
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      world:  'MAIN',
      func:   fetchConversationFromPage,
      args:   [provider],
    })
    const messages = results?.[0]?.result
    if (Array.isArray(messages) && messages.length > 0) {
      console.log(`[Cortex] Fresh fetch for ${provider}:`, messages.length, 'messages')
      return messages as ChatMessage[]
    }
  } catch (err) {
    console.warn(`[Cortex] Fresh fetch failed for ${provider}:`, err)
  }
  return []
}

// Force a fresh fetch at transfer time — never relies on stale cache
export async function forceFreshHistory(
  provider: Provider
): Promise<ChatMessage[]> {
  const fresh = await fetchInProviderTab(provider)
  if (fresh.length > 0) {
    await chrome.storage.local.set({ [`${provider}_conv_history`]: fresh })
    return fresh
  }
  console.warn(`[Cortex] Fresh fetch empty for ${provider}, using cache`)
  return getCachedHistory(provider)
}

// Main entry point — get history for any provider
// Uses cache first, falls back to direct fetch for Claude
export async function getConversationHistory(
  provider: Provider
): Promise<ChatMessage[]> {

  // Try cache first (set by invisible tracker scripts)
  const cached = await getCachedHistory(provider)
  if (cached.length > 0) {
    console.log(
      `[Cortex] Using cached history for ${provider}:`,
      cached.length,
      'messages'
    )
    return cached
  }

  // Claude fallback: fetch directly via API
  if (provider === 'claude') {
    const convId = await getActiveConvId('claude')
    if (!convId) return []
    return fetchClaudeHistory(convId)
  }

  // Other providers: no cache = no history available yet
  // User needs to visit the provider page first
  console.warn(
    `[Cortex] No cached history for ${provider}.`,
    'User needs to visit the provider page.'
  )
  return []
}
