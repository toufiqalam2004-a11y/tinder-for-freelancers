import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

export default function ThemeSelector() {
  const { themeMode, effectiveTheme, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Options specified in requirement:
  // ☀️ Light
  // 🌙 Dark
  // ⚙️ System Default
  const THEME_OPTIONS = [
    {
      id: 'light',
      label: 'Light',
      icon: Sun,
      symbol: '☀️',
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: Moon,
      symbol: '🌙',
    },
    {
      id: 'system',
      label: 'System Default',
      icon: Laptop,
      symbol: '⚙️',
    },
  ];

  // Icon for the main trigger button based on active mode
  const getTriggerIcon = () => {
    if (themeMode === 'light') {
      return <Sun size={18} className="text-amber-500 transition-transform hover:rotate-45 duration-300" />;
    }
    if (themeMode === 'dark') {
      return <Moon size={18} className="text-violet-400 transition-transform hover:-rotate-12 duration-300" />;
    }
    return <Laptop size={18} className="text-text-secondary transition-colors" />;
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Theme Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center text-text-primary hover:bg-surface-hover hover:border-primary/40 transition-all shadow-sm active:scale-95"
        aria-label="Theme Settings"
        title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
      >
        {getTriggerIcon()}
      </button>

      {/* Popover Dropdown (Polished and Minimal) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-2 w-48 rounded-2xl bg-surface border border-border shadow-elevated p-1.5 z-50 overflow-hidden"
          >
            <div className="px-2.5 py-1.5 border-b border-border/50 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                Appearance
              </span>
            </div>

            <div className="space-y-0.5">
              {THEME_OPTIONS.map((option) => {
                const isSelected = themeMode === option.id;
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setThemeMode(option.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-primary/15 text-primary-light font-semibold'
                        : 'text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none">{option.symbol}</span>
                      <span>{option.label}</span>
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-primary-light stroke-[2.5]" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
