/**
 * OnboardingView.tsx
 * First-install onboarding flow — shown once, then dismissed forever.
 * Three steps: Welcome → Connect → Memory setup.
 * Sets onboarding_complete flag in chrome.storage.local when done.
 */

import { useState } from 'react'

const PROVIDERS = [
  { id: 'claude',  label: 'Claude',  url: 'https://claude.ai'          },
  { id: 'chatgpt', label: 'ChatGPT', url: 'https://chatgpt.com'        },
  { id: 'gemini',  label: 'Gemini',  url: 'https://gemini.google.com'  },
  { id: 'grok',    label: 'Grok',    url: 'https://x.com/i/grok'       },
] as const

interface Props { onComplete: () => void }

export function OnboardingView({ onComplete }: Props) {
  const [step, setStep] = useState(1)

  const finish = () => {
    chrome.storage.local.set({ onboarding_complete: true })
    onComplete()
  }

  const goToSettings = () => {
    chrome.runtime.openOptionsPage()
    finish()
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 p-6 items-center justify-center gap-6">

      {/* Step indicators */}
      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
            s === step ? 'bg-violet-600' : s < step ? 'bg-violet-300' : 'bg-gray-200 dark:bg-gray-700'
          }`} />
        ))}
      </div>

      {step === 1 && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">⚡</div>
          <h2 className="text-xl font-bold">Welcome to Cortex</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Cortex tracks your AI usage across Claude, ChatGPT, Gemini, and Grok — all in one place.
          </p>
          <button
            onClick={() => setStep(2)}
            className="w-full py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Get started →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-4 text-center w-full">
          <div className="text-4xl">🔗</div>
          <h2 className="text-xl font-bold">Connect your AIs</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visit your AI providers to start tracking usage.
          </p>

          <div className="grid grid-cols-2 gap-2 w-full">
            {PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => chrome.tabs.create({ url: p.url })}
                className="py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                Open {p.label}
              </button>
            ))}
          </div>

          <button onClick={() => setStep(3)} className="text-xs text-gray-400 hover:text-gray-500 transition-colors mt-1">
            Skip →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">🧠</div>
          <h2 className="text-xl font-bold">Smart Memory</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Add an API key to enable smart memory extraction across all your AI conversations.
          </p>
          <button
            onClick={goToSettings}
            className="w-full py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition-colors"
          >
            Go to Settings
          </button>
          <button onClick={finish} className="text-xs text-gray-400 hover:text-gray-500 transition-colors">
            Skip for now
          </button>
        </div>
      )}
    </div>
  )
}
