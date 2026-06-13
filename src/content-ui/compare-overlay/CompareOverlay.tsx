/**
 * CompareOverlay.tsx
 * Full-screen split overlay mounted to document.body on claude.ai.
 * Every div carries an explicit backgroundColor — claude.ai applies a global
 * background-color to all divs which would make un-styled children white.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Provider } from '../../shared/types'
import { ComparePane } from './ComparePane'
import { CompareToolbar } from './CompareToolbar'

interface CompareOverlayProps {
  sourceProvider:  Provider
  sourceResponse:  string
  targetProvider:  Provider
  onClose:         () => void
  onContinueWith:  (provider: Provider) => void
}

const KEYFRAMES = `
  @keyframes cortex-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes cortex-blink { 0%,100%{opacity:1} 50%{opacity:0} }
`

export function CompareOverlay({ sourceProvider, sourceResponse, targetProvider, onClose, onContinueWith }: CompareOverlayProps) {
  const [targetResponse, setTargetResponse] = useState('')
  const [targetDone, setTargetDone]         = useState(false)
  const [targetTokens, setTargetTokens]     = useState(0)
  const [timedOut, setTimedOut]             = useState(false)
  const [leftWidth, setLeftWidth]           = useState(50)
  const [dragging, setDragging]             = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef  = useRef(false)

  // Watchdog: if the target tab never streams a response (e.g. its DOM
  // selectors drifted), stop the infinite "Waiting…" state after 30s.
  useEffect(() => {
    const gotChunk  = targetResponse.length > 0
    const deadline  = gotChunk ? 12_000 : 30_000   // shorter grace once streaming
    if (targetDone) return
    const timer = setTimeout(() => {
      setTimedOut(true)
      setTargetDone(true)
    }, deadline)
    return () => clearTimeout(timer)
  }, [targetResponse, targetDone])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'CORTEX_COMPARE_CHUNK') {
        const chunk = (e.data.chunk as string) || ''
        setTargetResponse(prev => prev + chunk)
        setTargetTokens(prev => prev + Math.ceil(chunk.length / 4))
      } else if (e.data?.type === 'CORTEX_COMPARE_DONE') {
        setTargetDone(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const w = ((e.clientX - rect.left) / rect.width) * 100
    if (w > 20 && w < 80) setLeftWidth(w)
  }, [])

  const onMouseUp = useCallback(() => {
    draggingRef.current = false
    setDragging(false)
  }, [])

  useEffect(() => {
    if (dragging) {
      draggingRef.current = true
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, onMouseMove, onMouseUp])

  const sourceTokens = Math.ceil(sourceResponse.length / 4)
  const sourceCost   = 0.015 * (sourceTokens / 1000)
  const targetCost   = 0.005 * (targetTokens / 1000)

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px',
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
      }}>
        {/* Dialog */}
        <div ref={containerRef} style={{
          width: '92vw', height: '85vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', borderRadius: '14px',
          backgroundColor: '#141414',
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.75)',
        }}>
          <CompareToolbar leftProvider={sourceProvider} rightProvider={targetProvider} onClose={onClose} />

          {/* Pane row — explicit bg prevents white bleed-through */}
          <div style={{
            flex: 1, display: 'flex', overflow: 'hidden',
            backgroundColor: '#1c1c1c',
          }}>
            {/* Left pane — source provider */}
            <div style={{ width: `${leftWidth}%`, flexShrink: 0, overflow: 'hidden', backgroundColor: '#1c1c1c' }}>
              <ComparePane
                provider={sourceProvider} response={sourceResponse} streaming={false}
                tokens={sourceTokens} cost={sourceCost}
                onCopy={() => navigator.clipboard.writeText(sourceResponse)}
                onContinue={() => onContinueWith(sourceProvider)}
              />
            </div>

            {/* Draggable divider */}
            <div
              style={{
                width: '1px', flexShrink: 0, cursor: 'col-resize', position: 'relative',
                backgroundColor: dragging ? '#7C3AED' : 'rgba(255,255,255,0.09)',
                transition: dragging ? 'none' : 'background-color 0.15s',
              }}
              onMouseDown={e => { e.preventDefault(); setDragging(true) }}
              onMouseEnter={e => { if (!dragging) e.currentTarget.style.backgroundColor = 'rgba(124,58,237,0.6)' }}
              onMouseLeave={e => { if (!dragging) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.09)' }}
            >
              <div style={{ position: 'absolute', inset: '0 -8px', cursor: 'col-resize' }} />
            </div>

            {/* Right pane — target AI */}
            <div style={{ flex: 1, overflow: 'hidden', backgroundColor: '#1c1c1c' }}>
              <ComparePane
                provider={targetProvider}
                response={timedOut && !targetResponse
                  ? `⚠️ No response captured from ${targetProvider}.\n\nThe prompt was sent — open that tab to view it directly. Cortex couldn't read the reply automatically (the site's layout may have changed).`
                  : targetResponse}
                streaming={!targetDone}
                tokens={targetTokens} cost={targetCost}
                onCopy={() => navigator.clipboard.writeText(targetResponse)}
                onContinue={() => onContinueWith(targetProvider)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
