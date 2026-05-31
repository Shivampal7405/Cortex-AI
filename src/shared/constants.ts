/**
 * constants.ts
 * Shared constants and configs.
 */

// Context window limits per model (tokens)
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Claude
  'claude-opus-4-5': 200000,
  'claude-sonnet-4-5': 200000,
  'claude-haiku-4-5': 200000,
  // ChatGPT
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'o1': 128000,
  'o3': 200000,
  // Gemini
  'gemini-2.0-flash': 1000000,
  'gemini-1.5-pro': 2000000,
  // Grok
  'grok-3': 131072,
  'grok-3-mini': 131072,
};

// Cost per 1M tokens (USD)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5':    { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5':  { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5':   { input: 0.80,  output: 4.00  },
  'gpt-4o':             { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60  },
  'gemini-2.0-flash':   { input: 0.10,  output: 0.40  },
  'grok-3':             { input: 3.00,  output: 15.00 },
  'grok-3-mini':        { input: 0.30,  output: 0.50  },
};

// Provider brand colors
export const PROVIDER_COLORS: Record<string, string> = {
  claude:  '#D97706',
  chatgpt: '#10A37F',
  gemini:  '#4285F4',
  grok:    '#000000',
};

// Alert thresholds (%)
export const DEFAULT_ALERT_THRESHOLDS = {
  warning:  80,
  critical: 100,
};
