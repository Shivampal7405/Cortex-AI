/**
 * claude.content.ts
 * Content script for claude.ai
 * Uses she-llac/claude-counter's proven approach:
 *   1. Read orgId from lastActiveOrg cookie
 *   2. Poll /usage endpoint for 5hr + 7day bars
 *   3. Intercept SSE message_limit events for real-time updates
 *   4. Call conversation API for token counts
 *   5. Use gpt-tokenizer for local token estimation (omitted for size, using approximation)
 */

import { mountTokenBar } from '../../content-ui/shared/mount'

// ─── Utilities ───────────────────────────────────────────

function getOrgId(): string | null {
  const match = document.cookie.match(/lastActiveOrg=([^;]+)/)
  return match ? match[1] : null
}

function getConversationId(): string | null {
  const match = window.location.pathname.match(/\/chat\/([^/?]+)/)
  return match ? match[1] : null
}

// ─── Source 1+2: Usage bars from /usage endpoint ─────────

interface UsageData {
  pct_5hr: number
  pct_7day: number
  reset_5hr_at: number
  reset_7day_at: number
}

async function fetchUsage(orgId: string): Promise<UsageData | null> {
  try {
    const res = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      { credentials: 'include' }
    )
    if (!res.ok) return null
    const data = await res.json()

    const fiveHour = data?.message_limit?.five_hour
    const sevenDay = data?.message_limit?.seven_day

    return {
      pct_5hr:       Math.round((fiveHour?.used_fraction ?? 0) * 100),
      pct_7day:      Math.round((sevenDay?.used_fraction ?? 0) * 100),
      reset_5hr_at:  fiveHour?.resetsAt
                       ? new Date(fiveHour.resetsAt).getTime()
                       : Date.now() + 5 * 60 * 60 * 1000,
      reset_7day_at: sevenDay?.resetsAt
                       ? new Date(sevenDay.resetsAt).getTime()
                       : Date.now() + 7 * 24 * 60 * 60 * 1000,
    }
  } catch (err) {
    console.warn('[Cortex] /usage fetch failed:', err)
    return null
  }
}

function injectInterceptor(): void {
  // Listen for message_limit events from the injected script
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    const data = event.data
    
    if (data?.type === 'CORTEX_MESSAGE_LIMIT') {
      const limit = data.data
      const fiveHour = limit?.five_hour
      const sevenDay = limit?.seven_day

      if (fiveHour || sevenDay) {
        chrome.runtime.sendMessage({
          type: 'USAGE_UPDATE',
          provider: 'claude',
          data: {
            pct_5hr:  Math.round((fiveHour?.used_fraction ?? 0) * 100),
            pct_7day: Math.round((sevenDay?.used_fraction ?? 0) * 100),
            reset_5hr_at: fiveHour?.resetsAt
              ? new Date(fiveHour.resetsAt).getTime()
              : Date.now() + 5 * 60 * 60 * 1000,
            reset_7day_at: sevenDay?.resetsAt
              ? new Date(sevenDay.resetsAt).getTime()
              : Date.now() + 7 * 24 * 60 * 60 * 1000,
            source: 'sse_exact',  // flag as most accurate
          }
        }).catch(() => {})
      }
    }
  })

  // Inject the script into the MAIN world
  const script = document.createElement('script')
  script.id = 'cortex-claude-injected'
  script.src = chrome.runtime.getURL('agents/claude/claude.injected.js')
  document.documentElement.appendChild(script)
  script.remove() // Remove the tag immediately after execution
}

// ─── Source 4: Token count from conversation API ─────────

// Simple token counter — 1 token ≈ 4 chars (no gpt-tokenizer needed)
// gpt-tokenizer is too heavy for a content script
// Use character-based approximation, flag as estimated
function estimateTokens(text: string): number {
  return Math.round(text.length / 4)
}

// Cache to avoid recounting same messages
const tokenCache = new Map<string, number>()

async function fetchConversationTokens(
  orgId: string,
  conversationId: string
): Promise<number> {
  try {
    const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return 0

    const data = await res.json()
    const messages: Array<{ uuid: string; content: Array<{ text?: string }> }>
      = data?.chat_messages ?? []

    let totalTokens = 0
    for (const msg of messages) {
      const uuid = msg.uuid
      if (tokenCache.has(uuid)) {
        totalTokens += tokenCache.get(uuid)!
        continue
      }
      const text = msg.content
        ?.map((c) => c.text ?? '')
        .join('') ?? ''
      const tokens = estimateTokens(text)
      tokenCache.set(uuid, tokens)
      totalTokens += tokens
    }

    return totalTokens

  } catch (err) {
    console.warn('[Cortex] conversation token fetch failed:', err)
    return 0
  }
}

// ─── Main polling loop ───────────────────────────────────

async function pollUsage(): Promise<void> {
  const orgId = getOrgId()
  if (!orgId) {
    console.warn('[Cortex] No orgId found in cookies')
    return
  }

  const usage = await fetchUsage(orgId)
  if (!usage) return

  const conversationId = getConversationId()
  const totalTokens = conversationId
    ? await fetchConversationTokens(orgId, conversationId)
    : 0

  console.log('[Cortex] Usage polled:', usage, 'tokens:', totalTokens)

  chrome.runtime.sendMessage({
    type: 'USAGE_UPDATE',
    provider: 'claude',
    data: {
      ...usage,
      total_tokens: totalTokens,
      context_limit: 200000,
      context_pct: Math.round((totalTokens / 200000) * 100),
      source: 'polling',
    }
  }).catch(() => {})
}

// ─── Entry point ─────────────────────────────────────────

async function init(): Promise<void> {
  console.log('[Cortex] Claude content script initializing')

  const orgId = getOrgId()
  if (!orgId) {
    console.warn('[Cortex] Not logged in or no org cookie found')
    return
  }

  console.log('[Cortex] orgId found:', orgId)

  // Start SSE interception (catches real-time message_limit events via MAIN world injection)
  injectInterceptor()

  // Initial poll immediately
  await pollUsage()

  // Then poll every 30 seconds
  setInterval(pollUsage, 30_000)

  // Re-poll on navigation (SPA)
  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      tokenCache.clear()  // new conversation = clear cache
      setTimeout(pollUsage, 1000)  // wait for page to settle
    }
  }).observe(document.body, { childList: true, subtree: true })

  // Mount token bar UI
  mountTokenBarWhenReady()
}

function mountTokenBarWhenReady(): void {
  const observer = new MutationObserver(() => {
    if (document.getElementById('cortex-token-bar')) return

    const modelSelector = document.querySelector('[data-testid="model-selector-dropdown"]')
    if (!modelSelector) return

    const gridContainer = modelSelector.closest('[data-testid="chat-input-grid-container"]')
    const gridArea = modelSelector.closest('[data-testid="chat-input-grid-area"]')

    const findToolbarRow = (el: Element | null, stopAt?: Element | null): Element | null => {
      let cur = el
      while (cur && cur !== document.body) {
        if (stopAt && cur === stopAt) break
        if (cur !== el && cur.nodeType === 1) {
          const style = window.getComputedStyle(cur)
          if (style.display === 'flex' && style.flexDirection === 'row') {
            const buttons = cur.querySelectorAll('button').length
            if (buttons > 1) return cur
          }
        }
        cur = cur.parentElement
      }
      return null
    }

    const toolbarRow =
      (gridContainer ? findToolbarRow(modelSelector, gridArea || gridContainer) : null) ||
      findToolbarRow(modelSelector) ||
      modelSelector.parentElement?.parentElement?.parentElement

    if (toolbarRow && toolbarRow.nextElementSibling?.id !== 'cortex-token-bar') {
      const container = document.createElement('div')
      container.id = 'cortex-token-bar'
      toolbarRow.after(container)
      mountTokenBar('claude', toolbarRow as HTMLElement, container)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
