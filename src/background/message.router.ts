/**
 * message.router.ts
 * Central message hub for the background service worker.
 * Routes messages between content scripts, popup, and storage.
 * All chrome.runtime.sendMessage calls end up here.
 */

import { handleUsageUpdate } from './usage.aggregator'

export type RouterMessage =
  | { type: 'USAGE_UPDATE'; provider: string; data: unknown }
  | { type: 'SWITCH_MODEL'; provider: string; from_model: string; to_model: string }
  | { type: 'GET_STATE'; provider: string }

export function initMessageRouter(): void {
  chrome.runtime.onMessage.addListener(
    (message: RouterMessage, _sender, sendResponse) => {

      switch (message.type) {

        case 'USAGE_UPDATE':
          handleUsageUpdate(message.provider, message.data)
          // Notify popup if open
          chrome.runtime.sendMessage({
            type: 'STATE_UPDATED',
            provider: message.provider,
          }).catch(() => {})
          return false

        case 'SWITCH_MODEL':
          // Phase 4 will fill this in with context transfer logic
          console.log(`[Cortex] Model switch: ${message.from_model} → ${message.to_model}`)
          return false

        case 'GET_STATE':
          chrome.storage.local.get(
            `provider:${message.provider}`,
            (result) => sendResponse(result)
          )
          return true // async response

        default:
          return false
      }
    }
  )
}
