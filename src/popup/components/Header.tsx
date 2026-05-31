import { Moon, Sun, Settings } from 'lucide-react';
import browser from 'webextension-polyfill';

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function Header({ isDarkMode, onToggleDarkMode }: HeaderProps) {
  const openOptions = () => {
    browser.runtime.openOptionsPage();
  };

  return (
    <header className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-white dark:bg-gray-900 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
          C
        </div>
        <span className="font-semibold text-lg tracking-tight">Cortex</span>
      </div>
      
      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
        <button 
          onClick={onToggleDarkMode} 
          className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="Toggle dark mode"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button 
          onClick={openOptions}
          className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
