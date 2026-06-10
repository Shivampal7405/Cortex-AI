import { GrokUsage } from '../../shared/types'

const GROK_LIMITS = {
  free: { cap: 25, window_hours: 2 },
  premium: { cap: 100, window_hours: 2 },
  premium_plus: { cap: 300, window_hours: 2 },
}

export async function pollGrok(): Promise<void> {
  try {
    // We skip the cookie check because Grok moved to grok.com and might use different auth tokens

    // Since Grok uses complex CSRF tokens for GraphQL, we fallback to DOM scraping from an active Grok tab
    const tabs = await chrome.tabs.query({ url: 'https://grok.com/*' })
    if (tabs.length === 0) {
      await chrome.storage.local.set({
        'provider:grok': {
          data: null,
          status: 'not_detected',
          last_updated: Date.now()
        }
      })
      return
    }

    let messagesLeft: number | null = null
    let model = 'grok-3'
    let plan: 'free' | 'premium' | 'premium_plus' = 'free'

    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const limitText = document.body.innerText.match(/(\d+)\s*(messages?|queries)\s*(remaining|left)/i)
          const modelText = document.body.innerText.match(/Grok[- ](\w+)/i)
          const hasPremium = document.querySelector('[aria-label*="Premium"]') !== null
          return {
            messagesLeft: limitText ? parseInt(limitText[1] ?? '0') : null,
            model: modelText ? `grok-${(modelText[1] ?? 'unknown').toLowerCase()}` : 'grok-3',
            isPremium: hasPremium
          }
        }
      })

      const scriptResult = result?.[0]?.result
      if (scriptResult) {
        messagesLeft = scriptResult.messagesLeft
        model = scriptResult.model
        plan = scriptResult.isPremium ? 'premium' : 'free'
      }
    }

    const messages_cap = GROK_LIMITS[plan].cap
    const messages_used = messagesLeft !== null ? Math.max(0, messages_cap - messagesLeft) : 0
    const pct_used = (messages_used / messages_cap) * 100
    const reset_at = Date.now() + GROK_LIMITS[plan].window_hours * 60 * 60 * 1000

    const grokUsage: GrokUsage = {
      plan,
      messages_used,
      messages_cap,
      pct_used,
      reset_at,
      model
    }

    await chrome.storage.local.set({
      'provider:grok': {
        data: grokUsage,
        status: 'active',
        last_updated: Date.now()
      }
    })
  } catch (err) {
    console.warn('[Cortex] Grok poll failed:', err)
  }
}

export function initGrokPoller(): void {
  chrome.alarms.create('poll-grok', { periodInMinutes: 2 })
}
