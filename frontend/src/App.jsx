import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import EventTimeline from './components/EventTimeline.tsx'
import Footer from './components/Footer.tsx'
import MunicipalityTable from './components/MunicipalityTable.tsx'
import Navbar from './components/Navbar.tsx'
import Overview from './pages/Overview.tsx'
import PanayMap from './components/PanayMap.tsx'
import EventSelectorPanel from './components/EventSelectorPanel.tsx'
import GuideGlossary from './components/GuideGlossary.tsx'
import RecoveryChart from './components/RecoveryChart.tsx'
import ServerStatusBanner from './components/ServerStatusBanner.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { apiFetch, setHasLocalFallbackData, safeJsonParse } from './services/apiService.ts'
import { useServerHealth } from './context/ServerHealthContext.tsx'
import { createMunicipalities, events as mockEvents, PRIMARY_EVENT_ID } from './data/mockData.ts'
import {
  isPanayRegion,
  isNationwideRegion,
  isPanayExclusiveEvent,
  getRegionDisplayName,
} from './utils/eventScope.ts'
import './App.css'

const VALID_TABS = ['overview', 'map', 'recovery', 'events', 'guide']

function getTabFromHash() {
  if (typeof window === 'undefined') return 'overview'
  const hash = window.location.hash.replace(/^#/, '').toLowerCase().trim()
  return VALID_TABS.includes(hash) ? hash : 'overview'
}

function normalizeMunicipalityName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function applyRecoveryScores(municipalities, records, startDate, endDate) {
  const worstByPcode = new Map()
  const worstByName = new Map()

  records
    .filter((record) => {
      if (record.r_t === null || record.r_t === undefined) return false
      const recDate = record.date || record.observation_date
      if (startDate && recDate && recDate < startDate) return false
      if (endDate && recDate && recDate > endDate) return false
      return true
    })
    .forEach((record) => {
      const recDate = record.date || record.observation_date || ''
      const entry = { ...record, date: recDate }
      const rt = Number(record.r_t)

      const updateWorst = (map, key) => {
        const current = map.get(key)
        if (!current || rt < Number(current.r_t)) {
          map.set(key, entry)
        }
      }

      if (record.pcode && record.pcode !== 'UNKNOWN') {
        updateWorst(worstByPcode, record.pcode)
      }
      if (record.municipality_pcode && record.municipality_pcode !== 'UNKNOWN') {
        updateWorst(worstByPcode, record.municipality_pcode)
      }
      if (record.municipality_name) {
        const normName = record.municipality_name.toLowerCase().trim()
        const cleanName = normalizeMunicipalityName(record.municipality_name)
        updateWorst(worstByName, normName)
        if (cleanName) updateWorst(worstByName, cleanName)
      }
    })

  return municipalities.map((municipality) => {
    const pcode = municipality.pcode || municipality.id
    const rawName = (municipality.name || '').toLowerCase().trim()
    const cleanName = normalizeMunicipalityName(municipality.name)

    const score =
      (pcode ? worstByPcode.get(pcode) : null) ||
      (municipality.id ? worstByPcode.get(municipality.id) : null) ||
      worstByName.get(rawName) ||
      (cleanName ? worstByName.get(cleanName) : null)

    if (!score) {
      return {
        ...municipality,
        recoveryScore: municipality.recoveryScore ?? 100,
        status: municipality.status ?? 'restored',
        baselineRadiance: municipality.baselineRadiance ?? 0,
        currentRadiance: municipality.currentRadiance ?? 0,
        estimatedDaysToRecover: 0,
        recoveryDate: municipality.recoveryDate ?? null,
      }
    }

    const recoveryScore = Math.max(0, Math.min(100, Math.round(score.r_t * 100)))
    const status = recoveryScore >= 90 ? 'restored' : recoveryScore >= 60 ? 'recovering' : recoveryScore >= 40 ? 'warning' : 'critical'

    return {
      ...municipality,
      recoveryScore,
      status,
      baselineRadiance: score.baseline_radiance ?? municipality.baselineRadiance,
      currentRadiance: score.daily_radiance ?? score.post_event_radiance ?? municipality.currentRadiance,
      daysSinceEvent: Math.max(0, Math.round((Date.now() - new Date(score.date).getTime()) / 86400000)),
      estimatedDaysToRecover: recoveryScore >= 90 ? 0 : Math.max(1, Math.round((100 - recoveryScore) / 8)),
      recoveryDate: score.date,
    }
  })
}

function mapApiEvent(event) {
  const rawCat = (event.category || event.type || '').toLowerCase()
  let type = 'blackout'
  if (rawCat.includes('grid') || rawCat === 'grid_failure') {
    type = 'grid_failure'
  } else if (rawCat.includes('monsoon') || rawCat === 'monsoon_flood') {
    type = 'monsoon_flood'
  } else if (rawCat.includes('flood')) {
    type = 'monsoon_flood'
  } else if (rawCat.includes('typhoon') || rawCat.includes('cyclone')) {
    type = 'typhoon'
  } else if (rawCat.includes('earthquake')) {
    type = 'earthquake'
  }

  const mockMatch = mockEvents.find((e) => e.id === String(event.id) || e.name === event.name)
  const affectedPopulation = Number(
    event.affected_population ?? event.affectedPopulation ?? mockMatch?.affectedPopulation ?? 0
  )

  const alertLevel = event.alert_level || (event.severity === 'Severe' ? 'Red' : event.severity === 'High' ? 'Orange' : 'Green')
  const severity = event.severity || (alertLevel === 'Red' ? 'Severe' : alertLevel === 'Orange' ? 'High' : 'Moderate')

  const eventDate = event.startDate || event.start_date || event.date || ''
  const computedEndDate = event.endDate || event.end_date || (eventDate ? formatIsoDate(addDays(eventDate, 30)) : '')

  return {
    id: String(event.id),
    name: event.name,
    date: eventDate,
    startDate: eventDate,
    endDate: computedEndDate,
    severity,
    type: event.type || type,
    affectedPopulation,
    description: event.description ?? mockMatch?.description ?? 'No description available.',
    category: event.category || event.type,
    alert_level: alertLevel,
    viirs_data_available: event.viirs_data_available ?? true,
    critical_municipalities: event.critical_municipalities ?? [],
    resource_url: event.resource_url || mockMatch?.resource_url,
  }
}

function formatIsoDate(dateString) {
  if (!dateString) return ''
  const clean = String(dateString).trim()
  if (clean.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10)
  }
  const parsed = new Date(clean)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return clean
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysSince(dateString) {
  const start = new Date(`${dateString}T00:00:00Z`)
  const today = new Date()
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.max(0, Math.floor((todayUtc - start.getTime()) / 86400000))
}

function App() {
  const [municipalities, setMunicipalities] = useState([])
  const [events, setEvents] = useState(() => {
    return [...mockEvents].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || 0).getTime() || 0
      const dateB = new Date(b.startDate || b.date || 0).getTime() || 0
      return dateB - dateA
    })
  })
  const [selectedId, setSelectedId] = useState(null)
  const [activeEventId, setActiveEventId] = useState(() => {
    const sorted = [...mockEvents].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || 0).getTime() || 0
      const dateB = new Date(b.startDate || b.date || 0).getTime() || 0
      return dateB - dateA
    })
    return sorted[0]?.id || PRIMARY_EVENT_ID
  })
  const [eventsError, setEventsError] = useState('')
  const [recoveryDate, setRecoveryDate] = useState(null)
  const [latestObservationDate, setLatestObservationDate] = useState(null)
  const [recoveryRecords, setRecoveryRecords] = useState([])
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [recoveryDateRange, setRecoveryDateRange] = useState(null)
  const [selectedRegionKey, setSelectedRegionKey] = useState('panay')
  const [activeTab, setActiveTab] = useState(getTabFromHash)

  // Synchronize tab state with URL hash
  const handleSelectTab = useCallback((tab) => {
    if (!VALID_TABS.includes(tab)) return
    setActiveTab(tab)
    if (typeof window !== 'undefined' && window.location.hash !== `#${tab}`) {
      window.history.replaceState(null, '', `#${tab}`)
    }
  }, [])

  // Listen to hashchange events (e.g. browser navigation, direct hash changes)
  useEffect(() => {
    const onHashChange = () => {
      const tab = getTabFromHash()
      setActiveTab(tab)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Invalidate Leaflet map size whenever Map tab becomes active to prevent tile clipping
  useEffect(() => {
    if (activeTab === 'map') {
      const timer1 = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sanag:invalidate-map-size'))
        window.dispatchEvent(new Event('resize'))
      }, 50)
      const timer2 = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('sanag:invalidate-map-size'))
        window.dispatchEvent(new Event('resize'))
      }, 200)
      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
      }
    }
  }, [activeTab])

  // GDACS live feeds & simulation state
  const [gdacsAlerts, setGdacsAlerts] = useState([])
  const [isGdacsLoading, setIsGdacsLoading] = useState(false)
  const [importingId, setImportingId] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  const geojsonFeaturesRef = useRef(null)

  // Register useServerHealth refetch handler hook
  const { registerRefetchHandler } = useServerHealth()

  // Notify apiService that initial mock/fallback dataset is available
  useEffect(() => {
    setHasLocalFallbackData(true)
  }, [])

  const fetchGdacsAlerts = useCallback(async () => {
    setIsGdacsLoading(true)
    try {
      const res = await apiFetch('/api/v1/gdacs/alerts')
      if (!res.ok) throw new Error(`GDACS request failed: ${res.status}`)
      const payload = await safeJsonParse(res)
      if (payload?.alerts) {
        const sortedAlerts = [...payload.alerts].sort((a, b) => {
          const dateA = new Date(a.fromdate || a.startDate || a.date || a.pubDate || 0).getTime() || 0
          const dateB = new Date(b.fromdate || b.startDate || b.date || b.pubDate || 0).getTime() || 0
          return dateB - dateA
        })
        setGdacsAlerts(sortedAlerts)
      }
    } catch (err) {
      console.error('Failed to load GDACS live feed:', err)
    } finally {
      setIsGdacsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGdacsAlerts()
  }, [fetchGdacsAlerts])

  const importedEventIds = useMemo(() => {
    return new Set(events.map((e) => String(e.id)))
  }, [events])

  const handleSelectEvent = useCallback((eventId) => {
    setActiveEventId(eventId)
    const targetEvent = events.find((e) => String(e.id) === String(eventId))
    if (targetEvent) {
      const sDate = formatIsoDate(targetEvent.startDate || targetEvent.date)
      if (sDate) {
        // Automatically set Start date to event's recorded start date,
        // and End date to targetEvent.endDate or exactly 30 days after start date
        const eDate = targetEvent.endDate ? formatIsoDate(targetEvent.endDate) : formatIsoDate(addDays(sDate, 30))
        setRecoveryDateRange({ eventId: targetEvent.id, startDate: sDate, endDate: eDate })
      }
    }
  }, [events])

  const handleImportGdacs = useCallback(async (alert, preconstructedEvent) => {
    if (!alert) return

    const rawAlertId = alert.event_id != null ? String(alert.event_id) : ''
    const alertId = alert.id ? String(alert.id) : (rawAlertId ? `gdacs-${rawAlertId}` : `gdacs-sim-${Date.now()}`)
    const normAlertName = (alert.name || '').toLowerCase().trim()

    // Guard: Check if event already exists in the active events list
    const existingEvent = events.find((e) => {
      const eId = String(e.id)
      const eNameNorm = (e.name || '').toLowerCase().trim()
      return (
        (alertId && (eId === alertId || `gdacs-${eId}` === alertId)) ||
        (rawAlertId && (eId === rawAlertId || eId === `gdacs-${rawAlertId}`)) ||
        (normAlertName && eNameNorm === normAlertName)
      )
    })

    if (existingEvent) {
      handleSelectEvent(existingEvent.id)
      return
    }

    // 1. Extract live hazard data: title, coordinates, severity, event type, and date
    const title = alert.name || alert.eventname || alert.title || 'Live GDACS Hazard Event'

    // Extract coordinates safely
    let lat = alert.latitude != null ? Number(alert.latitude) : null
    let lng = alert.longitude != null ? Number(alert.longitude) : null
    if ((lat == null || lng == null) && Array.isArray(alert.coordinates) && alert.coordinates.length >= 2) {
      const [c0, c1] = alert.coordinates
      if (c0 >= 100 && c1 < 50) {
        lng = Number(c0)
        lat = Number(c1)
      } else {
        lat = Number(c0)
        lng = Number(c1)
      }
    }

    // Severity mapping ('Severe' | 'High' | 'Moderate')
    const rawSev = (alert.severity_text || alert.alert_level || alert.severity || '').toLowerCase()
    let severity = 'Moderate'
    if (rawSev.includes('red') || rawSev.includes('severe') || rawSev.includes('catastrophic') || rawSev.includes('major')) {
      severity = 'Severe'
    } else if (rawSev.includes('orange') || rawSev.includes('high')) {
      severity = 'High'
    } else {
      severity = 'Moderate'
    }

    // Event type mapping
    const rawType = (alert.type || alert.category || title).toLowerCase()
    let disasterType = 'disaster'
    if (rawType.includes('tc') || rawType.includes('typhoon') || rawType.includes('cyclone') || rawType.includes('storm')) {
      disasterType = 'typhoon'
    } else if (rawType.includes('eq') || rawType.includes('earthquake') || rawType.includes('quake') || rawType.includes('seismic')) {
      disasterType = 'earthquake'
    } else if (rawType.includes('fl') || rawType.includes('flood') || rawType.includes('rain') || rawType.includes('monsoon')) {
      disasterType = 'flood'
    } else if (rawType.includes('blackout') || rawType.includes('grid') || rawType.includes('power')) {
      disasterType = 'blackout'
    } else {
      disasterType = 'disaster'
    }

    // Date parsing
    const rawDate = alert.date || alert.fromdate || new Date().toISOString().slice(0, 10)
    const eventDate = formatIsoDate(rawDate) || (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
    const sDate = new Date(`${eventDate}T00:00:00Z`)
    const eDate = new Date(sDate.getTime() + 31 * 86400000)
    const endDate = isNaN(eDate.getTime()) ? eventDate : eDate.toISOString().slice(0, 10)

    const affectedPopulation = alert.alert_score
      ? Math.round(Number(alert.alert_score) * 200000)
      : severity === 'Severe' ? 750000 : severity === 'High' ? 320000 : 95000

    // 2. Construct temporary event object matching the structure of the historical event catalog
    const temporaryEvent = preconstructedEvent || {
      id: alertId,
      name: title,
      date: eventDate,
      endDate: endDate,
      severity: severity,
      type: disasterType,
      affectedPopulation: affectedPopulation,
      description: alert.description || `Real-time GDACS hazard monitoring alert (${alert.type || 'Natural Hazard'}) detected in the Philippines region.`,
      category: alert.category || alert.type || 'Hazard',
      alert_level: alert.alert_level || (severity === 'Severe' ? 'Red' : severity === 'High' ? 'Orange' : 'Green'),
      viirs_data_available: true,
      critical_municipalities: [],
      latitude: lat,
      longitude: lng,
      coordinates: (lat != null && lng != null) ? [lat, lng] : null,
      is_live_simulated: true,
    }

    // 3. Append it or set it directly as the active event state
    setEvents((prev) => {
      const withoutCurrent = prev.filter((e) => {
        const eId = String(e.id)
        const eName = (e.name || '').toLowerCase().trim()
        return (
          eId !== temporaryEvent.id &&
          eId !== rawAlertId &&
          eId !== `gdacs-${rawAlertId}` &&
          eName !== (temporaryEvent.name || '').toLowerCase().trim()
        )
      })
      return [temporaryEvent, ...withoutCurrent]
    })

    // Mark as imported in local GDACS feed state
    setGdacsAlerts((prev) =>
      prev.map((a) =>
        String(a.event_id) === rawAlertId || a.id === temporaryEvent.id || a.id === alertId
          ? { ...a, is_imported: true }
          : a
      )
    )

    // 4. Trigger the exact same state updates used by historical events
    setActiveEventId(temporaryEvent.id)
    if (temporaryEvent.date && temporaryEvent.endDate) {
      setRecoveryDateRange({
        eventId: temporaryEvent.id,
        startDate: formatIsoDate(temporaryEvent.date),
        endDate: formatIsoDate(temporaryEvent.endDate),
      })
    }
    setLatestObservationDate(null)
    setIsMapLoading(true)

    // Toast feedback
    setToastMessage(`✓ Live hazard "${temporaryEvent.name}" loaded into simulation! Calibrated recovery view updated.`)
    setTimeout(() => setToastMessage(null), 6000)

    // Optional background sync with backend /api/v1/events/import-gdacs (non-blocking)
    const importKey = rawAlertId || alertId
    setImportingId(importKey)
    try {
      apiFetch('/api/v1/events/import-gdacs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: alert.event_id,
          name: alert.name,
          type: alert.type,
          category: alert.category,
          alert_level: alert.alert_level,
          date: alert.date,
          description: alert.description,
          severity: alert.severity_text || severity,
          window_days: 31,
        }),
      }).then(async (res) => {
        if (res.ok) {
          const result = await safeJsonParse(res)
          if (result?.event) {
            const mapped = mapApiEvent(result.event)
            setEvents((prev) =>
              prev.map((e) => (e.id === temporaryEvent.id ? { ...e, ...mapped } : e))
            )
          }
        }
      }).catch(() => {}).finally(() => {
        setImportingId(null)
      })
    } catch {
      setImportingId(null)
    }
  }, [events, handleSelectEvent])

  const baseActiveEvent = events.find((event) => String(event.id) === String(activeEventId)) ?? events[0] ?? null

  // Calculate dynamic affected population for active event based on current municipality recovery statuses
  const activeAffectedPopulation = useMemo(() => {
    if (!municipalities || municipalities.length === 0) {
      return baseActiveEvent?.affectedPopulation || 0
    }
    // Sum population of municipalities flagged as affected or under critical thresholds (<60% or critical/warning)
    const affectedLGUs = municipalities.filter(
      (m) => m.status === 'critical' || m.status === 'warning' || (m.recoveryScore !== undefined && m.recoveryScore < 60)
    )
    if (affectedLGUs.length > 0) {
      return affectedLGUs.reduce((sum, m) => sum + (m.population || 0), 0)
    }
    const unrestored = municipalities.filter((m) => m.status !== 'restored')
    if (unrestored.length > 0) {
      return unrestored.reduce((sum, m) => sum + (m.population || 0), 0)
    }
    return baseActiveEvent?.affectedPopulation || 0
  }, [municipalities, baseActiveEvent?.affectedPopulation])

  const activeEvent = useMemo(() => {
    if (!baseActiveEvent) return null
    const defaultCoords = [11.0, 122.5]
    return {
      ...baseActiveEvent,
      affectedPopulation: activeAffectedPopulation || baseActiveEvent.affectedPopulation || 0,
      coordinates: baseActiveEvent.coordinates ?? (baseActiveEvent.latitude != null && baseActiveEvent.longitude != null ? [baseActiveEvent.latitude, baseActiveEvent.longitude] : defaultCoords),
      impact_metrics: {
        lgus: baseActiveEvent.critical_municipalities ?? [],
        affected_population: activeAffectedPopulation || baseActiveEvent.affectedPopulation || 0,
      },
    }
  }, [baseActiveEvent, activeAffectedPopulation])

  const hasRecoveryDateRange = recoveryDateRange?.eventId === activeEvent?.id
  const recoveryStartDate = activeEvent?.date
    ? hasRecoveryDateRange ? formatIsoDate(recoveryDateRange.startDate) : formatIsoDate(activeEvent.date)
    : ''
  const isObservationDateValidForEvent = latestObservationDate && activeEvent?.date &&
    latestObservationDate >= activeEvent.date &&
    latestObservationDate <= addDays(activeEvent.date, 60)
  const recoveryEndDate = activeEvent?.date
    ? hasRecoveryDateRange
      ? formatIsoDate(recoveryDateRange.endDate)
      : (activeEvent.endDate && activeEvent.endDate !== activeEvent.date && activeEvent.endDate.length >= 10 && !isNaN(new Date(activeEvent.endDate).getTime())
          ? formatIsoDate(activeEvent.endDate)
          : (isObservationDateValidForEvent ? formatIsoDate(latestObservationDate) : formatIsoDate(addDays(activeEvent.date, 30))))
    : ''

  const handleRegionChange = useCallback((newKey) => {
    setSelectedRegionKey(newKey)

    // If switching to a non-Panay region (e.g. 'r4a', 'ncr', 'r3', 'r7', etc.):
    if (!isPanayRegion(newKey) && !isNationwideRegion(newKey)) {
      // If currently active event is Panay-exclusive, automatically switch to a compatible incident
      if (activeEvent && isPanayExclusiveEvent(activeEvent)) {
        const compatible = events.find((e) => !isPanayExclusiveEvent(e))
        if (compatible) {
          handleSelectEvent(compatible.id)
          setToastMessage(
            `Geographic scope switched to ${getRegionDisplayName(newKey)}. Automatically selected "${compatible.name}" to prevent Panay blackout mismatch.`
          )
          setTimeout(() => setToastMessage(null), 6000)
        }
      }
    }
  }, [activeEvent, events, handleSelectEvent])

  const handleSelectProvince = useCallback((regionKey) => {
    if (!activeEventId) {
      setActiveEventId(PRIMARY_EVENT_ID)
    }
    handleRegionChange(regionKey)
    handleSelectTab('map')
  }, [activeEventId, handleRegionChange, handleSelectTab])

  const handleCreateCustomEvent = useCallback((newEvent) => {
    setEvents((prev) => {
      const filtered = prev.filter((e) => String(e.id) !== String(newEvent.id))
      return [newEvent, ...filtered]
    })
    setActiveEventId(newEvent.id)
    const sDate = formatIsoDate(newEvent.date)
    const eDate = formatIsoDate(newEvent.endDate)
    if (sDate && eDate) {
      setRecoveryDateRange({ eventId: newEvent.id, startDate: sDate, endDate: eDate })
    }
  }, [])

  useEffect(() => {
    setLatestObservationDate(null)
  }, [activeEventId])

  // Ensure switching active event cleans up any lingering body locks / overflows from drawers/modals
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      document.documentElement.style.overflow = ''
      document.documentElement.style.touchAction = ''
    }
  }, [activeEventId])

  const selectMunicipality = useCallback((id) => setSelectedId(id), [])

  // Calculate uniform resilience ranks across all municipalities (1-based index from lowest score to highest)
  const municipalitiesWithRank = useMemo(() => {
    if (!municipalities || municipalities.length === 0) return []
    const sorted = [...municipalities].sort(
      (a, b) => (a.recoveryScore ?? 50) - (b.recoveryScore ?? 50) || (a.name || '').localeCompare(b.name || '')
    )
    const rankMap = new Map()
    sorted.forEach((m, idx) => {
      rankMap.set(m.id, idx + 1)
      if (m.pcode) rankMap.set(m.pcode, idx + 1)
    })

    return municipalities.map((m) => {
      const rank = rankMap.get(m.id) || (m.pcode ? rankMap.get(m.pcode) : null) || 1
      return {
        ...m,
        resilienceRank: rank,
        rank,
      }
    })
  }, [municipalities])

  const selectedGlobalRank = useMemo(() => {
    if (!selectedId || !municipalitiesWithRank.length) return null
    const found = municipalitiesWithRank.find((m) => m.id === selectedId || m.pcode === selectedId)
    return found?.resilienceRank ?? null
  }, [municipalitiesWithRank, selectedId])

  // Panay Island LGUs for Panay-focused executive summary & benchmarks by default (strictly Iloilo, Capiz, Aklan, Antique = 93 LGUs)
  const panayMunicipalities = useMemo(() => {
    const list = municipalitiesWithRank.filter((m) => {
      const prov = (m.province || '').toLowerCase().trim()
      if (prov === 'guimaras') return false
      if (['iloilo', 'capiz', 'aklan', 'antique'].includes(prov)) return true
      if (m.pcode) {
        return m.pcode.startsWith('PH06') && !m.pcode.startsWith('PH06079')
      }
      return !m.province && !m.region
    })
    return list.length > 0 ? list : municipalitiesWithRank
  }, [municipalitiesWithRank])

  const handleDismissEvent = useCallback(() => {
    setActiveEventId(null)
    setSelectedId(null)
  }, [])

  const handleMunicipalitiesLoaded = useCallback((newItems) => {
    if (!newItems || newItems.length === 0) return
    setMunicipalities((prev) => {
      const existing = new Set(prev.map((m) => m.id))
      const toAdd = newItems.filter((m) => !existing.has(m.id))
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev
    })
  }, [])

  // Dynamically keep events list updated with current affected population calculation
  useEffect(() => {
    if (!activeEventId || activeAffectedPopulation === 0) return
    setEvents((prevEvents) =>
      prevEvents.map((evt) =>
        evt.id === activeEventId && evt.affectedPopulation !== activeAffectedPopulation
          ? { ...evt, affectedPopulation: activeAffectedPopulation }
          : evt
      )
    )
  }, [activeEventId, activeAffectedPopulation])

  // Coordinated loader for GeoJSON boundaries and active event radiance
  useEffect(() => {
    if (!activeEventId) return

    let cancelled = false
    setIsMapLoading(true)

    const fetchGeojson = async () => {
      if (geojsonFeaturesRef.current) {
        return geojsonFeaturesRef.current
      }
      const filterPanayFeatures = (features) => {
        if (!Array.isArray(features)) return []
        return features.filter((f) => {
          const adm2 = (f.properties?.ADM2_EN || f.properties?.province || '').toLowerCase().trim()
          const pcode = f.properties?.ADM3_PCODE || f.properties?.psgc_code || ''
          return adm2 !== 'guimaras' && !pcode.startsWith('PH06079')
        })
      }

      try {
        const res = await fetch('/regions/panay.geojson')
        if (res.ok) {
          const json = await res.json()
          if (json.features && json.features.length > 0) {
            const filtered = filterPanayFeatures(json.features)
            geojsonFeaturesRef.current = filtered
            return filtered
          }
        }
      } catch (err) {
        console.warn('Failed to load Panay region boundaries, trying fallback', err)
      }
      const res = await fetch('/panay_municipalities.geojson')
      if (!res.ok) throw new Error(`Boundary map request failed: ${res.status}`)
      const json = await res.json()
      const filtered = filterPanayFeatures(json.features || [])
      geojsonFeaturesRef.current = filtered
      return filtered
    }

    const fetchRadiance = async () => {
      try {
        const res = await apiFetch(`/api/v1/events/${activeEventId}/radiance`)
        if (!res.ok) return null
        return await safeJsonParse(res)
      } catch {
        return null
      }
    }

    Promise.all([fetchGeojson(), fetchRadiance()])
      .then(([features, radiancePayload]) => {
        if (cancelled) return

        const baseMunicipalities = createMunicipalities(features)

        if (radiancePayload?.data && radiancePayload.data.length > 0) {
          const records = radiancePayload.data.map((item) => ({
            ...item,
            daily_radiance: item.post_event_radiance ?? item.daily_radiance,
            date: item.observation_date,
          }))

          const mapped = applyRecoveryScores(baseMunicipalities, records)
          setMunicipalities(mapped)
          setRecoveryDate(radiancePayload.data[0]?.observation_date ?? null)

          if (radiancePayload?.event?.affected_population || radiancePayload?.event?.critical_municipalities) {
            setEvents((prev) =>
              prev.map((e) =>
                e.id === activeEventId
                  ? {
                      ...e,
                      ...(radiancePayload.event.affected_population ? { affectedPopulation: radiancePayload.event.affected_population } : {}),
                      ...(radiancePayload.event.critical_municipalities ? { critical_municipalities: radiancePayload.event.critical_municipalities } : {}),
                    }
                  : e
              )
            )
          }
        } else {
          setMunicipalities(baseMunicipalities)
        }
        setIsMapLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        setEventsError(error.message)
        setIsMapLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeEventId])

  useEffect(() => {
    if (!activeEvent?.date) return
    setMunicipalities((current) => current.map((municipality) => ({
      ...municipality,
      daysSinceEvent: daysSince(activeEvent.date),
    })))
  }, [activeEvent?.date])

  const fetchEvents = useCallback(async () => {
    setEventsError('')
    try {
      const response = await apiFetch('/api/v1/events')
      if (!response.ok) throw new Error(`Events request failed: ${response.status}`)
      const payload = await safeJsonParse(response)
      if (!payload?.events || !Array.isArray(payload.events)) {
        console.warn('[App] Events payload incomplete or truncated, preserving cached/mock events')
        return
      }
      const rawEvents = payload.events.map(mapApiEvent)
      // Deduplicate and filter out obsolete/erroneous pre-2012 events
      const apiEvents = rawEvents.filter((evt, idx, arr) => {
        const isErroneous =
          evt.id === 'gdacs-1568718' ||
          evt.id === 'panay-earthquake-1990' ||
          evt.id === '19900614' ||
          evt.id === 'gdacs-19900614' ||
          evt.id === 'odette' ||
          evt.name?.includes('1990') ||
          evt.name?.includes('Panay Fault') ||
          (evt.name?.includes('Odette') && !evt.name?.includes('Rai'))
        if (isErroneous) return false
        return idx === arr.findIndex((e) => e.id === evt.id || (e.name === evt.name && e.date === evt.date))
      })
      if (apiEvents.length > 0) {
        // Strictly sort events in reverse chronological order (newest / most recent first)
        const sortedEvents = [...apiEvents].sort((a, b) => {
          const dateA = new Date(a.startDate || a.date || 0).getTime() || 0
          const dateB = new Date(b.startDate || b.date || 0).getTime() || 0
          return dateB - dateA
        })
        setEvents(sortedEvents)
        // Default to the most recent event (top item of the sorted list)
        const defaultEvent = sortedEvents[0] ?? sortedEvents.find((e) => e.id === PRIMARY_EVENT_ID)
        setActiveEventId((prev) => prev || defaultEvent?.id || null)
      }
    } catch (error) {
      setEventsError(error.message)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const fetchActiveEventRadiance = useCallback(async (eventId, sDate, eDate, signal) => {
    if (!eventId || !sDate) return
    try {
      const params = new URLSearchParams({ observation_date: sDate })
      const response = await apiFetch(`/api/v1/events/${eventId}/radiance?${params}`, { signal })
      if (!response.ok) return null
      const payload = await safeJsonParse(response)
      if (payload?.data && payload.data.length > 0) {
        const records = payload.data.map((item) => ({
          ...item,
          daily_radiance: item.post_event_radiance ?? item.daily_radiance,
          date: item.observation_date,
        }))
        setMunicipalities((current) => {
          const mapped = applyRecoveryScores(current, records, sDate, eDate)
          setRecoveryDate(payload.data[0]?.observation_date ?? sDate)
          return mapped
        })
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        // Fall back gracefully if spatial data is not available for this event
      }
    }
  }, [])

  useEffect(() => {
    if (!activeEventId || !recoveryStartDate) return
    const controller = new AbortController()
    fetchActiveEventRadiance(activeEventId, recoveryStartDate, recoveryEndDate, controller.signal)
    return () => controller.abort()
  }, [activeEventId, recoveryStartDate, recoveryEndDate, fetchActiveEventRadiance])

  const fetchRecoveryScores = useCallback(async (sDate, eDate, signal) => {
    if (!sDate || !eDate || sDate > eDate) return
    try {
      const params = new URLSearchParams({ start_date: sDate, end_date: eDate })
      const response = await apiFetch(`/api/v1/recovery-scores?${params}`, { signal })
      if (!response.ok) throw new Error(`Event recovery request failed: ${response.status}`)
      const payload = await safeJsonParse(response)
      if (!payload?.data) {
        console.warn('[App] Recovery scores payload incomplete or truncated')
        return
      }
      setRecoveryRecords(payload.data)
      // Derive the latest observation date from returned records so the default
      // end-date tracks real data rather than the static event+30 fallback
      if (payload.data && payload.data.length > 0) {
        const maxDate = payload.data
          .map((r) => r.date || r.observation_date)
          .filter(Boolean)
          .sort()
          .at(-1)
        if (maxDate) setLatestObservationDate(maxDate)

        // Re-compute and re-sort municipal resilience scores uniformly across all municipalities
        setMunicipalities((current) => applyRecoveryScores(current, payload.data, sDate, eDate))
        setRecoveryDate(sDate)
      }
    } catch (error) {
      if (error.name !== 'AbortError') setEventsError(error.message)
    }
  }, [])

  useEffect(() => {
    if (!activeEvent?.date || !recoveryStartDate || !recoveryEndDate || recoveryStartDate > recoveryEndDate) return
    const controller = new AbortController()
    fetchRecoveryScores(recoveryStartDate, recoveryEndDate, controller.signal)
    return () => controller.abort()
  }, [activeEvent?.date, recoveryEndDate, recoveryStartDate, fetchRecoveryScores])

  // Register global refetch handler for server health reconnects
  useEffect(() => {
    const unregister = registerRefetchHandler('app-active-data', async () => {
      setEventsError('')
      await Promise.allSettled([
        fetchEvents(),
        fetchGdacsAlerts(),
        activeEventId && recoveryStartDate
          ? fetchActiveEventRadiance(activeEventId, recoveryStartDate, recoveryEndDate)
          : Promise.resolve(),
        recoveryStartDate && recoveryEndDate
          ? fetchRecoveryScores(recoveryStartDate, recoveryEndDate)
          : Promise.resolve(),
      ])
    })
    return unregister
  }, [
    registerRefetchHandler,
    fetchEvents,
    fetchGdacsAlerts,
    activeEventId,
    recoveryStartDate,
    recoveryEndDate,
    fetchActiveEventRadiance,
    fetchRecoveryScores,
  ])

  // Clear component errors on global reset
  useEffect(() => {
    const onReset = () => setEventsError('')
    window.addEventListener('sanag:reset-errors', onReset)
    return () => window.removeEventListener('sanag:reset-errors', onReset)
  }, [])

  return (
    <div id="top" className="min-h-screen flex flex-col bg-slate-50 dark:bg-ink-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Floating Backend Sleep / Cold-Start Recovery Indicator */}
      <ServerStatusBanner />

      {/* Floating Feedback Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 max-w-md animate-fade-in-up">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/40 bg-slate-950/95 backdrop-blur-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] text-white text-xs sm:text-sm">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="flex-1 font-medium">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-ink-400 hover:text-white text-xs ml-2 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {eventsError && (
        <div className="pt-20 px-6">
          <div className="mx-auto max-w-7xl p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs sm:text-sm text-center">
            {eventsError}
          </div>
        </div>
      )}

      {/* Main Tabbed View Routing Container */}
      <main className="flex-1 pt-16">
        {/* Tab 1: Overview (#overview) */}
        {activeTab === 'overview' && (
          activeEvent ? (
            <Overview
              municipalities={municipalitiesWithRank}
              activeEvent={activeEvent}
              events={events}
              onSelectEvent={handleSelectEvent}
              onDismissEvent={handleDismissEvent}
              selectedId={selectedId}
              globalRank={selectedGlobalRank}
              onSelectMunicipality={selectMunicipality}
              recoveryDate={recoveryDate}
              isMapLoading={isMapLoading}
              gdacsAlerts={gdacsAlerts}
              onSimulateGdacs={handleImportGdacs}
              isGdacsLoading={isGdacsLoading}
              onRefreshGdacs={fetchGdacsAlerts}
              importingGdacsId={importingId}
              importedEventIds={importedEventIds}
              onMunicipalitiesLoaded={handleMunicipalitiesLoaded}
              selectedRegionKey={selectedRegionKey}
              onRegionChange={handleRegionChange}
              onNavigateTab={handleSelectTab}
            />
          ) : (
            /* Empty state shown when no event is active */
            <section className="relative pt-12 pb-16 overflow-hidden animate-fade-in">
              <div className="absolute inset-0 bg-slate-50 dark:bg-ink-950 pointer-events-none transition-colors" />
              <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
              <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 dark:text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">No Active Incident Selected</h2>
                    <p className="text-sm text-slate-500 dark:text-ink-400 max-w-sm">Select an incident from the events catalog to load satellite radiance, recovery curves, and the situational briefing.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectEvent(PRIMARY_EVENT_ID)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-ocean-300 dark:border-ocean-500/40 bg-ocean-50 hover:bg-ocean-100 text-ocean-700 dark:bg-ocean-500/10 dark:hover:bg-ocean-500/20 text-sm font-semibold dark:text-ocean-200 transition-all cursor-pointer shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1018.364 9" /></svg>
                      Restore Default Event
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('events')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      Browse Events Catalog →
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )
        )}

        {/* Tab 2: Map (#map) - Maintained mounted in DOM to preserve Leaflet instance & tile cache */}
        <div
          id="map"
          className={activeTab === 'map' ? 'h-full w-full' : 'hidden'}
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <ErrorBoundary name="Panay Spatial Map" resetKey={activeEventId}>
              <PanayMap
                municipalities={municipalitiesWithRank}
                selectedId={selectedId}
                globalRank={selectedGlobalRank}
                onSelect={selectMunicipality}
                recoveryDate={recoveryDate}
                isLoading={isMapLoading}
                gdacsAlerts={gdacsAlerts}
                activeEventId={activeEventId}
                activeEvent={activeEvent}
                onSimulateGdacs={handleImportGdacs}
                selectedRegionKey={selectedRegionKey}
                onRegionChange={handleRegionChange}
                onMunicipalitiesLoaded={handleMunicipalitiesLoaded}
                isActiveTab={activeTab === 'map'}
              />
            </ErrorBoundary>
          </div>
        </div>

        {/* Tab 3: Recovery (#recovery) */}
        {activeTab === 'recovery' && (
          <section id="recovery" className="relative pb-12 overflow-hidden animate-fade-in">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-3 py-1 mb-2">
                    <span className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-200 uppercase tracking-wider">
                      Comparative Recovery Analytics
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Power Restoration Trajectories
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-ink-300 mt-1 max-w-2xl">
                    Analyze day-by-day VIIRS radiance recovery curves against pre-disaster baselines across electric cooperatives and ranked municipal indexes.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('map')}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm"
                  >
                    View Spatial Map →
                  </button>
                </div>
              </div>

              <div className="w-full">
                <RecoveryChart
                  municipalities={municipalitiesWithRank}
                  selectedId={selectedId}
                  globalRank={selectedGlobalRank}
                  records={recoveryRecords}
                  events={events}
                  activeEventId={activeEventId}
                  onEventChange={handleSelectEvent}
                  onCreateEvent={handleCreateCustomEvent}
                  eventDate={activeEvent?.date}
                  onSelect={selectMunicipality}
                  startDate={recoveryStartDate}
                  endDate={recoveryEndDate}
                  selectedRegionKey={selectedRegionKey}
                  onDateRangeChange={(startDate, endDate) => {
                    if (!activeEvent) return
                    const cleanStart = formatIsoDate(startDate)
                    const cleanEnd = formatIsoDate(endDate)
                    if (cleanStart && cleanEnd) {
                      setRecoveryDateRange({ eventId: activeEvent.id, startDate: cleanStart, endDate: cleanEnd })
                    }
                  }}
                />
              </div>

              <div className="w-full">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Municipal Resilience Index
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-ink-400">
                    Ranked evaluation of all LGUs by current radiance recovery score and outage severity.
                  </p>
                </div>
                <MunicipalityTable
                  municipalities={municipalitiesWithRank}
                  selectedId={selectedId}
                  onSelect={selectMunicipality}
                />
              </div>
            </div>
          </section>
        )}

        {/* Tab 4: Events (#events) */}
        {activeTab === 'events' && (
          <section id="events" className="relative pb-12 overflow-hidden animate-fade-in">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 mb-2">
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300 uppercase tracking-wider">
                      Disaster Event Catalog & Monitoring
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                    Historical Incidents & Live Hazards
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-ink-300 mt-1 max-w-2xl">
                    Browse historical typhoons and grid collapses, inspect ground photography and news reports, or simulate real-time GDACS multi-hazard alerts.
                  </p>
                </div>
              </div>

              {activeEvent ? (
                <div className="w-full">
                  <ErrorBoundary name="Event Selector Panel" resetKey={activeEventId}>
                    <EventSelectorPanel
                      events={events}
                      activeEvent={activeEvent}
                      onSelectEvent={handleSelectEvent}
                      onDismissEvent={handleDismissEvent}
                      onSimulateGdacs={handleImportGdacs}
                      importingGdacsId={importingId}
                      importedEventIds={importedEventIds}
                      selectedRegionKey={selectedRegionKey}
                    />
                  </ErrorBoundary>
                </div>
              ) : null}

              <div className="w-full">
                <ErrorBoundary name="Event Timeline" resetKey={activeEventId}>
                  <EventTimeline
                    events={events}
                    activeEventId={activeEventId}
                    onSelect={handleSelectEvent}
                    onDismiss={handleDismissEvent}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </section>
        )}

        {/* Tab 5: Guide & Glossary (#guide) */}
        {activeTab === 'guide' && (
          <section id="guide" className="relative pb-12 overflow-hidden animate-fade-in">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <GuideGlossary onNavigateTab={handleSelectTab} />
            </div>
          </section>
        )}
      </main>

      <Footer onSelectRegion={handleSelectProvince} selectedRegionKey={selectedRegionKey} />
    </div>
  )
}

export default App
