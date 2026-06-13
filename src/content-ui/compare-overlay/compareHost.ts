/**
 * compareHost.ts
 * Shared compare wiring used by every provider's content script.
 *  - initCompareSource: when THIS tab starts a compare, mount the overlay and
 *    relay streamed chunks (from the background) into it.
 *  - initCompareTarget: when THIS tab is the compare target, scrape its
 *    streaming response and stream deltas back to the background.
 * Every chrome.* call is guarded: after an extension reload the old orphaned
 * content script keeps running and would otherwise throw
 * "Extension context invalidated". innerText is used so open shadow roots are read.
 */

import type { Provider } from '../../shared/types'
import { mountCompareOverlay } from './mount'
import { getLastResponse, RESPONSE_SELECTORS } from './compare.selectors'

function alive(): boolean {
  try { return Boolean(chrome.runtime?.id) } catch { return false }
}

function safeSend(msg: unknown): void {
  if (!alive()) return
  try { void chrome.runtime.sendMessage(msg).catch(() => {}) } catch { /* context gone */ }
}

// SOURCE role - launch the overlay and feed it streamed chunks.
export function initCompareSource(sourceProvider: Provider): void {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window) return
    if (event.data?.type !== 'CORTEX_COMPARE_START') return
    if (!alive()) return

    const targetProvider = event.data.targetProvider as Provider
    const prompt         = String(event.data.prompt ?? '')
    const lastResponse   = getLastResponse(sourceProvider)

    mountCompareOverlay(sourceProvider, lastResponse, targetProvider)
    safeSend({ type: 'COMPARE_START', prompt, targetProvider, claudeResponse: lastResponse })
  })

  if (!alive()) return
  try {
    chrome.runtime.onMessage.addListener((msg: { type?: string; chunk?: string }) => {
      if (msg?.type === 'COMPARE_RESULT') {
        window.postMessage({ type: 'CORTEX_COMPARE_CHUNK', chunk: msg.chunk ?? '' }, '*')
      } else if (msg?.type === 'COMPARE_DONE') {
        window.postMessage({ type: 'CORTEX_COMPARE_DONE' }, '*')
      }
    })
  } catch { /* context gone */ }
}

// TARGET role - stream this tab's response back while it is the compare target.
export function initCompareTarget(provider: Provider): void {
  let poller: ReturnType<typeof setInterval> | null = null

  const stop = (): void => { if (poller) { clearInterval(poller); poller = null } }

  const outer = setInterval(async () => {
    if (!alive()) { clearInterval(outer); stop(); return }

    let mode: { active: boolean; target: string } | null = null
    try {
      const storage = await chrome.storage.local.get('compare_mode')
      mode = storage['compare_mode'] as { active: boolean; target: string } | null
    } catch { return }   // context invalidated between ticks

    if (mode?.active && mode.target === provider && !poller) {
      const baseline  = document.body.innerText.length
      let lastSentLen = 0
      let doneTimer: ReturnType<typeof setTimeout> | null = null

      poller = setInterval(() => {
        if (!alive()) { stop(); return }

        let responseText = ''
        for (const sel of RESPONSE_SELECTORS[provider]) {
          const els = document.querySelectorAll(sel)
          if (els.length > 0) {
            responseText = (els[els.length - 1] as HTMLElement).innerText?.trim() || ''
            if (responseText) break
          }
        }
        if (!responseText) {
          const cur = document.body.innerText
          if (cur.length > baseline) responseText = cur.slice(baseline)
        }

        const newText = responseText.slice(lastSentLen)
        if (newText.trim()) {
          lastSentLen = responseText.length
          safeSend({ type: 'COMPARE_RESULT', provider, chunk: newText, done: false })

          if (doneTimer) clearTimeout(doneTimer)
          doneTimer = setTimeout(() => {
            safeSend({ type: 'COMPARE_RESULT', provider, chunk: '', done: true })
            if (alive()) { try { void chrome.storage.local.remove('compare_mode') } catch { /* ignore */ } }
            stop()
          }, 3000)
        }
      }, 400)

    } else if (!mode?.active && poller) {
      stop()
    }
  }, 1000)
}