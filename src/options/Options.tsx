/**
 * Options.tsx
 * Extension settings page.
 * API key configuration for LLM memory extraction.
 * Keys are stored locally — never synced or sent to Cortex servers.
 */

import { useState, useEffect } from 'react'
import { Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react'

const API_PROVIDERS = [
  { id: 'claude',  label: 'Claude API Key',  placeholder: 'sk-ant-...', hint: 'Used for smart memory extraction (cheapest)' },
  { id: 'openai',  label: 'OpenAI API Key',  placeholder: 'sk-...',     hint: 'Fallback if no Claude key'                   },
  { id: 'gemini',  label: 'Gemini API Key',  placeholder: 'AIza...',    hint: 'Free tier available'                         },
] as const

async function testKey(id: string, key: string): Promise<boolean> {
  try {
    if (id === 'claude') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 10, messages: [{ role: 'user', content: 'Reply: OK' }] }),
      })
      return r.ok
    }
    if (id === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: 10, messages: [{ role: 'user', content: 'Reply: OK' }] }),
      })
      return r.ok
    }
    if (id === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply: OK' }] }], generationConfig: { maxOutputTokens: 10 } }),
      })
      return r.ok
    }
    return false
  } catch {
    return false
  }
}

export function Options() {
  const [keys,       setKeys]       = useState<Record<string, string>>({})
  const [visible,    setVisible]    = useState<Record<string, boolean>>({})
  const [saved,      setSaved]      = useState<Record<string, boolean>>({})
  const [testing,    setTesting]    = useState<Record<string, boolean>>({})
  const [testResult, setTestResult] = useState<Record<string, string>>({})

  useEffect(() => {
    chrome.storage.local.get(
      ['api_key_claude', 'api_key_openai', 'api_key_gemini'],
      (r) => {
        const loaded: Record<string, string> = {}
        for (const p of API_PROVIDERS) {
          if (r[`api_key_${p.id}`]) loaded[p.id] = r[`api_key_${p.id}`] as string
        }
        setKeys(loaded)
      }
    )
  }, [])

  const handleSave = (id: string) => {
    chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', provider: id, key: keys[id] ?? '' })
    setSaved(prev => ({ ...prev, [id]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [id]: false })), 2000)
  }

  const handleTest = async (id: string) => {
    const key = (keys[id] ?? '').trim()
    if (!key) { setTestResult(prev => ({ ...prev, [id]: '✗ Enter a key first' })); return }
    setTesting(prev => ({ ...prev, [id]: true }))
    setTestResult(prev => ({ ...prev, [id]: '' }))
    const ok = await testKey(id, key)
    setTesting(prev => ({ ...prev, [id]: false }))
    setTestResult(prev => ({ ...prev, [id]: ok ? '✓ Connected' : '✗ Failed — check key' }))
    setTimeout(() => setTestResult(prev => ({ ...prev, [id]: '' })), 5000)
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-2">Cortex Settings</h1>
      <p className="text-sm text-gray-500 mb-8">
        Add API keys to enable smart memory extraction. Keys are stored locally and never leave your browser.
      </p>

      <h2 className="text-lg font-semibold mb-4">API Keys for Memory Extraction</h2>

      <div className="flex flex-col gap-6">
        {API_PROVIDERS.map(p => (
          <div key={p.id} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{p.label}</label>
            <p className="text-xs text-gray-500">{p.hint}</p>
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1">
                <input
                  type={visible[p.id] ? 'text' : 'password'}
                  value={keys[p.id] ?? ''}
                  onChange={e => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder={p.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm pr-10 outline-none focus:ring-2 focus:ring-violet-500/30"
                />
                <button
                  onClick={() => setVisible(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  type="button"
                >
                  {visible[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button onClick={() => handleSave(p.id)} type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors flex items-center gap-1 shrink-0">
                {saved[p.id] && <CheckCircle size={13} />}
                {saved[p.id] ? 'Saved!' : 'Save'}
              </button>
              <button onClick={() => void handleTest(p.id)} type="button" disabled={!!testing[p.id]}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center gap-1 shrink-0 disabled:opacity-50">
                {testing[p.id] ? <Loader2 size={13} className="animate-spin" /> : null}
                {testing[p.id] ? 'Testing…' : 'Test ▶'}
              </button>
            </div>
            {testResult[p.id] && (
              <p className={`text-xs ${testResult[p.id]?.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                {testResult[p.id]}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
