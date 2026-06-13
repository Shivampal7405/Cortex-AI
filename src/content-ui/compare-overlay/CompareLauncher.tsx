/**
 * CompareLauncher.tsx
 * Floating "⇄ Compare" pill mounted on ChatGPT / Gemini / Grok (which have no
 * token bar). Lets the user compare the current prompt against another LLM.
 * Self-contained inline styles — no Tailwind (mounted straight onto document.body).
 */
import { useState } from 'react'
import type { Provider } from '../../shared/types'
import { getComparePrompt } from './compare.selectors'

const NAMES:  Record<Provider, string> = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini', grok: 'Grok' }
const COLORS: Record<Provider, string> = { claude: '#D97706', chatgpt: '#10A37F', gemini: '#4285F4', grok: '#9B59B6' }
const ALL: Provider[] = ['claude', 'chatgpt', 'gemini', 'grok']
const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Roboto,sans-serif'

export function CompareLauncher({ source }: { source: Provider }) {
  const [open, setOpen] = useState(false)
  const targets = ALL.filter(p => p !== source)

  const start = (target: Provider) => {
    const prompt = getComparePrompt(source)
    setOpen(false)
    if (!prompt) {
      alert('Type a prompt or send a message first, then Compare.')
      return
    }
    window.postMessage({ type: 'CORTEX_COMPARE_START', prompt, targetProvider: target }, '*')
  }

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 999990, fontFamily: FONT }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, width: '150px',
          backgroundColor: '#1f1f1f', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            padding: '7px 12px', fontSize: '10px', fontWeight: 700, color: '#888',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>Compare with</div>
          {targets.map(p => (
            <button key={p} onClick={() => start(p)} style={{
              display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
              padding: '9px 12px', cursor: 'pointer', textAlign: 'left',
              backgroundColor: 'transparent', border: 'none', color: '#e6e6e6', fontFamily: FONT,
            }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[p] }} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{NAMES[p]}</span>
            </button>
          ))}
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '8px 14px', cursor: 'pointer', borderRadius: '100px',
        backgroundColor: '#1f1f1f', color: '#e6e6e6', fontFamily: FONT,
        fontSize: '13px', fontWeight: 600,
        border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
      }}>
        <span style={{ fontSize: '15px' }}>⇄</span> Compare
      </button>
    </div>
  )
}
