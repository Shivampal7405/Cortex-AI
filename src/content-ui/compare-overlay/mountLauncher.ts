/**
 * mountLauncher.ts
 * Mounts the floating Compare launcher onto a provider page that has no token bar
 * (ChatGPT / Gemini / Grok). Idempotent — safe to call repeatedly.
 */
import React from 'react'
import { createRoot } from 'react-dom/client'
import { CompareLauncher } from './CompareLauncher'
import type { Provider } from '../../shared/types'

export function mountCompareLauncher(source: Provider): void {
  if (document.getElementById('cortex-compare-launcher')) return
  const container = document.createElement('div')
  container.id = 'cortex-compare-launcher'
  document.body.appendChild(container)
  createRoot(container).render(React.createElement(CompareLauncher, { source }))
}
