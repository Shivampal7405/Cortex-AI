/**
 * chatgpt.content.ts
 * Content script injected into chatgpt.com at document_start.
 */

import { mountTokenBar } from '../../content-ui/shared/mount'
import { findChatGPTInputArea, insertTokenBarContainer } from './chatgpt.injector'

function listenForTokenData(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return
    if (event.source !== window) return
    if (event.data?.type !== 'CORTEX_CHATGPT_TOKENS') return

    chrome.runtime.sendMessage({
      type: 'USAGE_UPDATE',
      provider: 'chatgpt',
      data: event.data.payload,
    }).catch(() => {})
  })
}

function mountUI(): void {
  const checkAndMount = () => {
    const inputArea = findChatGPTInputArea()
    if (inputArea && !document.getElementById('cortex-token-bar')) {
      const container = insertTokenBarContainer(inputArea)
      mountTokenBar('chatgpt', inputArea, container)
    }
  }

  // Bug 2: observer never disconnects — survives SPA navigation
  const observer = new MutationObserver(checkAndMount)
  observer.observe(document.body, { childList: true, subtree: true })

  checkAndMount()
}

listenForTokenData()

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountUI)
} else {
  mountUI()
}
