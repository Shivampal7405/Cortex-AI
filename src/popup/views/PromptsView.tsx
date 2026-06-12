import { useState, useEffect, useMemo } from 'react'
import { PromptCard, SavedPrompt } from '../components/PromptCard'

const STARTER_PROMPTS: Omit<SavedPrompt, 'id' | 'use_count' | 'created_at' | 'pinned'>[] = [
  {
    title:   "Code review",
    content: "Review this code for bugs, performance issues, and best practices. Be specific:",
    tags:    ["code"]
  },
  {
    title:   "Explain simply",
    content: "Explain the following in simple terms a non-technical person would understand:",
    tags:    ["explain"]
  },
  {
    title:   "Debug this error",
    content: "I'm getting this error. Explain why it's happening and how to fix it:",
    tags:    ["code", "debug"]
  },
  {
    title:   "Write tests",
    content: "Write comprehensive unit tests for this code. Cover edge cases and error cases:",
    tags:    ["code", "tests"]
  },
  {
    title:   "Summarize",
    content: "Summarize the following in 3-5 bullet points focusing on the most important:",
    tags:    ["writing"]
  }
]

export function PromptsView() {
  const [prompts, setPrompts] = useState<SavedPrompt[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Form state
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newTags, setNewTags] = useState('')

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PROMPTS' }, (response: SavedPrompt[]) => {
      if (chrome.runtime.lastError) return
      
      if (!response || response.length === 0) {
        // Seed
        const seeded = STARTER_PROMPTS.map(p => ({
          ...p,
          id: crypto.randomUUID(),
          use_count: 0,
          created_at: Date.now(),
          pinned: false
        }))
        setPrompts(seeded)
        // Save to storage
        seeded.forEach(prompt => {
          chrome.runtime.sendMessage({ type: 'SAVE_PROMPT', prompt })
        })
      } else {
        setPrompts(response)
      }
    })
  }, [])

  const handleSave = () => {
    if (!newTitle.trim() || !newContent.trim()) return

    const tags = newTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    const newPrompt: SavedPrompt = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      content: newContent.trim(),
      tags,
      use_count: 0,
      created_at: Date.now(),
      pinned: false
    }

    setPrompts(prev => [newPrompt, ...prev])
    chrome.runtime.sendMessage({ type: 'SAVE_PROMPT', prompt: newPrompt })
    
    // Reset form
    setNewTitle('')
    setNewContent('')
    setNewTags('')
    setShowForm(false)
  }

  const handleDelete = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id))
    chrome.runtime.sendMessage({ type: 'DELETE_PROMPT', id })
  }

  const handlePin = (id: string) => {
    setPrompts(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, pinned: !p.pinned } : p)
      const promptToSave = updated.find(p => p.id === id)
      if (promptToSave) {
        chrome.runtime.sendMessage({ type: 'SAVE_PROMPT', prompt: promptToSave })
      }
      return updated
    })
  }

  const handleInject = (id: string) => {
    const prompt = prompts.find(p => p.id === id)
    if (!prompt) return

    // Increment use count locally and in storage
    const updatedPrompt = { ...prompt, use_count: prompt.use_count + 1 }
    setPrompts(prev => prev.map(p => p.id === id ? updatedPrompt : p))
    chrome.runtime.sendMessage({ type: 'SAVE_PROMPT', prompt: updatedPrompt })

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || ''
      let provider = 'claude'
      if (url.includes('chatgpt.com')) provider = 'chatgpt'
      else if (url.includes('gemini.google')) provider = 'gemini'
      else if (url.includes('x.com')) provider = 'grok'

      chrome.runtime.sendMessage({
        type: 'INJECT_PROMPT',
        content: prompt.content,
        provider
      })
    })
  }

  const handleCopy = (id: string) => {
    const prompt = prompts.find(p => p.id === id)
    if (prompt) {
      navigator.clipboard.writeText(prompt.content)
    }
  }

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    prompts.forEach(p => p.tags.forEach(t => tags.add(t)))
    return Array.from(tags).sort()
  }, [prompts])

  const filteredPrompts = useMemo(() => {
    return prompts
      .filter(p => {
        const matchesSearch = (p.title + ' ' + p.content).toLowerCase().includes(search.toLowerCase())
        const matchesTag = activeTag ? p.tags.includes(activeTag) : true
        return matchesSearch && matchesTag
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.use_count - a.use_count
      })
  }, [prompts, search, activeTag])

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Search prompts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-gray-800 rounded outline-none transition-colors"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded transition-colors"
          >
            {showForm ? 'Cancel' : '+ New'}
          </button>
        </div>

        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
            <button
              onClick={() => setActiveTag(null)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTag === null 
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTag === tag
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0 shadow-inner">
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full px-3 py-1.5 mb-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none focus:border-purple-500 transition-colors"
          />
          <textarea
            placeholder="Prompt content..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            className="w-full px-3 py-2 mb-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none focus:border-purple-500 transition-colors resize-none h-20"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={newTags}
              onChange={e => setNewTags(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={handleSave}
              disabled={!newTitle.trim() || !newContent.trim()}
              className="px-4 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredPrompts.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
            No prompts found.
          </div>
        ) : (
          filteredPrompts.map(prompt => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onInject={handleInject}
              onCopy={handleCopy}
              onPin={handlePin}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}
