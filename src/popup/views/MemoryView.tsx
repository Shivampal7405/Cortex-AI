/**
 * MemoryView.tsx
 * Memory tab in the popup.
 * Shows AI profile summary, rebuild button, facts, and inject.
 * Reads from chrome.storage.local — synced with all contexts.
 */

import { useState, useEffect } from 'react'
import { Check, Pin, Trash2 } from 'lucide-react'
import type { MemoryFact } from '../../memory/memory.types'
import { getAllFacts, deleteFact, updateFact } from '../../memory/memory.store'
import { ProjectsSection } from '../components/ProjectsSection'

export function MemoryView() {
  const [facts,          setFacts]          = useState<MemoryFact[]>([])
  const [loading,        setLoading]        = useState(true)
  const [activeProvider, setActiveProvider] = useState<string>('claude')
  const [rebuilding,     setRebuilding]     = useState(false)
  const [rebuildMsg,     setRebuildMsg]     = useState<string | null>(null)
  const [contextSummary, setContextSummary] = useState<string | null>(null)

  const loadFacts = async () => {
    try {
      const data = await getAllFacts()
      setFacts(data.sort((a, b) => b.extracted_at - a.extracted_at))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFacts()

    chrome.runtime.sendMessage({ type: 'GET_MEMORY_JSON' }, (json) => {
      if (json?.context_summary) setContextSummary(json.context_summary as string)
    })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url ?? ''
      if      (url.includes('claude.ai'))   setActiveProvider('claude')
      else if (url.includes('chatgpt.com')) setActiveProvider('chatgpt')
      else if (url.includes('gemini'))      setActiveProvider('gemini')
      else if (url.includes('x.com'))       setActiveProvider('grok')
    })

    const handler = (msg: { type: string; factCount?: number; summary?: string }) => {
      if (msg.type === 'MEMORY_UPDATED') { loadFacts(); return }
      if (msg.type === 'MEMORY_REBUILT') {
        setRebuilding(false)
        setRebuildMsg(`✓ ${msg.factCount ?? 0} facts extracted`)
        if (msg.summary) setContextSummary(msg.summary)
        setTimeout(() => setRebuildMsg(null), 4000)
        loadFacts()
      }
    }
    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  const handleConfirm = async (id: string) => { await updateFact(id, { confirmed: true }); loadFacts() }
  const handlePin     = async (id: string, p: boolean) => { await updateFact(id, { pinned: !p, confirmed: true }); loadFacts() }
  const handleDelete  = async (id: string) => { await deleteFact(id); loadFacts() }
  const handleInject  = () => chrome.runtime.sendMessage({ type: 'INJECT_MEMORY', provider: activeProvider })

  const handleRebuild = () => {
    setRebuilding(true)
    setRebuildMsg('Analyzing conversations...')
    chrome.runtime.sendMessage({ type: 'ACTIVE_REBUILD' }, (res: { message?: string }) => {
      setRebuilding(false)
      setRebuildMsg(res?.message ?? 'Done')
      setTimeout(() => setRebuildMsg(null), 4000)
    })
  }

  if (loading) return <div className="p-4 text-center text-gray-500 text-sm">Loading memory...</div>

  const tags = Array.from(new Set(facts.flatMap(f => f.tags)))
  if (tags.length === 0 && facts.length > 0) tags.push('untagged')

  return (
    <div className="flex flex-col gap-3 pb-2">

      {contextSummary && (
        <div className="p-2.5 rounded-lg border border-violet-500/30 bg-violet-500/5 text-xs text-violet-400 leading-relaxed">
          <div className="text-[10px] font-semibold opacity-60 mb-1 uppercase tracking-wider">AI Profile Summary</div>
          {contextSummary}
        </div>
      )}

      <button
        onClick={handleRebuild}
        disabled={rebuilding}
        className="w-full py-2 rounded-lg border border-violet-500/40 text-violet-400 text-xs hover:bg-violet-500/10 disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {rebuilding ? '⟳ Analyzing...' : '✨ Rebuild from all AIs'}
      </button>

      {rebuildMsg && (
        <div className={`text-center text-xs ${rebuildMsg.startsWith('✓') ? 'text-green-500' : 'text-amber-500'}`}>
          {rebuildMsg}
        </div>
      )}

      {facts.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">Start chatting to build your memory</div>
      ) : (
        <div className="space-y-3">
          {tags.map(tag => {
            const group = facts.filter(f => f.tags.includes(tag) || (f.tags.length === 0 && tag === 'untagged'))
            if (group.length === 0) return null
            return (
              <div key={tag}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 ml-1">{tag}</h3>
                <div className="space-y-1.5">
                  {group.map(fact => (
                    <div key={fact.id} className={`p-2.5 rounded-lg border text-sm flex gap-3 ${
                      !fact.confirmed ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
                        : fact.pinned  ? 'border-green-500/50 bg-green-50 dark:bg-green-950/20'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
                    }`}>
                      <div className="flex-1 text-gray-700 dark:text-gray-300 leading-snug">{fact.content}</div>
                      <div className="flex flex-col gap-1 shrink-0">
                        {!fact.confirmed && (
                          <button onClick={() => handleConfirm(fact.id)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-amber-600" title="Confirm fact">
                            <Check size={13} />
                          </button>
                        )}
                        <button onClick={() => handlePin(fact.id, fact.pinned)} className={`p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded ${fact.pinned ? 'text-green-600' : 'text-gray-400'}`} title={fact.pinned ? 'Unpin' : 'Pin'}>
                          <Pin size={13} className={fact.pinned ? 'fill-current' : ''} />
                        </button>
                        <button onClick={() => handleDelete(fact.id)} className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded text-red-400" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={handleInject} className="w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors" style={{ backgroundColor: '#7C3AED' }}>
        Inject memory into {activeProvider} ↗
      </button>

      <ProjectsSection />
    </div>
  )
}
