import { ChatGPTUsage } from '../../shared/types'

export async function pollChatGPT(): Promise<void> {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'chatgpt.com' })
    const tokenCookie = cookies.find(c => c.name.includes('session-token') || c.name.includes('auth'))
    const tabs = await chrome.tabs.query({ url: '*://chatgpt.com/*' })

    // If no tab is open, we force it to not_detected so the user gets the "Open ChatGPT" link
    if (tabs.length === 0) {
      await chrome.storage.local.set({
        'provider:chatgpt': {
          data: null,
          status: 'not_detected',
          last_updated: Date.now()
        }
      })
      return
    }

    let chatGPTUsage: ChatGPTUsage = {
      plan: 'free',
      messages_used: 0,
      messages_cap: 0,
      pct_used: 0,
      reset_at: Date.now() + 3 * 60 * 60 * 1000, // default: 3h from now
      model: 'gpt-4o'
    }

    if (tokenCookie) {

      try {
        const res = await fetch('https://chatgpt.com/backend-api/accounts/check/v4-2023-04-27', {
          headers: {
            'Cookie': `${tokenCookie.name}=${tokenCookie.value}`,
            'User-Agent': navigator.userAgent,
            'Referer': 'https://chatgpt.com/',
          }
        })

        if (res.ok) {
          const data = await res.json()
          const account_plan = data.account_plan
          const message_cap_by_kind = data.message_cap_by_kind || {}

          chatGPTUsage.plan = account_plan?.plan_type || 'free'
          
          let targetModelKey = 'default'
          if (message_cap_by_kind['gpt-4o']) targetModelKey = 'gpt-4o'
          else if (message_cap_by_kind['gpt-4']) targetModelKey = 'gpt-4'
          
          chatGPTUsage.model = targetModelKey

          const capData = message_cap_by_kind[targetModelKey]
          if (capData) {
            chatGPTUsage.messages_cap = capData.message_cap || capData.messages_cap || 0
            const messages_left = capData.messages_left || 0
            chatGPTUsage.messages_used = Math.max(0, chatGPTUsage.messages_cap - messages_left)
            chatGPTUsage.pct_used = chatGPTUsage.messages_cap > 0 ? (chatGPTUsage.messages_used / chatGPTUsage.messages_cap) * 100 : 0
            chatGPTUsage.reset_at = capData.next_reset ? new Date(capData.next_reset).getTime() : Date.now()
          }
        }
      } catch (e) {
        console.warn('[Cortex] ChatGPT API fetch failed:', e)
      }
    }

    await chrome.storage.local.set({
      'provider:chatgpt': {
        data: chatGPTUsage,
        status: 'active',
        last_updated: Date.now()
      }
    })
  } catch (err) {
    console.warn('[Cortex] ChatGPT poll failed:', err)
  }
}

export function initChatGPTPoller(): void {
  chrome.alarms.create('poll-chatgpt', { periodInMinutes: 1 })
}
