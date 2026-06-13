/**
 * activity.ts
 * Shared helper for invisible trackers (ChatGPT, Gemini, Grok).
 * Estimates tokens from cached history split by role, emits a throttled
 * USAGE_UPDATE so the background records a daily heatmap snapshot and shows
 * accurate input/output token counts and cost in the popup.
 */

interface TrackedMessage {
  role:    string
  content: string
}

// Per-tab throttle so we don't spam the background on every DOM mutation.
let lastEmit = 0
const THROTTLE_MS = 15_000

export function emitActivity(
  provider: string,
  model:    string,
  messages: TrackedMessage[],
  force    = false,
): void {
  if (!messages?.length) return

  const now = Date.now()
  if (!force && now - lastEmit < THROTTLE_MS) return
  lastEmit = now

  // Split input (user) vs output (assistant) for accurate cost calculation.
  const inputChars  = messages
    .filter(m => m.role === 'user')
    .reduce((s, m) => s + (m.content?.length ?? 0), 0)
  const outputChars = messages
    .filter(m => m.role !== 'user')
    .reduce((s, m) => s + (m.content?.length ?? 0), 0)

  // 1 token ≈ 4 chars is the standard approximation for English text.
  const input_tokens  = Math.round(inputChars  / 4)
  const output_tokens = Math.round(outputChars / 4)
  const total_tokens  = input_tokens + output_tokens

  if (total_tokens === 0) return

  try {
    if (!chrome.runtime?.id) return
    chrome.runtime.sendMessage({
      type:     'USAGE_UPDATE',
      provider,
      data: { input_tokens, output_tokens, total_tokens, model },
    }).catch(() => {})
  } catch {
    // Extension context invalidated after reload — ignore.
  }
}
