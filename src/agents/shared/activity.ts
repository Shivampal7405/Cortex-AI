/**
 * activity.ts
 * Shared helper for invisible trackers (ChatGPT, Gemini, Grok).
 * Estimates tokens from cached history and emits a throttled USAGE_UPDATE,
 * letting the background record a daily heatmap snapshot for every provider.
 * Without this, History only ever showed Claude data.
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
): void {
  if (!messages?.length) return

  const now = Date.now()
  if (now - lastEmit < THROTTLE_MS) return
  lastEmit = now

  const chars  = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
  const tokens = Math.round(chars / 4)
  if (tokens === 0) return

  try {
    if (!chrome.runtime?.id) return
    chrome.runtime.sendMessage({
      type:     'USAGE_UPDATE',
      provider,
      data: {
        input_tokens:  tokens,
        output_tokens: 0,
        total_tokens:  tokens,
        model,
      },
    }).catch(() => {})
  } catch {
    // Extension context invalidated after reload — ignore.
  }
}
