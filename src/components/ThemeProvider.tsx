'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAppSetting, setAppSetting } from '@/lib/appSettings';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_SETTING_KEY = 'dubbiovi_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    let isMounted = true;
    async function loadSavedTheme() {
      try {
        const savedTheme = await getAppSetting<Theme>(THEME_SETTING_KEY, 'dark');
        if (isMounted && (savedTheme === 'light' || savedTheme === 'dark')) {
          setThemeState(savedTheme);
          applyThemeClass(savedTheme);
        }
      } catch (err) {
        console.error('[ThemeProvider] Failed to load saved theme:', err);
      }
    }
    loadSavedTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  const applyThemeClass = (targetTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (targetTheme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    setAppSetting(THEME_SETTING_KEY, newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
