import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  subscribeServerStatus,
  getServerStatus,
  checkServerHealth,
  fetchSystemStatus,
  type ServerStatusDetail,
  type ServerWakeStatus,
} from '@/services/apiService';
import {
  getActiveStationsCount,
  getStationsByProvince,
  type ProvinceStationGroup,
} from '@/data/transmissionStations';

export interface SystemTelemetryData {
  activeStationsCount: number;
  totalStationsCount: number;
  panayLgus: number;
  totalLgus: number;
  nationwideHubs: number;
  activeEventsCount?: number;
  stationsByProvince: ProvinceStationGroup[];
}

export interface ServerHealthContextType {
  status: ServerWakeStatus;
  isOnline: boolean;
  isWaking: boolean;
  isOffline: boolean;
  isReconnecting: boolean;
  isRefetching: boolean;
  hasConnectionError: boolean;
  attempt: number;
  maxRetries: number;
  secondsRemaining?: number;
  statusCode?: number;
  message?: string;
  error?: string | null;
  systemTelemetry: SystemTelemetryData;
  checkHealth: () => Promise<boolean>;
  refetchAll: () => Promise<boolean>;
  registerRefetchHandler: (id: string, handler: () => Promise<void> | void) => () => void;
  resetErrors: () => void;
  dismissBanner: () => void;
  isBannerDismissed: boolean;
}

const ServerHealthContext = createContext<ServerHealthContextType | undefined>(undefined);

export function ServerHealthProvider({ children }: { children: React.ReactNode }) {
  const [statusDetail, setStatusDetail] = useState<ServerStatusDetail>(() => getServerStatus());
  const [isRefetching, setIsRefetching] = useState<boolean>(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState<boolean>(false);
  const [systemTelemetry, setSystemTelemetry] = useState<SystemTelemetryData>(() => ({
    activeStationsCount: getActiveStationsCount(),
    totalStationsCount: 14,
    panayLgus: 95,
    totalLgus: 95,
    nationwideHubs: 187,
    stationsByProvince: getStationsByProvince(),
  }));

  const refetchHandlersRef = useRef<Map<string, () => Promise<void> | void>>(new Map());

  // Listen to global server status events emitted by apiFetch and checkServerHealth
  useEffect(() => {
    const unsubscribe = subscribeServerStatus((detail) => {
      setStatusDetail(detail);
      if (detail.status === 'ready') {
        setIsBannerDismissed(false);
      } else if (
        detail.status === 'waking' ||
        detail.status === 'disconnected' ||
        detail.status === 'error' ||
        (detail.statusCode && [502, 503, 504].includes(detail.statusCode))
      ) {
        // Automatically show banner when cold start or disconnect happens
        setIsBannerDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  const refreshTelemetry = useCallback(async () => {
    try {
      const data = await fetchSystemStatus();
      if (data) {
        setSystemTelemetry((prev) => ({
          activeStationsCount: data.active_stations_count ?? prev.activeStationsCount,
          totalStationsCount: data.total_stations_count ?? prev.totalStationsCount,
          panayLgus: data.panay_lgus_count ?? prev.panayLgus,
          totalLgus: data.total_lgus ?? prev.totalLgus,
          nationwideHubs: data.nationwide_hubs_count ?? prev.nationwideHubs,
          activeEventsCount: data.active_events_count ?? prev.activeEventsCount,
          stationsByProvince:
            data.stations_by_province && Array.isArray(data.stations_by_province) && data.stations_by_province.length > 0
              ? data.stations_by_province
              : prev.stationsByProvince,
        }));
      }
    } catch {
      // Safe fallback maintained
    }
  }, []);

  useEffect(() => {
    refreshTelemetry();
  }, [refreshTelemetry]);

  const registerRefetchHandler = useCallback(
    (id: string, handler: () => Promise<void> | void) => {
      refetchHandlersRef.current.set(id, handler);
      return () => {
        refetchHandlersRef.current.delete(id);
      };
    },
    []
  );

  const resetErrors = useCallback(() => {
    // Window custom event for any isolated components wanting to reset their local errors
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sanag:reset-errors'));
    }
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    return checkServerHealth();
  }, []);

  const refetchAll = useCallback(async (): Promise<boolean> => {
    setIsRefetching(true);
    resetErrors();

    try {
      // 1. Checks the backend health check endpoint (GET /api/health) and telemetry
      const [isHealthy] = await Promise.all([checkServerHealth(), refreshTelemetry()]);

      // 2. Resets error states across all data layers and triggers a refetch of active event data
      const handlerPromises = Array.from(refetchHandlersRef.current.values()).map(async (fn) => {
        try {
          await fn();
        } catch (err) {
          console.error('Refetch handler execution failed:', err);
        }
      });

      await Promise.allSettled(handlerPromises);

      if (isHealthy) {
        setIsBannerDismissed(true);
      }

      return isHealthy;
    } finally {
      setIsRefetching(false);
    }
  }, [resetErrors, refreshTelemetry]);

  const dismissBanner = useCallback(() => {
    setIsBannerDismissed(true);
  }, []);

  const isWaking = statusDetail.status === 'waking';
  const isOffline =
    statusDetail.status === 'disconnected' ||
    statusDetail.status === 'error' ||
    (statusDetail.statusCode !== undefined && [502, 503, 504].includes(statusDetail.statusCode));
  const isReconnecting = isWaking || isRefetching;
  const isOnline = statusDetail.status === 'ready' || (!isWaking && !isOffline);
  const hasConnectionError = isWaking || isOffline;

  const value = useMemo(
    () => ({
      status: statusDetail.status,
      isOnline,
      isWaking,
      isOffline,
      isReconnecting,
      isRefetching,
      hasConnectionError,
      attempt: statusDetail.attempt,
      maxRetries: statusDetail.maxRetries || 3,
      secondsRemaining: statusDetail.secondsRemaining,
      statusCode: statusDetail.statusCode,
      message: statusDetail.message,
      error: statusDetail.error,
      systemTelemetry,
      checkHealth,
      refetchAll,
      registerRefetchHandler,
      resetErrors,
      dismissBanner,
      isBannerDismissed,
    }),
    [
      statusDetail,
      isOnline,
      isWaking,
      isOffline,
      isReconnecting,
      isRefetching,
      hasConnectionError,
      systemTelemetry,
      checkHealth,
      refetchAll,
      registerRefetchHandler,
      resetErrors,
      dismissBanner,
      isBannerDismissed,
    ]
  );

  return (
    <ServerHealthContext.Provider value={value}>
      {children}
    </ServerHealthContext.Provider>
  );
}

export function useServerHealth(): ServerHealthContextType {
  const context = useContext(ServerHealthContext);
  if (!context) {
    throw new Error('useServerHealth must be used within a ServerHealthProvider');
  }
  return context;
}

export default useServerHealth;
