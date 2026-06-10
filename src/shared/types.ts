/**
 * types.ts
 * Core types for Cortex extension.
 */

export type Provider = 'claude' | 'chatgpt' | 'gemini' | 'grok';
export type ProviderStatus = 'active' | 'idle' | 'not_detected' | 'error' | 'loading';
export type Plan = 'free' | 'pro' | 'max' | 'plus' | 'team' | 'enterprise' | 'payg';

// Per-provider usage shapes
export interface ClaudeUsage {
  tokens_5hr: number;
  limit_5hr: number;
  pct_5hr: number;
  tokens_7day: number;
  limit_7day: number;
  pct_7day: number;
  reset_5hr_at: number; // unix ms
  reset_7day_at: number;
  plan: Plan;
  model: string;
}

export interface ChatGPTUsage {
  plan: 'free' | 'plus' | 'pro' | 'team';
  messages_used: number;
  messages_cap: number;
  pct_used: number;
  reset_at: number; // unix ms
  model: string;
}

export interface GeminiUsage {
  tier: 'standard' | 'advanced';
  context_limit: number;
  model: string;
  is_logged_in: boolean;
}

export interface GrokUsage {
  plan: 'free' | 'premium' | 'premium_plus';
  messages_used: number;
  messages_cap: number;
  pct_used: number;
  reset_at: number; // unix ms
  model: string;
}

// Generic provider state wrapper
export interface ProviderState<T> {
  data: T | null;
  status: ProviderStatus;
  last_updated: number | null;
  error?: string;
}

// In-chat token bar data
export interface TokenBarState {
  provider: Provider;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  context_limit: number;
  context_pct: number;
  cost_session_usd: number;
  model: string;
  pct_5hr?: number;
  pct_7day?: number;
}

// Memory types
export interface MemoryFact {
  id: string;
  content: string;
  source_provider: Provider;
  extracted_at: number;
  tags: string[];
  pinned: boolean;
}

export interface MemoryStore {
  facts: MemoryFact[];
  last_synced: number;
}

// Session history
export interface SessionRecord {
  id: string;
  provider: Provider;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  started_at: number;
  ended_at: number;
}

// Alert types
export interface AlertRule {
  provider: Provider;
  metric: 'context_pct' | 'daily_pct' | 'cost_usd';
  threshold: number;
  cooldown_minutes: number;
  enabled: boolean;
}

export interface AlertEvent {
  id: string;
  provider: Provider;
  metric: string;
  value: number;
  threshold: number;
  fired_at: number;
  dismissed: boolean;
}

// Chrome message bus types
export interface BaseMessage {
  type: string;
}

export interface UsageUpdateMessage extends BaseMessage {
  type: 'USAGE_UPDATE';
  provider: Provider;
  data: ClaudeUsage | ChatGPTUsage | GeminiUsage | GrokUsage;
}

export interface TokenBarUpdateMessage extends BaseMessage {
  type: 'TOKEN_BAR_UPDATE';
  provider: Provider;
  data: TokenBarState;
}

export interface MemoryUpdateMessage extends BaseMessage {
  type: 'MEMORY_UPDATE';
  facts: MemoryFact[];
}

export type ExtensionMessage =
  | UsageUpdateMessage
  | TokenBarUpdateMessage
  | MemoryUpdateMessage;

export interface AppState {
  claude:   ProviderState<ClaudeUsage>
  chatgpt:  ProviderState<ChatGPTUsage>
  gemini:   ProviderState<GeminiUsage>
  grok:     ProviderState<GrokUsage>
}
