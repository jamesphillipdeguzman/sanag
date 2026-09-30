import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AiBriefingCard from './components/AiBriefingCard.tsx'
import EventTimeline from './components/EventTimeline.tsx'
import Footer from './components/Footer.tsx'
import MunicipalityTable from './components/MunicipalityTable.tsx'
import Navbar from './components/Navbar.tsx'
import Overview from './pages/Overview.tsx'
import RecoveryChart from './components/RecoveryChart.tsx'
import WeatherForecast from './components/WeatherForecast.jsx'
import { createMunicipalities, events as mockEvents, PRIMARY_EVENT_ID } from './data/mockData.ts'
import './App.css'

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
  const category = (event.category || '').toLowerCase()
  const type = category.includes('flood')
    ? 'flood'
    : category.includes('typhoon') || category.includes('cyclone')
      ? 'typhoon'
      : category.includes('earthquake')
        ? 'earthquake'
        : 'blackout'

  const mockMatch = mockEvents.find((e) => e.id === String(event.id) || e.name === event.name)
  const affectedPopulation = Number(
    event.affected_population ?? event.affectedPopulation ?? mockMatch?.affectedPopulation ?? 0
  )

  const alertLevel = event.alert_level || (event.severity === 'Severe' ? 'Red' : event.severity === 'High' ? 'Orange' : 'Green')
  const severity = event.severity || (alertLevel === 'Red' ? 'Severe' : alertLevel === 'Orange' ? 'High' : 'Moderate')

  return {
    id: String(event.id),
    name: event.name,
    date: event.date,
    endDate: event.date,
    severity,
    type,
    affectedPopulation,
    description: event.description ?? 'No description available.',
    category: event.category,
    alert_level: alertLevel,
    viirs_data_available: event.viirs_data_available ?? true,
    critical_municipalities: event.critical_municipalities ?? [],
  }
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
  const [events, setEvents] = useState(mockEvents)
  const [selectedId, setSelectedId] = useState(null)
  const [activeEventId, setActiveEventId] = useState(PRIMARY_EVENT_ID)
  const [eventsError, setEventsError] = useState('')
  const [recoveryDate, setRecoveryDate] = useState(null)
  const [latestObservationDate, setLatestObservationDate] = useState(null)
  const [recoveryRecords, setRecoveryRecords] = useState([])
  const [isMapLoading, setIsMapLoading] = useState(true)
  const [recoveryDateRange, setRecoveryDateRange] = useState(null)

  // GDACS live feeds & simulation state
  const [gdacsAlerts, setGdacsAlerts] = useState([])
  const [isGdacsLoading, setIsGdacsLoading] = useState(false)
  const [importingId, setImportingId] = useState(null)
  const [toastMessage, setToastMessage] = useState(null)

  const geojsonFeaturesRef = useRef(null)

  const fetchGdacsAlerts = useCallback(async () => {
    setIsGdacsLoading(true)
    try {
      const res = await fetch('/api/v1/gdacs/alerts')
      if (!res.ok) throw new Error(`GDACS request failed: ${res.status}`)
      const payload = await res.json()
      if (payload.alerts) {
        setGdacsAlerts(payload.alerts)
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

  const handleImportGdacs = useCallback(async (alert) => {
    if (!alert) return

    const rawAlertId = alert.event_id != null ? String(alert.event_id) : ''
    const alertId = alert.id ? String(alert.id) : (rawAlertId ? `gdacs-${rawAlertId}` : '')
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
      // Event already exists: select/highlight existing tile instead of pushing a duplicate
      setActiveEventId(existingEvent.id)
      return
    }

    if (alert.viirs_data_available === false) {
      setEventsError('Simulation Unavailable: Confirmed NASA VIIRS radiance data is pending for this live hazard. Please wait until satellite ground telemetry is confirmed.')
      setTimeout(() => setEventsError(''), 6000)
      return
    }

    const importKey = rawAlertId || alertId
    setImportingId(importKey)
    try {
      const res = await fetch('/api/v1/events/import-gdacs', {
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
          severity: alert.severity_text,
          window_days: 31,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Failed to import event: ${res.status}`)
      }

      const result = await res.json()
      if (result.event) {
        const mapped = mapApiEvent(result.event)

        // Prepend newly imported event directly into active events state, deduplicating thoroughly
        setEvents((prev) => {
          const withoutCurrent = prev.filter((e) => {
            const eId = String(e.id)
            const eName = (e.name || '').toLowerCase().trim()
            return (
              eId !== mapped.id &&
              eId !== rawAlertId &&
              eId !== `gdacs-${rawAlertId}` &&
              eName !== (mapped.name || '').toLowerCase().trim()
            )
          })
          return [mapped, ...withoutCurrent]
        })

        // Mark as imported in local GDACS feed state
        setGdacsAlerts((prev) =>
          prev.map((a) =>
            String(a.event_id) === rawAlertId || a.id === mapped.id || a.id === alertId ? { ...a, is_imported: true } : a
          )
        )

        // Seamlessly select newly imported event so map, radiance and timeline update immediately
        setActiveEventId(mapped.id)

        // Toast feedback
        setToastMessage(`✓ Event "${mapped.name}" imported & simulated! Calibrated 93 Panay LGU curves.`)
        setTimeout(() => setToastMessage(null), 6000)
      }
    } catch (err) {
      console.error('GDACS import error:', err)
      setEventsError(`GDACS Import Error: ${err.message}`)
      setTimeout(() => setEventsError(''), 7000)
    } finally {
      setImportingId(null)
    }
  }, [events])

  const baseActiveEvent = events.find((event) => event.id === activeEventId) ?? events[0]

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
    return {
      ...baseActiveEvent,
      affectedPopulation: activeAffectedPopulation || baseActiveEvent.affectedPopulation || 0,
    }
  }, [baseActiveEvent, activeAffectedPopulation])

  const hasRecoveryDateRange = recoveryDateRange?.eventId === activeEvent?.id
  const recoveryStartDate = activeEvent?.date
    ? hasRecoveryDateRange ? recoveryDateRange.startDate : activeEvent.date
    : ''
  const isObservationDateValidForEvent = latestObservationDate && activeEvent?.date &&
    latestObservationDate >= activeEvent.date &&
    latestObservationDate <= addDays(activeEvent.date, 60)
  const recoveryEndDate = activeEvent?.date
    ? hasRecoveryDateRange
      ? recoveryDateRange.endDate
      : (activeEvent.endDate && activeEvent.endDate.length >= 10 && !isNaN(new Date(activeEvent.endDate).getTime())
          ? activeEvent.endDate.slice(0, 10)
          : (isObservationDateValidForEvent ? latestObservationDate : addDays(activeEvent.date, 31)))
    : ''

  const handleSelectEvent = useCallback((eventId) => {
    setActiveEventId(eventId)
    const targetEvent = events.find((e) => String(e.id) === String(eventId))
    if (targetEvent) {
      const sDate = targetEvent.date ? targetEvent.date.slice(0, 10) : ''
      let eDate = ''
      if (targetEvent.endDate && targetEvent.endDate.length >= 10 && !isNaN(new Date(targetEvent.endDate).getTime())) {
        eDate = targetEvent.endDate.slice(0, 10)
      } else if (sDate) {
        eDate = addDays(sDate, 31)
      }
      if (sDate && eDate) {
        setRecoveryDateRange({ eventId: targetEvent.id, startDate: sDate, endDate: eDate })
      }
    }
  }, [events])

  useEffect(() => {
    setLatestObservationDate(null)
  }, [activeEventId])

  const selectMunicipality = useCallback((id) => setSelectedId(id), [])

  // Panay Island LGUs for Panay-focused executive summary & benchmarks by default
  const panayMunicipalities = useMemo(() => {
    const list = municipalities.filter(
      (m) =>
        ['Iloilo', 'Capiz', 'Aklan', 'Antique', 'Panay'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH06')) ||
        (!m.province && !m.region)
    )
    return list.length > 0 ? list : municipalities
  }, [municipalities])

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
      try {
        const res = await fetch('/regions/panay.geojson')
        if (res.ok) {
          const json = await res.json()
          if (json.features && json.features.length > 0) {
            geojsonFeaturesRef.current = json.features
            return json.features
          }
        }
      } catch (err) {
        console.warn('Failed to load Panay region boundaries, trying fallback', err)
      }
      const res = await fetch('/panay_municipalities.geojson')
      if (!res.ok) throw new Error(`Boundary map request failed: ${res.status}`)
      const json = await res.json()
      geojsonFeaturesRef.current = json.features
      return json.features
    }

    const fetchRadiance = async () => {
      try {
        const res = await fetch(`/api/v1/events/${activeEventId}/radiance`)
        if (!res.ok) return null
        return await res.json()
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

  useEffect(() => {
    fetch('/api/v1/events')
      .then((response) => {
        if (!response.ok) throw new Error(`Events request failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => {
        const rawEvents = payload.events.map(mapApiEvent)
        // Deduplicate events by id or identical name + date
        const apiEvents = rawEvents.filter((evt, idx, arr) =>
          idx === arr.findIndex((e) => e.id === evt.id || (e.name === evt.name && e.date === evt.date))
        )
        if (apiEvents.length > 0) {
          setEvents(apiEvents)
          // Default to the flagship Panay blackout event which has verified VIIRS satellite data
          const defaultEvent = apiEvents.find((e) => e.id === PRIMARY_EVENT_ID) ?? apiEvents[0]
          setActiveEventId((prev) => prev || defaultEvent?.id || null)
        }
      })
      .catch((error) => setEventsError(error.message))
  }, [])

  useEffect(() => {
    if (!activeEventId || !recoveryStartDate) return

    const controller = new AbortController()
    const params = new URLSearchParams({ observation_date: recoveryStartDate })
    fetch(`/api/v1/events/${activeEventId}/radiance?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((payload) => {
        if (payload?.data && payload.data.length > 0) {
          const records = payload.data.map((item) => ({
            ...item,
            daily_radiance: item.post_event_radiance ?? item.daily_radiance,
            date: item.observation_date,
          }))
          setMunicipalities((current) => {
            const mapped = applyRecoveryScores(current, records, recoveryStartDate, recoveryEndDate)
            setRecoveryDate(payload.data[0]?.observation_date ?? recoveryStartDate)
            return mapped
          })
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          // Fall back gracefully if spatial data is not available for this event
        }
      })
    return () => controller.abort()
  }, [activeEventId, recoveryStartDate, recoveryEndDate])

  useEffect(() => {
    if (!activeEvent?.date || !recoveryStartDate || !recoveryEndDate || recoveryStartDate > recoveryEndDate) return

    const controller = new AbortController()
    const params = new URLSearchParams({ start_date: recoveryStartDate, end_date: recoveryEndDate })
    fetch(`/api/v1/recovery-scores?${params}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Event recovery request failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => {
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
          setMunicipalities((current) => applyRecoveryScores(current, payload.data, recoveryStartDate, recoveryEndDate))
          setRecoveryDate(recoveryStartDate)
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setEventsError(error.message)
      })

    return () => controller.abort()
  }, [activeEvent?.date, recoveryEndDate, recoveryStartDate])

  return (
    <div id="top">
      <Navbar />

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

      {activeEvent ? (
        <Overview
          municipalities={municipalities}
          activeEvent={activeEvent}
          events={events}
          onSelectEvent={setActiveEventId}
          onDismissEvent={handleDismissEvent}
          selectedId={selectedId}
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
        />
      ) : (
        /* Empty state shown when no event is active */
        <section className="relative pt-20 lg:pt-24 pb-8 overflow-hidden">
          <div className="absolute inset-0 bg-ink-950 pointer-events-none" />
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">No Active Incident Selected</h2>
                <p className="text-sm text-ink-400 max-w-sm">Select an incident from the timeline below to load satellite radiance, recovery curves, and the situational briefing.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveEventId(PRIMARY_EVENT_ID)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-ocean-500/40 bg-ocean-500/10 hover:bg-ocean-500/20 text-sm font-semibold text-ocean-200 transition-all cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.581M5.635 15A9 9 0 1018.364 9" /></svg>
                Restore Default Event
              </button>
            </div>
          </div>
        </section>
      )}
      {eventsError && <p className="px-6 py-4 text-center text-rose-300">{eventsError}</p>}
      <main className="dashboard-main">
        <section id="recovery" className="dashboard-section">
          <RecoveryChart
            municipalities={municipalities}
            selectedId={selectedId}
            records={recoveryRecords}
            events={events}
            activeEventId={activeEventId}
            onEventChange={handleSelectEvent}
            eventDate={activeEvent?.date}
            onSelect={selectMunicipality}
            startDate={recoveryStartDate}
            endDate={recoveryEndDate}
            onDateRangeChange={(startDate, endDate) => {
              if (!activeEvent) return
              setRecoveryDateRange({ eventId: activeEvent.id, startDate, endDate })
            }}
          />
        </section>
        <section className="dashboard-section">
          <MunicipalityTable municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} />
        </section>
        <section id="events" className="dashboard-section">
          <EventTimeline events={events} activeEventId={activeEventId} onSelect={setActiveEventId} onDismiss={handleDismissEvent} />
        </section>
        <section className="dashboard-section">
          {activeEvent && <AiBriefingCard event={activeEvent} municipalities={panayMunicipalities} />}
        </section>
        <WeatherForecast />
      </main>
      <Footer />
    </div>
  )
}

export default App
