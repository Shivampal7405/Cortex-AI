/**
 * ModelSwitcher.tsx
 * Button that opens Claude's native model picker.
 * Label reflects currently selected model.
 * Updates automatically when user switches natively.
 */

import React, { useEffect, useState } from 'react'
import type { Provider } from '../../shared/types'
import {
  openModelSelector,
  getCurrentModel,
  watchModelChanges,
} from '../../agents/claude/claude.model-switcher'

interface ModelSwitcherProps {
  provider:     Provider
  currentModel: string
}

const MODEL_DISPLAY: Record<string, string> = {
  'claude-opus-4-5':   'Opus',
  'claude-sonnet-4-5': 'Sonnet',
  'claude-haiku-4-5':  'Haiku',
}

export function ModelSwitcher(
  { provider }: ModelSwitcherProps
): React.ReactElement | null {
  const [model, setModel] = useState(getCurrentModel)

  useEffect(() => {
    const observer = watchModelChanges(setModel)
    return () => observer.disconnect()
  }, [])

  // Only Claude has a model switcher in the token bar
  if (provider !== 'claude') return null

  return (
    <button
      onClick={openModelSelector}
      title="Switch model"
      style={{
        fontSize:        '11px',
        padding:         '2px 8px',
        border:          '1px solid rgba(255,255,255,0.15)',
        borderRadius:    '4px',
        backgroundColor: 'rgba(255,255,255,0.08)',
        color:           'inherit',
        cursor:          'pointer',
        display:         'flex',
        alignItems:      'center',
        gap:             '3px',
        whiteSpace:      'nowrap',
      }}
    >
      {MODEL_DISPLAY[model] ?? 'Sonnet'} ▾
    </button>
  )
}
