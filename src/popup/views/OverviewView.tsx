import { useState, useEffect } from 'react';
import { ProviderCard } from '../components/ProviderCard';
import type { ProviderState, ClaudeUsage, ChatGPTUsage, GeminiUsage, GrokUsage } from '../../shared/types';

type AnyProviderState = ProviderState<ClaudeUsage | ChatGPTUsage | GeminiUsage | GrokUsage>

export function OverviewView() {
  const [states, setStates] = useState<Record<string, AnyProviderState>>({});

  useEffect(() => {
    // Initial load
    chrome.storage.local.get([
      'provider:claude', 
      'provider:chatgpt', 
      'provider:gemini', 
      'provider:grok'
    ], (result) => {
      setStates(result);
    });

    // Listen for real-time updates
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      setStates(prev => {
        const next = { ...prev };
        let updated = false;
        for (const [key, { newValue }] of Object.entries(changes)) {
          if (key.startsWith('provider:')) {
            next[key] = newValue;
            updated = true;
          }
        }
        return updated ? next : prev;
      });
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Helper to safely extract state or provide a not_detected default
  const getState = (provider: string) => states[`provider:${provider}`] || { status: 'not_detected', data: null, last_updated: null };

  return (
    <div className="flex flex-col gap-2">
      <ProviderCard provider="claude" displayName="Claude" state={getState('claude') as ProviderState<ClaudeUsage>} />
      <ProviderCard provider="chatgpt" displayName="ChatGPT" state={getState('chatgpt') as ProviderState<ChatGPTUsage>} />
      <ProviderCard provider="gemini" displayName="Gemini" state={getState('gemini') as ProviderState<GeminiUsage>} />
      <ProviderCard provider="grok" displayName="Grok" state={getState('grok') as ProviderState<GrokUsage>} />
    </div>
  );
}
