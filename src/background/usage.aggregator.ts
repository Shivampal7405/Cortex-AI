/**
 * usage.aggregator.ts
 * Receives raw token payloads from all agents.
 * Builds running session totals.
 * Computes Claude 5hr / 7day windows from stored history.
 * Writes normalized ProviderState to chrome.storage.local.
 * Pushes TokenBarState update to content scripts.
 */


import { computeCost, computeContextPct } from '../shared/tokenizer'
import { MODEL_CONTEXT_LIMITS } from '../shared/constants'
import type { ProviderState, ClaudeUsage, TokenBarState } from '../shared/types'
import { recordSnapshot } from './history.recorder'

export async function handleUsageUpdate(
  provider: string,
  data: unknown
): Promise<void> {
  if (provider !== 'claude') {
    await handleSimpleUpdate(provider, data)
    return
  }

  const raw = data as {
    pct_5hr: number
    pct_7day: number
    reset_5hr_at: number
    reset_7day_at: number
    total_tokens?: number
    context_limit?: number
    context_pct?: number
    model?: string
    source: string
  }

  // Build full ClaudeUsage state
  // We don't have exact token counts anymore from the API, just percentages
  // We use the default pro limits to approximate tokens if needed
  const claudeUsage: ClaudeUsage = {
    tokens_5hr:    Math.round((raw.pct_5hr / 100) * 88_000),
    limit_5hr:     88_000,
    pct_5hr:       raw.pct_5hr,
    tokens_7day:   Math.round((raw.pct_7day / 100) * 1_000_000),
    limit_7day:    1_000_000,
    pct_7day:      raw.pct_7day,
    reset_5hr_at:  raw.reset_5hr_at,
    reset_7day_at: raw.reset_7day_at,
    plan:  'pro',
    model: raw.model ?? 'claude-sonnet-4-5', // from DOM reader in content script
  }

  const state: ProviderState<ClaudeUsage> = {
    data: claudeUsage,
    status: 'active',
    last_updated: Date.now(),
  }

  // Persist to storage
  await chrome.storage.local.set({ 'provider:claude': state })

  // Record snapshot for heatmap history
  const today = new Date().toISOString().slice(0, 10)
  recordSnapshot({
    id:        `claude_${Date.now()}`,
    provider:  'claude',
    pct:       claudeUsage.pct_5hr,
    tokens:    claudeUsage.tokens_5hr,
    cost_usd:  0,
    date:      today,
    timestamp: Date.now(),
  }).catch(err => console.warn('[Cortex] recordSnapshot failed:', err))

  // Fetch existing TokenBarState to preserve total_tokens if this is just an SSE update
  const existingRes = await chrome.storage.local.get('tokenBarState:claude')
  const existingState = existingRes['tokenBarState:claude'] as TokenBarState | undefined

  const tokenBarState: TokenBarState = {
    provider: 'claude',
    input_tokens:      existingState?.input_tokens ?? 0,
    output_tokens:     existingState?.output_tokens ?? 0, 
    total_tokens:      raw.total_tokens ?? existingState?.total_tokens ?? 0,
    context_limit:     raw.context_limit ?? existingState?.context_limit ?? 200000,
    context_pct:       raw.context_pct ?? existingState?.context_pct ?? 0,
    cost_session_usd:  existingState?.cost_session_usd ?? 0,
    model:             existingState?.model ?? 'claude',
    pct_5hr:           raw.pct_5hr,
    pct_7day:          raw.pct_7day,
  }

  // Persist to storage for newly mounted UI elements
  await chrome.storage.local.set({ [`tokenBarState:claude`]: tokenBarState })

  // Push to content script (token bar updates immediately)
  chrome.tabs.query({ url: 'https://claude.ai/*' }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOKEN_BAR_UPDATE',
          data: tokenBarState,
        }).catch(() => {})
      }
    })
  })
}

// Simple handler for ChatGPT / Gemini / Grok
// Just tracks context window % — no hard limit tracking
async function handleSimpleUpdate(
  provider: string,
  data: unknown
): Promise<void> {
  const d = data as Record<string, unknown>
  const model = (d['model'] as string) ?? ''
  const inputTokens  = (d['input_tokens']  as number) ?? 0
  const outputTokens = (d['output_tokens'] as number) ?? 0
  const totalTokens  = inputTokens + outputTokens

  const tokenBarState: TokenBarState = {
    provider: provider as never,
    input_tokens:     inputTokens,
    output_tokens:    outputTokens,
    total_tokens:     totalTokens,
    context_limit:    MODEL_CONTEXT_LIMITS[model] ?? 128000,
    context_pct:      computeContextPct(totalTokens, model),
    cost_session_usd: computeCost(inputTokens, outputTokens, model),
    model,
  }

  const urlMap: Record<string, string> = {
    chatgpt: 'https://chatgpt.com/*',
    gemini:  'https://gemini.google.com/*',
    grok:    'https://grok.com/*',
  }

  // Persist to storage for newly mounted UI elements
  await chrome.storage.local.set({ [`tokenBarState:${provider}`]: tokenBarState })

  const urlPattern = urlMap[provider]
  if (!urlPattern) return

  chrome.tabs.query({ url: urlPattern }, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOKEN_BAR_UPDATE',
          data: tokenBarState,
        }).catch(() => {})
      }
    })
  })
}
