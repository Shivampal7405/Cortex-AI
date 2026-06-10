/**
 * mockData.ts
 * Realistic mock data for popup development / fallback rendering.
 * All shapes must match src/shared/types.ts exactly.
 */

import { ClaudeUsage, ChatGPTUsage, GeminiUsage, GrokUsage, ProviderState } from './types'

export const mockClaudeState: ProviderState<ClaudeUsage> = {
  data: {
    tokens_5hr:    78000,
    limit_5hr:     88000,
    pct_5hr:       89,
    tokens_7day:   410000,
    limit_7day:    1_000_000,
    pct_7day:      41,
    reset_5hr_at:  Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000,
    reset_7day_at: Date.now() + 4 * 24 * 60 * 60 * 1000,
    plan:          'pro',
    model:         'claude-sonnet-4-5',
  },
  status:       'active',
  last_updated: Date.now() - 8000,
}

export const mockChatGPTState: ProviderState<ChatGPTUsage> = {
  data: {
    plan:          'plus',
    messages_used: 18,
    messages_cap:  40,
    pct_used:      45,
    reset_at:      Date.now() + 2 * 60 * 60 * 1000,
    model:         'gpt-4o',
  },
  status:       'active',
  last_updated: Date.now() - 15000,
}

export const mockGeminiState: ProviderState<GeminiUsage> = {
  data: {
    tier:          'standard',
    context_limit: 32000,
    model:         'gemini-2.0-flash',
    is_logged_in:  true,
  },
  status:       'active',
  last_updated: Date.now() - 4000,
}

export const mockGrokState: ProviderState<GrokUsage> = {
  data: {
    plan:          'free',
    messages_used: 8,
    messages_cap:  25,
    pct_used:      32,
    reset_at:      Date.now() + 90 * 60 * 1000,
    model:         'grok-3',
  },
  status:       'active',
  last_updated: Date.now() - 25000,
}
