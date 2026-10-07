import React, { useEffect, useRef } from 'react';
import {
  X,
  RotateCcw,
  MapPin,
  Compass,
  Ruler,
  Layers,
  Sparkles,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Cpu,
  Sliders,
  Check,
  Info,
} from 'lucide-react';
import { useSettings, type BasemapSource, type InteractionMode, type RenderingEngine } from '@/context/SettingsContext';
import { REGION_PRESETS } from './PanayMap';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SettingsModal({ isOpen: externalIsOpen, onClose: externalOnClose }: SettingsModalProps) {
  const {
    settings,
    updateSetting,
    resetToDefaults,
    isSettingsOpen: contextIsOpen,
    closeSettings: contextCloseSettings,
  } = useSettings();

  const isOpen = externalIsOpen ?? contextIsOpen;
  const onClose = externalOnClose ?? contextCloseSettings;
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-2xl shadow-black/40 text-slate-900 dark:text-slate-100 animate-scale-in transition-colors"
      >
        {/* Subtle Ambient Header Glow */}
        <div className="absolute -top-16 left-1/3 w-80 h-24 bg-ocean-500/10 dark:bg-ocean-400/15 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute -top-16 right-1/4 w-60 h-24 bg-amber-500/10 dark:bg-amber-400/10 blur-3xl pointer-events-none rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/40 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-500/15 border border-ocean-500/30 text-ocean-600 dark:text-ocean-400 shadow-sm">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                SANAG Preferences & Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
                Customize map rendering, default scopes, and sensory telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToDefaults}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 border border-transparent hover:border-slate-300 dark:hover:border-white/10 transition-all cursor-pointer"
              title="Reset all settings to default values"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close settings modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* ────────────────── SECTION 1: MAP PREFERENCES ────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-white/10">
              <Compass className="h-4 w-4 text-ocean-600 dark:text-ocean-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-ocean-700 dark:text-ocean-300">
                Map Preferences
              </h3>
            </div>

            {/* Default Map Region Dropdown */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <label htmlFor="settings-default-region" className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer">
                  <MapPin className="h-4 w-4 text-ocean-500" />
                  Default Map Region
                </label>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Select which geographic boundary chunk loads and centers automatically on startup
                </p>
              </div>

              <select
                id="settings-default-region"
                value={settings.defaultRegion}
                onChange={(e) => updateSetting('defaultRegion', e.target.value)}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-ocean-500 cursor-pointer min-w-[210px]"
              >
                <optgroup label="Primary Scope">
                  <option value="panay">Panay Island (Default)</option>
                  <option value="iloilo">↳ Iloilo Province</option>
                  <option value="capiz">↳ Capiz Province</option>
                  <option value="aklan">↳ Aklan Province</option>
                  <option value="antique">↳ Antique Province</option>
                </optgroup>
                <optgroup label="Nationwide">
                  <option value="philippines">Nationwide (Philippines)</option>
                </optgroup>
                <optgroup label="Luzon">
                  <option value="ncr">NCR (Metro Manila)</option>
                  <option value="r3">Region III (Central Luzon)</option>
                  <option value="r4a">Region IV-A (CALABARZON)</option>
                  <option value="r5">Region V (Bicol Region)</option>
                </optgroup>
                <optgroup label="Visayas & Mindanao">
                  <option value="r7">Region VII (Central Visayas)</option>
                  <option value="r8">Region VIII (Eastern Visayas)</option>
                  <option value="r6_negros">Region VI (Negros Occidental)</option>
                  <option value="r11">Region XI (Davao Region)</option>
                  <option value="r10">Region X (Northern Mindanao)</option>
                </optgroup>
              </select>
            </div>

            {/* Default Interaction Mode */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-emerald-500" />
                  Default Interaction Mode
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Allow immediate scroll/pan interaction on load or keep locked until tapped
                </p>
              </div>

              <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-950/70 p-1 border border-slate-300 dark:border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => updateSetting('defaultInteractionMode', 'interactive')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.defaultInteractionMode === 'interactive'
                    ? 'bg-white dark:bg-slate-800 text-ocean-600 dark:text-ocean-300 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Interactive
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('defaultInteractionMode', 'locked')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.defaultInteractionMode === 'locked'
                    ? 'bg-white dark:bg-slate-800 text-ocean-600 dark:text-ocean-300 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Locked
                </button>
              </div>
            </div>

            {/* Scale Ruler Toggle */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Ruler className="h-4 w-4 text-sky-500" />
                  VIIRS Scale Ruler
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Pin the dual-axis 500m VIIRS ground resolution pixel scale permanently on the map
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.showScaleRuler}
                onClick={() => updateSetting('showScaleRuler', !settings.showScaleRuler)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ocean-500/50 ${settings.showScaleRuler ? 'bg-ocean-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${settings.showScaleRuler ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* VIIRS Scale Calibration (Base pixel-to-meter ratio: 1 DNB = 500m) */}
            <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <label htmlFor="settings-scale-calibration" className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer">
                    <Sliders className="h-4 w-4 text-sky-500" />
                    VIIRS Scale Calibration
                  </label>
                  <p className="text-xs text-slate-500 dark:text-ink-400">
                    Fine-tune the NASA DNB spatial resolution ratio (defaulting to 1 DNB = 500m)
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                    1 DNB = {Math.round(500 * (settings.scaleCalibration || 1.0))}m
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-ink-400">
                    ({(settings.scaleCalibration || 1.0).toFixed(2)}x)
                  </span>
                </div>
              </div>

              {/* Slider Input */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-slate-400">375m (0.75x)</span>
                  <input
                    id="settings-scale-calibration"
                    type="range"
                    min="0.75"
                    max="1.50"
                    step="0.05"
                    value={settings.scaleCalibration || 1.0}
                    onChange={(e) => updateSetting('scaleCalibration', parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  />
                  <span className="text-[10px] font-mono text-slate-400">750m (1.50x)</span>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-400 mr-1">Presets:</span>
                  {[
                    { label: '0.8x (400m)', value: 0.8 },
                    { label: '1.0x (500m Nominal)', value: 1.0 },
                    { label: '1.2x (600m)', value: 1.2 },
                    { label: '1.5x (750m Nadir)', value: 1.5 },
                  ].map((preset) => {
                    const isActive = Math.abs((settings.scaleCalibration || 1.0) - preset.value) < 0.01;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => updateSetting('scaleCalibration', preset.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-all cursor-pointer ${isActive
                          ? 'bg-sky-500 text-white shadow-xs'
                          : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-ink-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                          }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {Math.abs((settings.scaleCalibration || 1.0) - 1.0) >= 0.01 && (
                    <button
                      type="button"
                      onClick={() => updateSetting('scaleCalibration', 1.0)}
                      className="ml-auto text-[10px] text-ocean-600 dark:text-ocean-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                      title="Reset scale ratio to 1 DNB = 500m nominal"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Reset to 500m</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ────────────────── SECTION 2: VISUAL LAYERS ────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-white/10">
              <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Visual Layers
              </h3>
            </div>

            {/* Basemap & Imagery Source Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <label htmlFor="settings-basemap-source" className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 cursor-pointer">
                  <Layers className="h-4 w-4 text-amber-500" />
                  Basemap & Imagery Source
                </label>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Select baseline satellite radiance model and tile imagery provider
                </p>
              </div>

              <select
                id="settings-basemap-source"
                value={settings.basemapSource}
                onChange={(e) => updateSetting('basemapSource', e.target.value as BasemapSource)}
                className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white text-xs font-semibold shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer min-w-[210px]"
              >
                <option value="harmonized">Harmonized Orbital Basemap</option>
                <option value="black-marble">NASA Black Marble Composite</option>
                <option value="viirs-night-lights">Realistic VIIRS Night Lights</option>
              </select>
            </div>

            {/* Default Night Glow Toggle */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  Realistic Night Glow on Startup
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Automatically activate the NASA Black Marble orbital night-light radiance effect on boot
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.defaultNightGlow}
                onClick={() => updateSetting('defaultNightGlow', !settings.defaultNightGlow)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${settings.defaultNightGlow ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${settings.defaultNightGlow ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Theme Preset Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {settings.theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
                  Theme Preset
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Switch application color scheme between High-Contrast Dark and Clean Light
                </p>
              </div>

              <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-950/70 p-1 border border-slate-300 dark:border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => updateSetting('theme', 'dark')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.theme === 'dark'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('theme', 'light')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.theme === 'light'
                    ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
              </div>
            </div>
          </section>

          {/* ────────────────── SECTION 3: AUDIO & ENGINE ────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-white/10">
              <Cpu className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Audio & Engine
              </h3>
            </div>

            {/* Audio Feedback Toggle */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  {settings.audioFeedback ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
                  Audio-Spatial Feedback
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Synthesize nighttime ambient cricket cadence calibrated to municipal disaster outage severity
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.audioFeedback}
                onClick={() => updateSetting('audioFeedback', !settings.audioFeedback)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${settings.audioFeedback ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${settings.audioFeedback ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Rendering Engine Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/5">
              <div className="space-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-sky-500" />
                  Rendering Engine
                </span>
                <p className="text-xs text-slate-500 dark:text-ink-400">
                  Canvas 2D optimizes 60 FPS polygon rendering for large nationwide boundaries
                </p>
              </div>

              <div className="inline-flex rounded-lg bg-slate-200/80 dark:bg-slate-950/70 p-1 border border-slate-300 dark:border-white/10 shrink-0">
                <button
                  type="button"
                  onClick={() => updateSetting('renderingEngine', 'canvas')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.renderingEngine === 'canvas'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  Canvas 2D
                </button>
                <button
                  type="button"
                  onClick={() => updateSetting('renderingEngine', 'svg')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${settings.renderingEngine === 'svg'
                    ? 'bg-white dark:bg-slate-800 text-sky-600 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-ink-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  SVG Vector
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-ink-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Preferences auto-save to local storage</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={resetToDefaults}
              className="sm:hidden px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white rounded-lg border border-slate-300 dark:border-white/10 cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-500 hover:to-ocean-400 rounded-lg shadow-sm shadow-ocean-500/20 transition-all cursor-pointer w-full sm:w-auto text-center"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
