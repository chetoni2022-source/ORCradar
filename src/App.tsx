import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';

export type Theme = 'light' | 'dark';

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('orcradar-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('orcradar-theme', theme);
  }, [theme]);

  return (
    <div className="app-root">
      <HomePage
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
    </div>
  );
}
