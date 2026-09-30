import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AiBriefingCard from './components/AiBriefingCard.tsx'
import EventTimeline from './components/EventTimeline.tsx'
import Footer from './components/Footer.tsx'
import MunicipalityTable from './components/MunicipalityTable.tsx'
import Navbar from './components/Navbar.tsx'
import Overview from './pages/Overview.tsx'
import RecoveryChart from './components/RecoveryChart.tsx'
import { createMunicipalities, events as mockEvents, PRIMARY_EVENT_ID } from './data/mockData.ts'
import './App.css'

function applyRecoveryScores(municipalities, records) {
  const latestByPcode = new Map()
  const latestByName = new Map()

  records
    .filter((record) => record.r_t !== null && record.r_t !== undefined)
    .forEach((record) => {
      if (record.pcode && record.pcode !== 'UNKNOWN') {
        const current = latestByPcode.get(record.pcode)
        if (!current || record.date > current.date) latestByPcode.set(record.pcode, record)
      }
      if (record.municipality_name) {
        const normName = record.municipality_name.toLowerCase().trim()
        const current = latestByName.get(normName)
        if (!current || record.date > current.date) latestByName.set(normName, record)
      }
    })

  return municipalities.map((municipality) => {
    const score = latestByPcode.get(municipality.id) || latestByName.get(municipality.name.toLowerCase().trim())
    if (!score) {
      return {
        ...municipality,
        recoveryScore: municipality.recoveryScore ?? 50,
        status: municipality.status ?? 'recovering',
        baselineRadiance: municipality.baselineRadiance ?? 0,
        currentRadiance: municipality.currentRadiance ?? 0,
        estimatedDaysToRecover: municipality.estimatedDaysToRecover ?? 0,
        recoveryDate: municipality.recoveryDate ?? null,
      }
    }

    const recoveryScore = Math.max(0, Math.min(100, Math.round(score.r_t * 100)))
    const status = recoveryScore >= 90 ? 'restored' : recoveryScore >= 60 ? 'recovering' : recoveryScore >= 30 ? 'warning' : 'critical'

    return {
      ...municipality,
      recoveryScore,
      status,
      baselineRadiance: score.baseline_radiance ?? municipality.baselineRadiance,
      currentRadiance: score.daily_radiance ?? municipality.currentRadiance,
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
  const [recoveryRecords, setRecoveryRecords] = useState([])
  const [isMapLoading, setIsMapLoading] = useState(true)

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
    const alertId = String(alert.event_id)
    setImportingId(alertId)
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
          window_days: 14,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Failed to import event: ${res.status}`)
      }

      const result = await res.json()
      if (result.event) {
        const mapped = mapApiEvent(result.event)

        // Prepend newly imported event directly into active events state
        setEvents((prev) => {
          const withoutCurrent = prev.filter((e) => e.id !== mapped.id)
          return [mapped, ...withoutCurrent]
        })

        // Mark as imported in local GDACS feed state
        setGdacsAlerts((prev) =>
          prev.map((a) =>
            String(a.event_id) === alertId || a.id === mapped.id ? { ...a, is_imported: true } : a
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
  }, [])

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

  const selectMunicipality = useCallback((id) => setSelectedId(id), [])

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
    if (!activeEvent?.date) return

    // Query from 3 days before event onset to 30 days after to capture pre-event baseline and drop
    const startDate = addDays(activeEvent.date, -3)
    const endDate = addDays(activeEvent.date, 30)
    fetch(`/api/v1/recovery-scores?start_date=${startDate}&end_date=${endDate}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Event recovery request failed: ${response.status}`)
        return response.json()
      })
      .then((payload) => setRecoveryRecords(payload.data))
      .catch((error) => setEventsError(error.message))
  }, [activeEvent?.date])

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

      {activeEvent && (
        <Overview
          municipalities={municipalities}
          activeEvent={activeEvent}
          events={events}
          onSelectEvent={setActiveEventId}
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
        />
      )}
      {eventsError && <p className="px-6 py-4 text-center text-rose-300">{eventsError}</p>}
      <main className="dashboard-main">
        <section id="recovery" className="dashboard-section">
          <RecoveryChart
            municipalities={municipalities}
            selectedId={selectedId}
            records={recoveryRecords}
            eventDate={activeEvent?.date}
            onSelect={selectMunicipality}
          />
        </section>
        <section className="dashboard-section">
          <MunicipalityTable municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} />
        </section>
        <section id="events" className="dashboard-section">
          <EventTimeline events={events} activeEventId={activeEventId} onSelect={setActiveEventId} />
        </section>
        <section className="dashboard-section">
          {activeEvent && <AiBriefingCard event={activeEvent} municipalities={municipalities} />}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
