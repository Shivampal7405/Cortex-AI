import { useState } from 'react'
import type { Provider } from '../../shared/types'
import { PROVIDER_COLORS } from '../../shared/constants'
import { getComparePrompt } from './compare.selectors'

interface CompareButtonProps {
  provider: Provider
}

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'grok', label: 'Grok' },
]

export function CompareButton({ provider }: CompareButtonProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState<Provider | null>(null)

  if (provider !== 'claude') return null

  const startCompare = (targetProvider: Provider) => {
    setLoading(targetProvider)

    const prompt = getComparePrompt(provider)
    if (!prompt) {
      alert("No prompt found to compare. Please type something or have a previous message.")
      setLoading(null)
      setShowPicker(false)
      return
    }

    window.postMessage({
      type: 'CORTEX_COMPARE_START',
      prompt,
      targetProvider
    }, '*')
    
    setShowPicker(false)
    setTimeout(() => setLoading(null), 2000) // Reset loading state after a bit
  }

  return (
    <div className="relative flex items-center">
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="flex items-center gap-1.5 px-2 py-1 bg-white/50 dark:bg-black/20 hover:bg-white dark:hover:bg-black/40 border border-black/10 dark:border-white/10 rounded transition-colors text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-sm"
      >
        <span className="text-[14px]">⇄</span> Compare
      </button>

      {showPicker && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 w-36 bg-white dark:bg-[#2b2b2b] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden py-1 z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
            Compare with
          </div>
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => startCompare(p.id)}
              disabled={loading !== null}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-black/20 disabled:opacity-50 transition-colors"
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: PROVIDER_COLORS[p.id] }}
              />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {p.label}
              </span>
              {loading === p.id && (
                <span className="ml-auto w-3 h-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
