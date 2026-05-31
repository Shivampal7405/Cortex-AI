import { ClaudeUsage, ChatGPTUsage, GeminiUsage, GrokUsage, ProviderState } from './types';

export const mockClaudeState: ProviderState<ClaudeUsage> = {
  data: {
    tokens_5hr: 78000,
    limit_5hr: 100000,
    pct_5hr: 78,
    tokens_7day: 410000,
    limit_7day: 1000000,
    pct_7day: 41,
    reset_5hr_at: Date.now() + 2 * 60 * 60 * 1000 + 14 * 60 * 1000, // 2h 14m from now
    reset_7day_at: Date.now() + 4 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000, // 4d 3h from now
    plan: 'pro',
    model: 'claude-sonnet-4-5',
  },
  status: 'active',
  last_updated: Date.now() - 8000, // 8s ago
};

export const mockChatGPTState: ProviderState<ChatGPTUsage> = {
  data: {
    plan: 'plus',
    tokens_today: 62000,
    limit_today: 100000,
    pct_today: 62,
    sessions_today: 4,
    model: 'gpt-4o',
  },
  status: 'active',
  last_updated: Date.now() - 15000,
};

export const mockGeminiState: ProviderState<GeminiUsage> = {
  data: {
    tier: 'payg',
    rpm_used: 40,
    rpm_limit: 60,
    tpd_used: 120000,
    tpd_limit: 4000000,
    model: 'gemini-2.0-flash',
  },
  status: 'active',
  last_updated: Date.now() - 4000,
};

export const mockGrokState: ProviderState<GrokUsage> = {
  data: {
    plan: 'pro',
    tokens_used: 45875,
    limit: 131072,
    pct: 35,
    model: 'grok-3',
  },
  status: 'active',
  last_updated: Date.now() - 25000,
};
