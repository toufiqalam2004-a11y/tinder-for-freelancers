import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  THEME_STORAGE_KEYS,
  COLOR_THEME_PRESETS,
  DEFAULT_CUSTOM_COLORS,
  resolveThemePalette,
} from '../utils/themePalettes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // 1. Brightness Mode: 'system' | 'light' | 'dark'
  const [themeMode, setThemeModeState] = useState(() => {
    try {
      const saved =
        localStorage.getItem(THEME_STORAGE_KEYS.BRIGHTNESS) ||
        localStorage.getItem('applyai_theme_mode');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'system';
  });

  // 2. Color Theme Palette: 'pink-beige' | 'blue-white' | ... | 'custom'
  const [colorTheme, setColorThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEYS.COLOR_THEME);
      if (saved) return saved;
    } catch {
      // fallback
    }
    return 'pink-beige';
  });

  // 3. User Custom Colors
  const [customColors, setCustomColorsState] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEYS.CUSTOM_COLORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CUSTOM_COLORS, ...parsed };
      }
    } catch {
      // fallback
    }
    return DEFAULT_CUSTOM_COLORS;
  });

  // Helper to determine if system preference is dark
  const getSystemDark = () => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  // 4. Effective Brightness: 'light' | 'dark'
  const [effectiveTheme, setEffectiveTheme] = useState(() => {
    if (themeMode === 'light') return 'light';
    if (themeMode === 'dark') return 'dark';
    return getSystemDark() ? 'dark' : 'light';
  });

  // Active resolved palette
  const activePalette = useMemo(() => {
    return resolveThemePalette(effectiveTheme, colorTheme, customColors);
  }, [effectiveTheme, colorTheme, customColors]);

  // Apply classes and CSS design token variables to document.documentElement
  const applyThemeToDOM = useCallback((brightness, colorId, colors) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    // A. Brightness mode classes
    if (brightness === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }

    // B. Color theme attribute
    root.setAttribute('data-color-theme', colorId);

    // C. Dynamic Design Token CSS Variables
    const palette = resolveThemePalette(brightness, colorId, colors);

    const tokenMap = {
      '--brand-primary': palette.primary,
      '--color-primary': palette.primary,
      '--brand-primary-hover': palette.primaryHover,
      '--color-primary-hover': palette.primaryHover,
      '--brand-primary-light': palette.primaryHover,
      '--brand-secondary': palette.secondary,
      '--color-secondary': palette.secondary,
      '--brand-background': palette.background,
      '--color-background': palette.background,
      '--brand-surface': palette.surface,
      '--color-surface': palette.surface,
      '--brand-surface-hover': palette.surfaceHover,
      '--color-surface-hover': palette.surfaceHover,
      '--brand-text': palette.textPrimary,
      '--color-text-primary': palette.textPrimary,
      '--brand-text-secondary': palette.textSecondary,
      '--color-text-secondary': palette.textSecondary,
      '--brand-border': palette.border,
      '--color-border': palette.border,
      '--brand-accent': palette.accent,
      '--color-accent': palette.accent,
      '--color-primary-glow': `${palette.primary}33`,
      '--brand-primary-soft': `${palette.primary}1F`,
    };

    Object.entries(tokenMap).forEach(([prop, val]) => {
      if (val) {
        root.style.setProperty(prop, val);
      }
    });
  }, []);

  // Synchronize effective brightness and DOM
  useEffect(() => {
    let active = 'dark';
    if (themeMode === 'light') {
      active = 'light';
    } else if (themeMode === 'dark') {
      active = 'dark';
    } else {
      active = getSystemDark() ? 'dark' : 'light';
    }

    setEffectiveTheme(active);
    applyThemeToDOM(active, colorTheme, customColors);

    // Listen for system theme changes if in 'system' mode
    if (themeMode === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e) => {
        const nextTheme = e.matches ? 'dark' : 'light';
        setEffectiveTheme(nextTheme);
        applyThemeToDOM(nextTheme, colorTheme, customColors);
      };

      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    }
  }, [themeMode, colorTheme, customColors, applyThemeToDOM]);

  // Set Brightness Mode ('light' | 'dark' | 'system')
  const setThemeMode = useCallback((mode) => {
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') return;
    setThemeModeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEYS.BRIGHTNESS, mode);
    } catch (err) {
      console.error('Failed to save brightness theme:', err);
    }
  }, []);

  // Set Color Theme Preset ('pink-beige' | 'blue-white' | ... | 'custom')
  const setColorTheme = useCallback((themeId) => {
    setColorThemeState(themeId);
    try {
      localStorage.setItem(THEME_STORAGE_KEYS.COLOR_THEME, themeId);
    } catch (err) {
      console.error('Failed to save color theme:', err);
    }
  }, []);

  // Update Custom Colors
  const setCustomColors = useCallback((newColors) => {
    setCustomColorsState((prev) => {
      const updated = typeof newColors === 'function' ? newColors(prev) : { ...prev, ...newColors };
      try {
        localStorage.setItem(THEME_STORAGE_KEYS.CUSTOM_COLORS, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save custom colors:', err);
      }
      return updated;
    });
  }, []);

  // Reset Custom Colors to Default
  const resetCustomColors = useCallback(() => {
    setCustomColorsState(DEFAULT_CUSTOM_COLORS);
    setColorThemeState('pink-beige');
    try {
      localStorage.setItem(THEME_STORAGE_KEYS.CUSTOM_COLORS, JSON.stringify(DEFAULT_CUSTOM_COLORS));
      localStorage.setItem(THEME_STORAGE_KEYS.COLOR_THEME, 'pink-beige');
    } catch (err) {
      console.error('Failed to reset custom colors:', err);
    }
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        theme: themeMode,
        effectiveTheme,
        activeTheme: effectiveTheme,
        setThemeMode,
        colorTheme,
        setColorTheme,
        customColors,
        setCustomColors,
        resetCustomColors,
        activePalette,
        presets: COLOR_THEME_PRESETS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
