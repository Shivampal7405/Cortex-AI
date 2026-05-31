/**
 * ModelSwitcher.tsx
 * Dropdown to switch between models for a given provider.
 * On switch: sends SWITCH_MODEL message to background.
 * Context transfer logic handled in Phase 4.
 */

import { useState } from 'react'
import type { Provider } from '../../shared/types'

// Available models per provider
const PROVIDER_MODELS: Record<Provider, string[]> = {
  claude:  ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'],
  chatgpt: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3'],
  gemini:  ['gemini-2.0-flash', 'gemini-1.5-pro'],
  grok:    ['grok-3', 'grok-3-mini'],
}

// Display names
const MODEL_DISPLAY: Record<string, string> = {
  'claude-opus-4-5':   'Opus',
  'claude-sonnet-4-5': 'Sonnet',
  'claude-haiku-4-5':  'Haiku',
  'gpt-4o':            'GPT-4o',
  'gpt-4o-mini':       'GPT-4o mini',
  'o1':                'o1',
  'o3':                'o3',
  'gemini-2.0-flash':  'Flash 2.0',
  'gemini-1.5-pro':    'Pro 1.5',
  'grok-3':            'Grok 3',
  'grok-3-mini':       'Grok 3 mini',
}

interface ModelSwitcherProps {
  provider: Provider
  currentModel: string
}

export function ModelSwitcher({ provider, currentModel }: ModelSwitcherProps) {
  const [switching, setSwitching] = useState(false)
  const models = PROVIDER_MODELS[provider] ?? []

  const handleSwitch = (model: string) => {
    if (model === currentModel) return
    setSwitching(true)

    // Phase 4 will handle actual context transfer
    // For now: notify background of intended switch
    chrome.runtime.sendMessage({
      type: 'SWITCH_MODEL',
      provider,
      from_model: currentModel,
      to_model: model,
    }).catch(() => {}).finally(() => setSwitching(false))
  }

  return (
    <select
      value={currentModel}
      onChange={(e) => handleSwitch(e.target.value)}
      disabled={switching}
      style={{
        fontSize: '11px',
        padding: '2px 4px',
        border: '1px solid rgba(0,0,0,0.15)',
        borderRadius: '4px',
        backgroundColor: 'white',
        cursor: 'pointer',
        color: '#374151',
      }}
    >
      {models.map(model => (
        <option key={model} value={model}>
          {MODEL_DISPLAY[model] ?? model}
        </option>
      ))}
    </select>
  )
}
