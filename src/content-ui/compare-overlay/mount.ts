import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { CompareOverlay } from './CompareOverlay'
import type { Provider } from '../../shared/types'

let overlayRoot: Root | null = null

export function mountCompareOverlay(
  sourceProvider: Provider,
  sourceResponse: string,
  targetProvider: Provider
): void {
  unmountCompareOverlay()

  const container = document.createElement('div')
  container.id = 'cortex-compare-overlay'

  // Make sure it sits on top of everything
  container.style.position = 'fixed'
  container.style.inset = '0'
  container.style.zIndex = '999999'

  document.body.appendChild(container)

  overlayRoot = createRoot(container)
  overlayRoot.render(
    React.createElement(CompareOverlay, {
      sourceProvider,
      sourceResponse,
      targetProvider,
      onClose: unmountCompareOverlay,
      onContinueWith: (provider) => {
        unmountCompareOverlay()
        if (provider !== sourceProvider) {
          chrome.runtime.sendMessage({
            type: 'TRANSFER_CONTEXT',
            from: sourceProvider,
            to:   provider,
          })
        }
      },
    })
  )
}

export function unmountCompareOverlay(): void {
  if (overlayRoot) {
    overlayRoot.unmount()
    overlayRoot = null
  }
  const el = document.getElementById('cortex-compare-overlay')
  if (el) {
    el.remove()
  }
}
