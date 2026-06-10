/**
 * TransferButton.tsx
 * "Send to →" row shown on each provider card.
 * Triggers N-way context transfer to any other AI.
 */

import React, { useState, useEffect } from 'react'
import type { Provider } from '../../shared/types'

interface TransferButtonProps {
  fromProvider: Provider
}

const PROVIDER_LABELS: Record<Provider, string> = {
  claude:  'Claude',
  chatgpt: 'ChatGPT',
  gemini:  'Gemini',
  grok:    'Grok',
}

const ALL_PROVIDERS: Provider[] = ['claude', 'chatgpt', 'gemini', 'grok']

export function TransferButton(
  { fromProvider }: TransferButtonProps
): React.ReactElement {
  const [transferring, setTransferring] = useState<Provider | null>(null)
  const [error,        setError]        = useState<string | null>(null)

  const targets = ALL_PROVIDERS.filter(p => p !== fromProvider)

  useEffect(() => {
    const handler = (msg: { type: string; reason?: string }) => {
      if (msg.type === 'TRANSFER_FAILED') {
        setTransferring(null)
        setError(msg.reason ?? 'Transfer failed')
        setTimeout(() => setError(null), 4000)
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handleTransfer = (to: Provider) => {
    setTransferring(to)
    setError(null)
    chrome.runtime.sendMessage({ type: 'TRANSFER_CONTEXT', from: fromProvider, to })
    setTimeout(() => setTransferring(null), 1500)
  }

  return (
    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '10px', opacity: 0.5, flexShrink: 0 }}>
          Send to →
        </span>
        {targets.map(target => (
          <button
            key={target}
            onClick={() => handleTransfer(target)}
            disabled={transferring !== null}
            style={{
              fontSize:        '10px',
              padding:         '2px 7px',
              borderRadius:    '4px',
              border:          '1px solid rgba(0,0,0,0.12)',
              backgroundColor: transferring === target
                ? 'rgba(124,58,237,0.15)'
                : 'rgba(0,0,0,0.03)',
              color:   'inherit',
              cursor:  transferring ? 'wait' : 'pointer',
              opacity: transferring && transferring !== target ? 0.4 : 1,
            }}
          >
            {transferring === target ? '...' : PROVIDER_LABELS[target]}
          </button>
        ))}
      </div>
      {error && (
        <div style={{ fontSize: '10px', color: '#EF4444', marginTop: '4px', lineHeight: 1.3 }}>
          ⚠ {error}
        </div>
      )}
    </div>
  )
}
