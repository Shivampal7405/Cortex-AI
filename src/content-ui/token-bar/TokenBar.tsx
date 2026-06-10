/**
 * TokenBar.tsx
 * Main token bar component injected into AI chat pages.
 * Shows: context window %, token counts, cost, model name.
 * For Claude: also shows 5hr and 7day limit bars.
 * Updates in real-time as messages are sent and received.
 */

import React, { useEffect, useState } from 'react'
import type { Provider, TokenBarState } from '../../shared/types'
import { PROVIDER_COLORS } from '../../shared/constants'
import { ModelSwitcher } from './ModelSwitcher'

interface TokenBarProps {
  provider: Provider
}

const DEFAULT_STATE: TokenBarState = {
  provider: 'claude',
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  context_limit: 200000,
  context_pct: 0,
  cost_session_usd: 0,
  model: 'claude-sonnet-4-5',
}

export function TokenBar({ provider }: TokenBarProps): React.ReactElement {
  const [state, setState] = useState<TokenBarState>(DEFAULT_STATE)
  const [visible, setVisible] = useState(true)

  // Fetch initial state and listen for token updates
  useEffect(() => {
    chrome.storage.local.get([`tokenBarState:${provider}`]).then(res => {
      if (res[`tokenBarState:${provider}`]) {
        setState(res[`tokenBarState:${provider}`])
      }
    }).catch(() => {
      // Ignore errors caused by 'Extension context invalidated' during reload
    })

    const handler = (message: { type: string; data: TokenBarState }) => {
      if (message.type === 'TOKEN_BAR_UPDATE' && message.data.provider === provider) {
        setState(message.data)
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [provider])

  if (!visible || provider !== 'claude') return <></>

  const color = PROVIDER_COLORS[provider] ?? '#7C3AED'
  const pct = state.context_pct
  const barColor = pct >= 90 ? '#EF4444' : pct >= 80 ? '#F59E0B' : color

  const isClaude = provider === 'claude'
  const pct5hr = state.pct_5hr ?? 0
  const pct7day = state.pct_7day ?? 0
  const color5hr = pct5hr >= 90 ? '#EF4444' : pct5hr >= 80 ? '#F59E0B' : color
  const color7day = pct7day >= 90 ? '#EF4444' : pct7day >= 80 ? '#F59E0B' : color

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[#f9f9f9] dark:bg-[#2b2b2b] border-t border-black/10 dark:border-white/10 text-[11px] font-sans text-gray-800 dark:text-gray-200 w-full" style={{ boxSizing: 'border-box' }}>
      
      {isClaude && (
        <>
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-bold text-gray-800 dark:text-gray-200">Session: {pct5hr}%</span>
            <div className="h-1 w-12 bg-black/50 dark:bg-white/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct5hr}%`, backgroundColor: color5hr }} />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-bold text-gray-800 dark:text-gray-200">Weekly: {pct7day}%</span>
            <div className="h-1 w-12 bg-black/50 dark:bg-white/50 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct7day}%`, backgroundColor: color7day }} />
            </div>
          </div>

          <div className="w-px h-3 bg-black/15 dark:bg-white/15 mx-1" />

          <ModelSwitcher provider={provider} currentModel={state.model} />

          <div className="w-px h-3 bg-black/15 dark:bg-white/15 mx-1" />
        </>
      )}

      {/* Context bar */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="font-bold text-gray-800 dark:text-gray-200 whitespace-nowrap">
          {state.total_tokens.toLocaleString()} tokens
        </span>
        <div className="flex-1 h-1 bg-black/50 dark:bg-white/50 rounded-full overflow-hidden min-w-[40px] max-w-[120px]">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        <span className="whitespace-nowrap font-semibold" style={{
          color: pct >= 90 ? '#EF4444' : pct >= 80 ? '#F59E0B' : 'inherit',
        }}>
          {pct}%
        </span>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setVisible(false)}
        className="bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-800 dark:hover:text-white text-base leading-none p-0 ml-1 font-bold"
        title="Hide Cortex bar"
      >
        ×
      </button>
    </div>
  )
}
