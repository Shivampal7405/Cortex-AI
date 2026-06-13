/**
 * TokenBar.tsx
 * Compact status bar injected at the bottom of AI chat pages.
 * Shows: 5hr/7day rate limit bars, model switcher, compare button, context %.
 * Dark mode is detected via prefers-color-scheme so Tailwind dark: classes work
 * correctly inside the Shadow DOM (which has no 'dark' class from the host page).
 */
import React, { useEffect, useState } from 'react'
import type { Provider, TokenBarState } from '../../shared/types'
import { PROVIDER_COLORS } from '../../shared/constants'
import { ModelSwitcher } from './ModelSwitcher'
import { CompareButton } from '../compare-overlay/CompareButton'

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

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return dark
}

interface RateLimitProps { label: string; pct: number; color: string }

function RateBar({ label, pct, color }: RateLimitProps) {
  const isWarn = pct >= 80
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 whitespace-nowrap">
        {label}
      </span>
      <div className="h-[3px] w-9 rounded-full overflow-hidden bg-black/[.08] dark:bg-white/[.1]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {isWarn && (
        <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{pct}%</span>
      )}
    </div>
  )
}

export function TokenBar({ provider }: TokenBarProps): React.ReactElement {
  const [state, setState] = useState<TokenBarState>(DEFAULT_STATE)
  const [visible, setVisible] = useState(true)
  const isDark = useDarkMode()

  useEffect(() => {
    if (!chrome.runtime?.id) return
    chrome.storage.local.get([`tokenBarState:${provider}`]).then(res => {
      if (res[`tokenBarState:${provider}`]) setState(res[`tokenBarState:${provider}`])
    }).catch(() => {
      // Ignore 'Extension context invalidated' errors during reload
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

  const color    = PROVIDER_COLORS[provider] ?? '#7C3AED'
  const pct      = state.context_pct
  const barColor = pct >= 90 ? '#EF4444' : pct >= 80 ? '#F59E0B' : color
  const pct5hr   = state.pct_5hr ?? 0
  const c5hr     = pct5hr >= 90 ? '#EF4444' : pct5hr >= 80 ? '#F59E0B' : color

  return (
    // Apply 'dark' class here so Tailwind dark: utilities activate inside Shadow DOM
    <div className={isDark ? 'dark' : ''}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 w-full select-none text-[11px] font-sans bg-[#f5f5f5] dark:bg-[#1c1c1c] border-t border-black/[.06] dark:border-white/[.06]"
        style={{ boxSizing: 'border-box' }}
      >
        {/* Rate limit bar — 5hr window, Claude Pro only */}
        {pct5hr > 0 && <RateBar label="5hr" pct={pct5hr} color={c5hr} />}

        <div className="w-px h-3 shrink-0 bg-black/[.08] dark:bg-white/[.08]" />

        <ModelSwitcher provider={provider} currentModel={state.model} />

        <div className="w-px h-3 shrink-0 bg-black/[.08] dark:bg-white/[.08]" />

        <CompareButton provider={provider} />

        <div className="w-px h-3 shrink-0 bg-black/[.08] dark:bg-white/[.08]" />

        {/* Context window usage */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
            {state.total_tokens.toLocaleString()} tok
          </span>
          <div className="flex-1 h-[3px] rounded-full overflow-hidden min-w-[28px] max-w-[96px] bg-black/[.08] dark:bg-white/[.1]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: barColor }}
            />
          </div>
          <span
            className="whitespace-nowrap font-semibold tabular-nums"
            style={{ color: pct >= 90 ? '#EF4444' : pct >= 80 ? '#F59E0B' : undefined }}
          >
            {pct}%
          </span>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => setVisible(false)}
          title="Hide Cortex bar"
          className="shrink-0 ml-0.5 bg-transparent border-none p-0 cursor-pointer text-[15px] leading-none font-medium text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300"
        >×</button>
      </div>
    </div>
  )
}
