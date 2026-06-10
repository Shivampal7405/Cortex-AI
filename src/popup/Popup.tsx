import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NavTabs } from './components/NavTabs';
import { OverviewView } from './views/OverviewView';
import { HistoryView } from './views/HistoryView';
import { AlertsView } from './views/AlertsView';
import { MemoryView } from './views/MemoryView';
import { OnboardingView } from './views/OnboardingView';

export function Popup() {
  const [activeTab,      setActiveTab]      = useState<'overview' | 'memory' | 'history' | 'alerts'>('overview');
  const [isDarkMode,     setIsDarkMode]     = useState(false);
  const [hasNewFacts,    setHasNewFacts]    = useState(false);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.storage.local.get('onboarding_complete', (r) => {
      setOnboardingDone(Boolean(r['onboarding_complete']));
    });

    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }

    const handleMessage = (msg: { type: string }) => {
      if (msg.type === 'NEW_FACT_EXTRACTED') setHasNewFacts(true);
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (activeTab === 'memory') setHasNewFacts(false);
  }, [activeTab]);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else            document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // null = storage not yet read (brief blank avoids flicker)
  if (onboardingDone === null) return null;

  if (!onboardingDone) {
    return <OnboardingView onComplete={() => setOnboardingDone(true)} />;
  }

  return (
    <div className="flex flex-col h-full w-full">
      <Header isDarkMode={isDarkMode} onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} />
      <NavTabs activeTab={activeTab} onTabChange={setActiveTab} hasNewFacts={hasNewFacts} />

      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-3 relative">
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'memory'   && <MemoryView />}
        {activeTab === 'history'  && <HistoryView />}
        {activeTab === 'alerts'   && <AlertsView />}
      </main>

      <footer className="h-8 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 text-xs text-green-600 dark:text-green-500 bg-white dark:bg-gray-900 font-medium shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Live Sync Active
        </div>
      </footer>
    </div>
  );
}
