import { GeminiUsage } from '../../shared/types'

export async function pollGemini(): Promise<void> {
  try {
    const tokenCookie = await chrome.cookies.get({
      url: 'https://gemini.google.com',
      name: '__Secure-1PSID'
    })

    if (!tokenCookie) {
      await chrome.storage.local.set({
        'provider:gemini': {
          data: null,
          status: 'not_detected',
          last_updated: Date.now()
        }
      })
      return
    }

    const tabs = await chrome.tabs.query({ url: 'https://gemini.google.com/*' })
    
    if (tabs.length === 0) {
      await chrome.storage.local.set({
        'provider:gemini': {
          data: null,
          status: 'not_detected',
          last_updated: Date.now()
        }
      })
      return
    }

    let isAdvanced = false
    let model = 'gemini-2.0-flash'
    
    const tabId = tabs[0]?.id
    if (tabId !== undefined) {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const advanced = document.querySelector(
            '[aria-label*="Advanced"], .advanced-badge, [data-model*="ultra"]'
          )
          return {
            isAdvanced: !!advanced,
            model: document.querySelector('[data-model]')?.getAttribute('data-model') ?? 'gemini-2.0-flash'
          }
        }
      })

      const scriptResult = result?.[0]?.result
      if (scriptResult) {
        isAdvanced = scriptResult.isAdvanced
        model = scriptResult.model
      }
    }

    const geminiUsage: GeminiUsage = {
      tier: isAdvanced ? 'advanced' : 'standard',
      context_limit: isAdvanced ? 1000000 : 32000,
      model,
      is_logged_in: true
    }

    await chrome.storage.local.set({
      'provider:gemini': {
        data: geminiUsage,
        status: 'active',
        last_updated: Date.now()
      }
    })
  } catch (err) {
    console.warn('[Cortex] Gemini poll failed:', err)
  }
}

export function initGeminiPoller(): void {
  chrome.alarms.create('poll-gemini', { periodInMinutes: 5 })
}
