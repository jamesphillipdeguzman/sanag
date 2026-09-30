/**
 * Audio-Spatial Emergency Indicator for SANAG Dashboard
 * 
 * Synthesizes realistic nighttime cricket chirping sounds using pure Web Audio API
 * without relying on external audio assets.
 * 
 * Dynamic Status Mapping:
 * - 'critical' (Red Zone): Maximum intensity, rapid cadence (~400ms interval, 4-pulse syllables, loud)
 * - 'warning' (Yellow Zone): Moderate intensity, relaxed cadence (~1000ms interval, 2-pulse syllables)
 * - 'recovering' (Blue Zone): Faint intermittent chirps (~2400ms interval, 1 soft pulse)
 * - 'restored' (Green Zone): Completely muted (0 volume, no pulses scheduled)
 */

import { useEffect, useState, useCallback } from 'react';

export type EmergencyAudioStatus = 'critical' | 'warning' | 'recovering' | 'restored';

export interface AudioProfile {
  intervalMs: number;
  syllables: number;
  volume: number;
  frequency: number;
  label: string;
}

const PROFILES: Record<EmergencyAudioStatus, AudioProfile> = {
  critical: {
    intervalMs: 480,
    syllables: 4,
    volume: 0.08,
    frequency: 4700,
    label: 'Critical Outage (Ambient Chirping)',
  },
  warning: {
    intervalMs: 1200,
    syllables: 2,
    volume: 0.04,
    frequency: 4500,
    label: 'Limited Recovery (Soft Chirping)',
  },
  recovering: {
    intervalMs: 2600,
    syllables: 1,
    volume: 0.015,
    frequency: 4400,
    label: 'Substantial Recovery (Subtle)',
  },
  restored: {
    intervalMs: 0,
    syllables: 0,
    volume: 0.0,
    frequency: 4400,
    label: 'Fully Restored (Muted)',
  },
};

export class AudioSpatialIndicator {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bandpassFilter: BiquadFilterNode | null = null;
  private isEnabled: boolean = false;       // User explicit toggle ON/OFF
  private isHovered: boolean = false;       // Active pointer hovering on map component
  private currentStatus: EmergencyAudioStatus = 'restored';
  private timerId: number | null = null;
  private subscribers: Set<(active: boolean, status: EmergencyAudioStatus, isHovered: boolean, isPlaying: boolean) => void> = new Set();

  private initContext(): boolean {
    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) {
        console.warn('Web Audio API is not supported in this browser.');
        return false;
      }

      this.ctx = new AudioCtxClass();

      // Bandpass filter centered around natural cricket stridulation frequency (~4.6 kHz)
      this.bandpassFilter = this.ctx.createBiquadFilter();
      this.bandpassFilter.type = 'bandpass';
      this.bandpassFilter.frequency.setValueAtTime(4600, this.ctx.currentTime);
      this.bandpassFilter.Q.setValueAtTime(5, this.ctx.currentTime);

      // Master gain node with smooth fading and non-intrusive ambient ceiling
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

      this.bandpassFilter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      return true;
    } catch (err) {
      console.warn('Failed to initialize AudioContext:', err);
      return false;
    }
  }

  /**
   * Generates a single organic cricket syllable pulse
   */
  private playPulse(startTime: number, duration: number, freq: number, volume: number) {
    if (!this.ctx || !this.bandpassFilter) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Natural insect frequency micro-jitter (+/- 35 Hz)
    const jitter = (Math.random() - 0.5) * 70;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq + jitter, startTime);
    // Subtle upward sweep per wing stroke
    osc.frequency.linearRampToValueAtTime(freq + jitter + 100, startTime + duration);

    // Stridulation envelope: instant attack (3ms), exponential decay
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.bandpassFilter);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.004);
  }

  /**
   * Schedules a multi-syllable cricket chirp burst
   */
  private playChirpBurst(profile: AudioProfile) {
    if (!this.ctx || profile.syllables <= 0 || profile.volume <= 0) return;

    const now = this.ctx.currentTime;
    const pulseDuration = 0.018; // 18ms pulse
    const pulseGap = 0.014;      // 14ms inter-pulse gap

    for (let i = 0; i < profile.syllables; i++) {
      const pulseStart = now + i * (pulseDuration + pulseGap);
      this.playPulse(pulseStart, pulseDuration, profile.frequency, profile.volume);
    }
  }

  /**
   * Internal scheduler loop matching the active disaster recovery status.
   * Only chirps if user explicitly enabled audio AND pointer is currently hovering the map.
   */
  private scheduleNext() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (!this.isEnabled || !this.isHovered) return;

    const profile = PROFILES[this.currentStatus] || PROFILES.restored;

    // Green zone / restored: completely muted, no sound pulses
    if (profile.intervalMs <= 0 || profile.volume <= 0) {
      // Re-check periodically in case status changes
      this.timerId = window.setTimeout(() => this.scheduleNext(), 500);
      return;
    }

    this.playChirpBurst(profile);

    // Add natural randomness to chirp rhythm (+/- 15%)
    const variance = (Math.random() - 0.5) * 0.3 * profile.intervalMs;
    const nextInterval = Math.max(180, profile.intervalMs + variance);

    this.timerId = window.setTimeout(() => this.scheduleNext(), nextInterval);
  }

  /**
   * Internal engine starter when both enabled AND hovered
   */
  private startEngine() {
    if (!this.isEnabled || !this.isHovered) {
      this.stopEngine();
      return;
    }

    if (!this.initContext()) return;

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.scheduleNext();
  }

  /**
   * Internal engine stopper (suspends context and clears timers immediately)
   */
  private stopEngine() {
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  /**
   * Enables the audio feature explicitly
   */
  public start(initialStatus?: EmergencyAudioStatus) {
    if (initialStatus) {
      this.currentStatus = initialStatus;
    }

    this.isEnabled = true;
    if (this.isHovered) {
      this.startEngine();
    }
    this.notifySubscribers();
  }

  /**
   * Stops/mutes the audio-spatial indicator completely
   */
  public stop() {
    this.isEnabled = false;
    this.stopEngine();
    this.notifySubscribers();
  }

  /**
   * Toggles the audio indicator on/off explicitly
   */
  public toggle(status?: EmergencyAudioStatus): boolean {
    if (status) {
      this.currentStatus = status;
    }

    this.isEnabled = !this.isEnabled;

    if (this.isEnabled && this.isHovered) {
      this.startEngine();
    } else {
      this.stopEngine();
    }

    this.notifySubscribers();
    return this.isEnabled;
  }

  /**
   * Updates map hover focus.
   * Audio ONLY plays when isEnabled === true AND isHovered === true.
   */
  public setHovered(hovered: boolean) {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;

    if (this.isEnabled && this.isHovered) {
      this.startEngine();
    } else {
      this.stopEngine();
    }

    this.notifySubscribers();
  }

  /**
   * Dynamically updates the emergency status level
   */
  public setStatus(status: EmergencyAudioStatus) {
    if (this.currentStatus === status) return;
    this.currentStatus = status;

    if (this.isEnabled && this.isHovered) {
      // Immediate resync to new status profile
      this.scheduleNext();
    }
    this.notifySubscribers();
  }

  public getIsActive(): boolean {
    return this.isEnabled;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public getIsHovered(): boolean {
    return this.isHovered;
  }

  public getIsPlaying(): boolean {
    return this.isEnabled && this.isHovered && this.currentStatus !== 'restored';
  }

  public getStatus(): EmergencyAudioStatus {
    return this.currentStatus;
  }

  public getStatusLabel(): string {
    if (!this.isEnabled) {
      return 'Off';
    }
    if (!this.isHovered) {
      return 'Standby (Hover Map)';
    }
    return PROFILES[this.currentStatus]?.label ?? 'Muted';
  }

  public subscribe(callback: (active: boolean, status: EmergencyAudioStatus, isHovered: boolean, isPlaying: boolean) => void): () => void {
    this.subscribers.add(callback);
    callback(this.isEnabled, this.currentStatus, this.isHovered, this.getIsPlaying());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    const isPlaying = this.getIsPlaying();
    this.subscribers.forEach((cb) => {
      try {
        cb(this.isEnabled, this.currentStatus, this.isHovered, isPlaying);
      } catch (err) {
        console.error('AudioSpatialIndicator subscriber error:', err);
      }
    });
  }
}

// Global singleton instance for shared usage across map and toolbar
export const audioSpatialIndicator = new AudioSpatialIndicator();

/**
 * React hook to bind and control the Audio-Spatial Emergency Indicator
 */
export function useAudioSpatialIndicator(activeStatus?: EmergencyAudioStatus) {
  const [isActive, setIsActive] = useState<boolean>(() => audioSpatialIndicator.getIsActive());
  const [isHovered, setIsHovered] = useState<boolean>(() => audioSpatialIndicator.getIsHovered());
  const [isPlaying, setIsPlaying] = useState<boolean>(() => audioSpatialIndicator.getIsPlaying());
  const [status, setStatus] = useState<EmergencyAudioStatus>(() => audioSpatialIndicator.getStatus());

  useEffect(() => {
    const unsubscribe = audioSpatialIndicator.subscribe((active, currentStatus, hovered, playing) => {
      setIsActive(active);
      setStatus(currentStatus);
      setIsHovered(hovered);
      setIsPlaying(playing);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeStatus) {
      audioSpatialIndicator.setStatus(activeStatus);
    }
  }, [activeStatus]);

  const toggle = useCallback((forcedStatus?: EmergencyAudioStatus) => {
    return audioSpatialIndicator.toggle(forcedStatus || activeStatus);
  }, [activeStatus]);

  const setHovered = useCallback((hovered: boolean) => {
    audioSpatialIndicator.setHovered(hovered);
  }, []);

  const setAudioStatus = useCallback((newStatus: EmergencyAudioStatus) => {
    audioSpatialIndicator.setStatus(newStatus);
  }, []);

  return {
    isActive,
    isEnabled: isActive,
    isHovered,
    isPlaying,
    status,
    toggle,
    setHovered,
    setAudioStatus,
    statusLabel: audioSpatialIndicator.getStatusLabel(),
  };
}
