/**
 * mount.ts
 * React root mounting utility for content UI components.
 * Owns only React lifecycle — zero knowledge of any agent's DOM structure (Bug 4).
 */

import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { TokenBar } from '../token-bar/TokenBar'
import type { Provider } from '../../shared/types'

const roots = new Map<string, Root>()

/**
 * Mount (or remount) the TokenBar into the given container element.
 * The caller (agent content script) is responsible for creating and
 * inserting `container` into the page DOM before calling this function.
 *
 * Bug 3: always unmounts the previous root before creating a new one.
 * Bug 4: accepts container from caller — no agent-specific imports here.
 */
export function mountTokenBar(
  provider: Provider,
  _anchorElement: HTMLElement,
  container: HTMLElement,
): void {
  const containerId = 'cortex-token-bar'

  // Bug 3 step 1: unmount old React root to prevent memory leak
  if (roots.has(containerId)) {
    roots.get(containerId)!.unmount()
    roots.delete(containerId)
  }

  // Bug 3 step 2: remove any stale container that is not the one we're about to use
  const stale = document.getElementById(containerId)
  if (stale && stale !== container) stale.remove()

  // Bug 3 step 3+4: use the caller-supplied container (already in the DOM)
  const shadow = container.attachShadow({ mode: 'open' })

  const baseStyle = document.createElement('style')
  baseStyle.textContent =
    ':host { all: initial; display: block; width: 100%; } * { box-sizing: border-box; }'
  shadow.appendChild(baseStyle)

  // Fetch CSS from the extension context — content scripts can access chrome-extension://
  // URLs without web_accessible_resources (only the web page is restricted).
  const cssUrl = chrome.runtime.getURL('content.css')
  fetch(cssUrl)
    .then(r => r.text())
    .then(css => {
      const style = document.createElement('style')
      style.textContent = css
      shadow.appendChild(style)
    })
    .catch(() => { /* token bar renders unstyled rather than crashing */ })

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  const root = createRoot(mountPoint)
  roots.set(containerId, root)

  root.render(React.createElement(TokenBar, { provider }))
}

export function unmountTokenBar(): void {
  const root = roots.get('cortex-token-bar')
  if (root) {
    root.unmount()
    roots.delete('cortex-token-bar')
  }
  document.getElementById('cortex-token-bar')?.remove()
}
