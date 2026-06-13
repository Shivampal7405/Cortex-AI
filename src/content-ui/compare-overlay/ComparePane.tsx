/**
 * ComparePane.tsx
 * Single-provider response pane in the compare overlay.
 * Every div carries an explicit backgroundColor so claude.ai's global CSS
 * cannot override children that would otherwise appear white.
 */
import { useRef, useEffect } from 'react'
import type { Provider } from '../../shared/types'

interface ComparePaneProps {
  provider:   Provider
  response:   string
  streaming:  boolean
  tokens:     number
  cost:       number
  onCopy:     () => void
  onContinue: () => void
}

const NAMES:  Record<Provider, string> = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini', grok: 'Grok' }
const COLORS: Record<Provider, string> = { claude: '#D97706', chatgpt: '#10A37F', gemini: '#4285F4', grok: '#9B59B6' }

const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Roboto,sans-serif'

export function ComparePane({ provider, response, streaming, tokens, cost, onCopy, onContinue }: ComparePaneProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const color   = COLORS[provider]
  const name    = NAMES[provider]

  useEffect(() => {
    if (streaming && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [response, streaming])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      backgroundColor: '#1c1c1c', fontFamily: FONT,
    }}>

      {/* Pane header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '11px 16px', flexShrink: 0,
        backgroundColor: '#181818',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        margin: 0,
      }}>
        <div style={{
          width: '9px', height: '9px', borderRadius: '50%', backgroundColor: color, flexShrink: 0,
          animation: streaming ? 'cortex-pulse 1.4s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8e8', margin: 0, padding: 0 }}>{name}</span>
        <span style={{
          fontSize: '11px', padding: '2px 9px', borderRadius: '100px', margin: 0,
          color: streaming ? color : '#555',
          backgroundColor: streaming ? `${color}22` : 'rgba(255,255,255,0.05)',
          border: `1px solid ${streaming ? `${color}44` : 'transparent'}`,
          fontWeight: 500,
        }}>
          {streaming ? 'streaming…' : 'done'}
        </span>
      </div>

      {/* Response body — explicit bg so page CSS cannot make it white */}
      <div ref={bodyRef} style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '20px 22px',
        backgroundColor: '#1c1c1c',
        fontSize: '15px', lineHeight: '1.8', color: '#dcdcdc',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontFamily: FONT, margin: 0,
      }}>
        {response}
        {!response && !streaming && (
          <span style={{ color: '#444', fontStyle: 'italic', fontFamily: FONT }}>Waiting for response…</span>
        )}
        {streaming && (
          <span style={{
            display: 'inline-block', width: '2px', height: '16px', marginLeft: '3px',
            backgroundColor: color, verticalAlign: 'middle',
            animation: 'cortex-blink 1s step-start infinite',
          }} />
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', flexShrink: 0,
        backgroundColor: '#141414',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <span style={{ fontSize: '12px', color: '#555', fontVariantNumeric: 'tabular-nums', fontFamily: FONT }}>
          {tokens.toLocaleString()} tokens · ${cost.toFixed(4)}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onCopy} style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
            color: '#bbb', backgroundColor: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.13)',
            borderRadius: '7px', fontFamily: FONT, outline: 'none',
          }}>Copy</button>
          <button onClick={onContinue} style={{
            padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            color: '#fff', backgroundColor: color,
            border: 'none', borderRadius: '7px', fontFamily: FONT, outline: 'none',
          }}>Continue here →</button>
        </div>
      </div>
    </div>
  )
}
