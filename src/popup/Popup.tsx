import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { NavTabs } from './components/NavTabs';
import { OverviewView } from './views/OverviewView';
import { HistoryView } from './views/HistoryView';
import { AlertsView } from './views/AlertsView';

export function Popup() {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'alerts'>('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <div className="flex flex-col h-full w-full">
      <Header isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
      <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-3">
        {activeTab === 'overview' && <OverviewView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'alerts' && <AlertsView />}
      </main>

      <footer className="h-8 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 text-xs text-green-600 dark:text-green-500 bg-white dark:bg-gray-900 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          Live Sync Active
        </div>
      </footer>
    </div>
  );
}
