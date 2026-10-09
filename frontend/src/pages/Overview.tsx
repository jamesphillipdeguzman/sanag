import React from 'react';
import type { Municipality, DisasterEvent, GdacsAlert } from '@/types';
import HomeView from './HomeView';
import type { TabId } from '@/components/Navbar';

export interface OverviewProps {
  municipalities?: Municipality[];
  activeEvent?: DisasterEvent | null;
  events?: DisasterEvent[];
  onSelectEvent?: (id: string) => void;
  onDismissEvent?: () => void;
  selectedId?: string | null;
  onSelectMunicipality?: (id: string) => void;
  globalRank?: number | null;
  recoveryDate?: string | null;
  gdacsAlerts?: GdacsAlert[];
  onSimulateGdacs?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
  isGdacsLoading?: boolean;
  onRefreshGdacs?: () => void;
  importingGdacsId?: string | null;
  importedEventIds?: Set<string>;
  onNavigateTab?: (tab: TabId) => void;
  selectedRegionKey?: string;
  selectedMunicipality?: Municipality | null;
  totalLgusCount?: number;
  activeStationsCount?: number;
  isMapLoading?: boolean;
  onMunicipalitiesLoaded?: (items: Municipality[]) => void;
  onRegionChange?: (key: string) => void;
}

/**
 * Overview component acts as an alias / wrapper for HomeView
 * to preserve compatibility across existing component imports.
 */
export default function Overview(props: OverviewProps) {
  return (
    <HomeView
      activeEvent={props.activeEvent}
      events={props.events}
      onSelectEvent={props.onSelectEvent}
      onNavigateTab={props.onNavigateTab}
      selectedRegionKey={props.selectedRegionKey}
      selectedMunicipality={props.selectedMunicipality}
      selectedId={props.selectedId}
      gdacsAlerts={props.gdacsAlerts}
      onSimulateGdacs={props.onSimulateGdacs}
      isGdacsLoading={props.isGdacsLoading}
      onRefreshGdacs={props.onRefreshGdacs}
      importingGdacsId={props.importingGdacsId}
      importedEventIds={props.importedEventIds}
      totalLgusCount={props.totalLgusCount}
      activeStationsCount={props.activeStationsCount}
    />
  );
}