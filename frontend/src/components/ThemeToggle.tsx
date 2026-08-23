import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../store';

export default function ThemeToggle() {
  const { isDark, toggle } = useThemeStore();

  return (
    <button
      id="theme-toggle"
      onClick={toggle}
      className="p-2 rounded-xl text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950/30 transition-all"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
