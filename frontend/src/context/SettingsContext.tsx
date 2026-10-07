import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTheme, type Theme } from './ThemeContext';
import { audioSpatialIndicator } from '@/utils/audioSpatialIndicator';

export type BasemapSource = 'harmonized' | 'black-marble' | 'viirs-night-lights';
export type InteractionMode = 'interactive' | 'locked';
export type RenderingEngine = 'canvas' | 'svg';

export interface UserSettings {
  defaultRegion: string;
  basemapSource: BasemapSource;
  defaultNightGlow: boolean;
  showScaleRuler: boolean;
  scaleCalibration: number; // Multiplier: 1.0 = nominal 500m/pixel (1 DNB = 500m)
  audioFeedback: boolean;
  defaultInteractionMode: InteractionMode;
  renderingEngine: RenderingEngine;
  theme: Theme;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultRegion: 'panay',
  basemapSource: 'harmonized',
  defaultNightGlow: false,
  showScaleRuler: false,
  scaleCalibration: 1.0,
  audioFeedback: true,
  defaultInteractionMode: 'interactive',
  renderingEngine: 'canvas',
  theme: 'dark',
};

const SETTINGS_STORAGE_KEY = 'sanag_dashboard_settings';

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (partial: Partial<UserSettings>) => void;
  resetToDefaults: () => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function loadSavedSettings(currentTheme?: Theme): UserSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS, theme: currentTheme || 'dark' };
  }

  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        defaultRegion: typeof parsed.defaultRegion === 'string' ? parsed.defaultRegion : DEFAULT_SETTINGS.defaultRegion,
        basemapSource: ['harmonized', 'black-marble', 'viirs-night-lights'].includes(parsed.basemapSource)
          ? parsed.basemapSource
          : DEFAULT_SETTINGS.basemapSource,
        defaultNightGlow: typeof parsed.defaultNightGlow === 'boolean' ? parsed.defaultNightGlow : DEFAULT_SETTINGS.defaultNightGlow,
        showScaleRuler: typeof parsed.showScaleRuler === 'boolean' ? parsed.showScaleRuler : DEFAULT_SETTINGS.showScaleRuler,
        scaleCalibration:
          typeof parsed.scaleCalibration === 'number' && parsed.scaleCalibration >= 0.5 && parsed.scaleCalibration <= 2.0
            ? parsed.scaleCalibration
            : DEFAULT_SETTINGS.scaleCalibration,
        audioFeedback: typeof parsed.audioFeedback === 'boolean' ? parsed.audioFeedback : DEFAULT_SETTINGS.audioFeedback,
        defaultInteractionMode: ['interactive', 'locked'].includes(parsed.defaultInteractionMode)
          ? parsed.defaultInteractionMode
          : DEFAULT_SETTINGS.defaultInteractionMode,
        renderingEngine: ['canvas', 'svg'].includes(parsed.renderingEngine)
          ? parsed.renderingEngine
          : DEFAULT_SETTINGS.renderingEngine,
        theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : (currentTheme || 'dark'),
      };
    }
  } catch (err) {
    console.warn('Failed to parse saved SANAG settings from localStorage:', err);
  }

  return { ...DEFAULT_SETTINGS, theme: currentTheme || 'dark' };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>(() => loadSavedSettings(theme));
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Keep settings theme in sync if theme changes externally (e.g. from navbar theme toggle)
  useEffect(() => {
    setSettings((prev) => (prev.theme === theme ? prev : { ...prev, theme }));
  }, [theme]);

  // Apply audioFeedback setting to global audioSpatialIndicator
  useEffect(() => {
    if (settings.audioFeedback) {
      audioSpatialIndicator.start();
    } else {
      audioSpatialIndicator.stop();
    }
  }, [settings.audioFeedback]);

  // Persist settings whenever changed
  const saveToStorage = useCallback((newSettings: UserSettings) => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(newSettings));
    } catch (err) {
      console.warn('Failed to save SANAG settings to localStorage:', err);
    }
  }, []);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveToStorage(next);

        // Side effect: if theme is updated in settings, trigger ThemeContext
        if (key === 'theme' && (value === 'dark' || value === 'light')) {
          setTheme(value as Theme);
        }

        // Side effect: if basemapSource changes to black-marble, also turn on night glow if desired
        if (key === 'basemapSource' && value === 'black-marble') {
          next.defaultNightGlow = true;
          saveToStorage(next);
        }

        // Dispatch custom event for decoupled components to respond immediately
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sanag:setting-changed', {
              detail: { key, value, settings: next },
            })
          );
        }

        return next;
      });
    },
    [saveToStorage, setTheme]
  );

  const updateSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        saveToStorage(next);
        if (partial.theme && (partial.theme === 'dark' || partial.theme === 'light')) {
          setTheme(partial.theme);
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('sanag:settings-changed', {
              detail: { settings: next },
            })
          );
        }
        return next;
      });
    },
    [saveToStorage, setTheme]
  );

  const resetToDefaults = useCallback(() => {
    const fresh = { ...DEFAULT_SETTINGS, theme };
    setSettings(fresh);
    saveToStorage(fresh);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sanag:settings-reset', {
          detail: { settings: fresh },
        })
      );
    }
  }, [saveToStorage, theme]);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetToDefaults,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    const fallbackSettings = loadSavedSettings('dark');
    return {
      settings: fallbackSettings,
      updateSetting: () => {},
      updateSettings: () => {},
      resetToDefaults: () => {},
      isSettingsOpen: false,
      openSettings: () => {},
      closeSettings: () => {},
    };
  }
  return context;
}
