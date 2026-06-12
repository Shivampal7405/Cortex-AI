import { useState, useEffect, useRef } from 'react'
import type { Provider } from '../../shared/types'
import { ComparePane } from './ComparePane'
import { CompareToolbar } from './CompareToolbar'

interface CompareOverlayProps {
  claudeResponse:  string
  targetProvider:  Provider
  onClose:         () => void
  onContinueWith:  (provider: Provider) => void
}

export function CompareOverlay({
  claudeResponse,
  targetProvider,
  onClose,
  onContinueWith
}: CompareOverlayProps) {
  const [targetResponse, setTargetResponse] = useState('')
  const [targetDone, setTargetDone] = useState(false)
  const [targetTokens, setTargetTokens] = useState(0)
  const [leftWidth, setLeftWidth] = useState(50)
  const [dragging, setDragging] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CORTEX_COMPARE_CHUNK') {
        const chunk = event.data.chunk || ''
        setTargetResponse(prev => prev + chunk)
        setTargetTokens(prev => prev + Math.ceil(chunk.length / 4))
      } else if (event.data?.type === 'CORTEX_COMPARE_DONE') {
        setTargetDone(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newWidth = ((e.clientX - rect.left) / rect.width) * 100
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth)
    }
  }

  const handleMouseUp = () => setDragging(false)

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging])

  // Mock costs for display
  const claudeTokens = Math.ceil(claudeResponse.length / 4)
  const claudeCost = 0.015 * (claudeTokens / 1000)
  const targetCost = 0.005 * (targetTokens / 1000)

  return (
    <div className="fixed inset-0 z-[999999] bg-black/75 flex items-center justify-center backdrop-blur-sm p-8 font-sans">
      <div 
        ref={containerRef}
        className="w-[92vw] h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden ring-1 ring-white/10"
      >
        <CompareToolbar 
          leftProvider="claude" 
          rightProvider={targetProvider} 
          onClose={onClose} 
        />
        
        <div className="flex-1 flex overflow-hidden">
          {/* Left Pane */}
          <div style={{ width: `${leftWidth}%` }} className="flex-shrink-0">
            <ComparePane
              provider="claude"
              response={claudeResponse}
              streaming={false}
              tokens={claudeTokens}
              cost={claudeCost}
              onCopy={() => navigator.clipboard.writeText(claudeResponse)}
              onContinue={() => onContinueWith('claude')}
            />
          </div>

          {/* Draggable Divider */}
          <div 
            className="relative w-1 bg-gray-200 dark:bg-gray-800 hover:bg-purple-500 dark:hover:bg-purple-500 cursor-col-resize transition-colors shrink-0 flex items-center justify-center group"
            onMouseDown={(e) => { e.preventDefault(); setDragging(true) }}
          >
            <div className="absolute w-8 h-full z-10" /> {/* Hit area */}
            <div className={`w-1 h-8 rounded-full bg-gray-400 group-hover:bg-white transition-colors ${dragging ? 'bg-white' : ''}`} />
          </div>

          {/* Right Pane */}
          <div style={{ width: `${100 - leftWidth}%` }} className="flex-shrink-0">
            <ComparePane
              provider={targetProvider}
              response={targetResponse}
              streaming={!targetDone}
              tokens={targetTokens}
              cost={targetCost}
              onCopy={() => navigator.clipboard.writeText(targetResponse)}
              onContinue={() => onContinueWith(targetProvider)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
