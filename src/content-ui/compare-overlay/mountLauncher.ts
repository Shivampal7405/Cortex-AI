/**
 * mountLauncher.ts
 * Mounts the floating Compare launcher onto a provider page that has no token bar
 * (ChatGPT / Gemini / Grok). Resilient to SPA re-renders: if the host app wipes the
 * node (common on ChatGPT route changes), a MutationObserver re-mounts it.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CompareLauncher } from './CompareLauncher'
import type { Provider } from '../../shared/types'

const ID = 'cortex-compare-launcher'

export function mountCompareLauncher(source: Provider): void {
  const ensure = (): void => {
    if (!document.body) return
    if (document.getElementById(ID)) return
    const container = document.createElement('div')
    container.id = ID
    document.body.appendChild(container)
    try {
      createRoot(container).render(React.createElement(CompareLauncher, { source }))
    } catch {
      container.remove()
    }
  }

  const start = (): void => {
    ensure()
    // SPAs re-render and can drop our node — re-mount whenever it disappears.
    new MutationObserver(() => {
      if (!document.getElementById(ID)) ensure()
    }).observe(document.body, { childList: true })
  }

  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
}