/**
 * CompareToolbar.tsx
 * Header bar for the compare overlay — provider badges and close button.
 * Self-contained inline styles; no Tailwind (overlay has no Shadow DOM).
 */
import type { Provider } from '../../shared/types'

interface CompareToolbarProps {
  leftProvider:  Provider
  rightProvider: Provider
  onClose:       () => void
}

const NAMES: Record<Provider, string> = {
  claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini', grok: 'Grok',
}
const COLORS: Record<Provider, string> = {
  claude: '#D97706', chatgpt: '#10A37F', gemini: '#4285F4', grok: '#9B59B6',
}

export function CompareToolbar({ leftProvider, rightProvider, onClose }: CompareToolbarProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: '52px', flexShrink: 0,
      backgroundColor: '#111111',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#555',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>Compare</span>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.1)' }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '4px 12px', borderRadius: '100px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[leftProvider] }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#efefef' }}>{NAMES[leftProvider]}</span>
          <span style={{ color: '#444', fontWeight: 700, margin: '0 2px' }}>⇄</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: COLORS[rightProvider] }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#efefef' }}>{NAMES[rightProvider]}</span>
        </div>
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: '50%', cursor: 'pointer', fontSize: '20px', lineHeight: 1,
          backgroundColor: 'transparent', color: '#666', fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#666' }}
      >×</button>
    </div>
  )
}
