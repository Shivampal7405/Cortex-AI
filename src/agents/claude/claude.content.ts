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
import { initCompareSource, initCompareTarget } from '../../content-ui/compare-overlay/compareHost'

// ─── Silence "Extension context invalidated" noise ────────
// When the extension reloads, the old content script keeps running in the tab.
// Any chrome.* call from that orphaned script throws this error.
// We patch console.warn once here so it never surfaces — even from the old copy.
;((): void => {
  const _warn = console.warn.bind(console)
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '')
    if (msg.includes('Extension context invalidated')) return
    _warn(...args)
  }
})()


// ─── Utilities ───────────────────────────────────────────

function getOrgId(): string | null {
  const match = document.cookie.match(/lastActiveOrg=([^;]+)/)
  return match ? (match[1] ?? null) : null
}

function getConversationId(): string | null {
  const match = window.location.pathname.match(/\/chat\/([^/?]+)/)
  return match ? (match[1] ?? null) : null
}

// Read current model from Claude's own model-selector button text.
// Selector targets the aria-label or inner text of the model dropdown.
function getModelFromDOM(): string {
  // Claude renders model name in the selector button
  const selectors = [
    '[data-testid="model-selector-dropdown"] button',
    'button[aria-label*="claude"]',
    '[data-testid="model-selector-dropdown"]',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (!el) continue
    const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase()
    // Map friendly names to API names
    if (text.includes('opus'))   return 'claude-opus-4-5'
    if (text.includes('4.6') || text.includes('4-6'))   return 'claude-sonnet-4-6'
    if (text.includes('4.5') || text.includes('4-5'))   return 'claude-sonnet-4-5'
    if (text.includes('haiku'))  return 'claude-haiku-4-5'
    if (text.includes('sonnet')) return 'claude-sonnet-4-5'
  }
  return 'claude-sonnet-4-5'  // safe default
}


// ─── Source 1+2: Usage bars from /usage endpoint ─────────

interface UsageData {
  pct_5hr:     number
  reset_5hr_at: number
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

    return {
      pct_5hr:      Math.round((fiveHour?.used_fraction ?? 0) * 100),
      reset_5hr_at: fiveHour?.resetsAt
                      ? new Date(fiveHour.resetsAt).getTime()
                      : Date.now() + 5 * 60 * 60 * 1000,
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

      if (fiveHour) {
        try {
          if (!chrome.runtime?.id) return
          chrome.runtime.sendMessage({
            type: 'USAGE_UPDATE',
            provider: 'claude',
            data: {
              pct_5hr:      Math.round((fiveHour?.used_fraction ?? 0) * 100),
              reset_5hr_at: fiveHour?.resetsAt
                ? new Date(fiveHour.resetsAt).getTime()
                : Date.now() + 5 * 60 * 60 * 1000,
              source: 'sse_exact',
            }
          }).catch(() => {})
        } catch {
          // Ignore context invalidated
        }
      }
    }
  })

  try {
    if (!chrome.runtime?.id) return
    // Inject the script into the MAIN world
    const script = document.createElement('script')
    script.id = 'cortex-claude-injected'
    script.src = chrome.runtime.getURL('agents/claude/claude.injected.js')
    document.documentElement.appendChild(script)
    script.remove() // Remove the tag immediately after execution
  } catch (err) {
    // Ignore context invalidated
  }
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
  // Bail immediately if extension context is already gone
  if (!chrome.runtime?.id) return 0

  try {
    const url = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=true&rendering_mode=messages&render_all_tools=true`
    const res = await fetch(url, { credentials: 'include' })
    if (!res.ok) return 0

    const data = await res.json()
    const messages: Array<{ uuid: string; role?: string; created_at?: string; content: Array<{ type?: string; text?: string }> }>
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

    // Save Claude history in same format as other trackers
    const claudeMessages = messages
      ?.map(msg => ({
        role:      msg.role === 'human' ? 'user' : 'assistant',
        content:   msg.content
                     ?.filter(c => c.type === 'text')
                     ?.map(c => c.text ?? '')
                     ?.join('') ?? '',
        timestamp: msg.created_at ? new Date(msg.created_at).getTime() : Date.now(),
      }))
      ?.filter(m => m.content.length > 0) ?? []

    // Guard against context invalidation between await ticks
    if (chrome.runtime?.id) {
      await chrome.storage.local.set({
        'claude_conv_history': claudeMessages,
      })
    }

    return totalTokens

  } catch (err) {
    // Silently drop context-invalidated errors — these are expected after an
    // extension reload while the old content script is still running in the tab.
    const msg = err instanceof Error ? err.message : String(err)
    if (!msg.includes('Extension context invalidated')) {
      console.warn('[Cortex] conversation token fetch failed:', err)
    }
    return 0
  }
}


// ─── Main polling loop ───────────────────────────────────

// Track interval so we can clear it when context dies
let _pollIntervalId: ReturnType<typeof setInterval> | null = null

async function pollUsage(): Promise<void> {
  // Self-terminate the interval if extension context is gone
  if (!chrome.runtime?.id) {
    if (_pollIntervalId !== null) {
      clearInterval(_pollIntervalId)
      _pollIntervalId = null
    }
    return
  }

  const orgId = getOrgId()
  if (!orgId) return

  const usage = await fetchUsage(orgId)
  if (!usage) return

  // Re-check after async gap
  if (!chrome.runtime?.id) return

  const conversationId = getConversationId()
  const totalTokens = conversationId
    ? await fetchConversationTokens(orgId, conversationId)
    : 0

  // Re-check after second async gap
  if (!chrome.runtime?.id) return

  try {
    chrome.runtime.sendMessage({
      type: 'USAGE_UPDATE',
      provider: 'claude',
      data: {
        ...usage,
        total_tokens:  totalTokens,
        context_limit: 200000,
        context_pct:   Math.round((totalTokens / 200000) * 100),
        model:         getModelFromDOM(),
        source:        'polling',
      }
    }).catch(() => {})
  } catch {
    // Ignore context invalidated on sendMessage
  }
}

import { watchForFacts } from '../../memory/memory.watcher'
import { injectIntoInput } from '../../memory/memory.injector'

// ─── Entry point ─────────────────────────────────────────

async function init(): Promise<void> {
  console.log('[Cortex] Claude content script initializing')

  const orgId  = getOrgId()
  const convId = getConversationId()

  if (!orgId) {
    console.warn('[Cortex] Claude: lastActiveOrg cookie missing')
    console.warn('[Cortex] Cookies available:',
      document.cookie.split(';')
        .map(c => c.trim().split('=')[0])
        .join(', ')
    )
  } else {
    chrome.storage.local.set({ claude_org_id: orgId })
    console.log('[Cortex] orgId saved:', orgId)
  }

  if (convId) {
    chrome.storage.local.set({ claude_conv_id: convId })
    console.log('[Cortex] convId saved:', convId)
  } else if (window.location.pathname.startsWith('/chat')) {
    // Only warn when we're inside a specific chat URL and somehow missing the ID
    console.warn('[Cortex] No convId in URL:', window.location.pathname)
  }
  // On home page, new chat page, etc. — silence is correct

  // Start SSE interception (catches real-time message_limit events via MAIN world injection)
  injectInterceptor()

  // Initial poll immediately
  await pollUsage()

  // Then poll every 30 seconds
  _pollIntervalId = setInterval(pollUsage, 30_000)

  // Re-poll on navigation (SPA)
  let lastUrl = window.location.href
  new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      tokenCache.clear()  // new conversation = clear cache
      
      if (chrome.runtime?.id) {
        chrome.storage.local.set({
          'claude_conv_id': getConversationId() ?? '',
        })
      }
      
      setTimeout(pollUsage, 1000)  // wait for page to settle
    }
  }).observe(document.body, { childList: true, subtree: true })

  // Mount token bar UI
  mountTokenBarWhenReady()

  // Start Memory Layer Watcher
  watchForFacts('claude', getConversationId)

  // Receive memory injection from background (via MAIN world postMessage)
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type === 'CORTEX_INJECT_MEMORY') {
      injectIntoInput(event.data.block as string, 'claude')
    }
  })

  // Compare: Claude can be both a source (its token bar has the Compare button)
  // and a target (another LLM compares against it).
  initCompareSource('claude')
  initCompareTarget('claude')
}

function mountTokenBarWhenReady(): void {
  const observer = new MutationObserver(() => {
    if (!chrome.runtime?.id) { observer.disconnect(); return }
    if (document.getElementById('cortex-token-bar')) return

    // Find any anchor in the bottom input row
    const anchor = 
      document.querySelector('[data-testid="model-selector-dropdown"]') ||
      document.querySelector('[data-testid="chat-input-grid-container"]') ||
      document.querySelector('.ProseMirror')

    if (!anchor) return

    const gridContainer = anchor.closest('[data-testid="chat-input-grid-container"]')
    const gridArea = anchor.closest('[data-testid="chat-input-grid-area"]')

    const findToolbarRow = (el: Element | null, stopAt?: Element | null): Element | null => {
      let cur = el
      while (cur && cur !== document.body) {
        if (stopAt && cur === stopAt) break
        if (cur !== el && cur.nodeType === 1) {
          const style = window.getComputedStyle(cur)
          // Look for a flex row that is likely the toolbar
          if (style.display === 'flex' && style.flexDirection === 'row') {
            const buttons = cur.querySelectorAll('button').length
            if (buttons >= 1) return cur
          }
        }
        cur = cur.parentElement
      }
      return null
    }

    const toolbarRow =
      (gridContainer ? findToolbarRow(anchor, gridArea || gridContainer) : null) ||
      findToolbarRow(anchor) ||
      anchor.parentElement?.parentElement?.parentElement

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
