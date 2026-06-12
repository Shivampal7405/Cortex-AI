type Tab = 'overview' | 'memory' | 'history' | 'alerts' | 'prompts';

interface NavTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  hasNewFacts?: boolean;
}

export function NavTabs({ activeTab, onTabChange, hasNewFacts }: NavTabsProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'memory', label: 'Memory' },
    { id: 'history', label: 'History' },
    { id: 'prompts', label: 'Prompts' },
    { id: 'alerts', label: 'Alerts' },
  ];

  return (
    <nav className="h-10 flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`relative flex-1 flex items-center justify-center text-sm font-medium transition-colors border-b-2 ${
              isActive
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
            }`}
          >
            {tab.label}
            {tab.id === 'memory' && hasNewFacts && (
              <span className="absolute top-2 right-4 w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
