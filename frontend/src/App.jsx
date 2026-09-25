import { useCallback, useEffect, useState } from 'react'
import AIBriefing from './components/AIBriefing.tsx'
import EventTimeline from './components/EventTimeline.tsx'
import Footer from './components/Footer.tsx'
import Hero from './components/Hero.tsx'
import MunicipalityTable from './components/MunicipalityTable.tsx'
import Navbar from './components/Navbar.tsx'
import PanayMap from './components/PanayMap.tsx'
import RecoveryChart from './components/RecoveryChart.tsx'
import { createMunicipalities } from './data/mockData.ts'
import './App.css'

function applyRecoveryScores(municipalities, records) {
  const latestByPcode = new Map()

  records
    .filter((record) => record.r_t !== null && record.r_t !== undefined)
    .forEach((record) => {
      const current = latestByPcode.get(record.pcode)
      if (!current || record.date > current.date) latestByPcode.set(record.pcode, record)
    })

  return municipalities.map((municipality) => {
    const score = latestByPcode.get(municipality.id)
    if (!score) {
      return {
        ...municipality,
        recoveryScore: 0,
        status: 'critical',
        baselineRadiance: 0,
        currentRadiance: 0,
        estimatedDaysToRecover: 0,
        recoveryDate: null,
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
  const category = event.category.toLowerCase()
  const type = category.includes('flood')
    ? 'flood'
    : category.includes('typhoon')
      ? 'typhoon'
      : 'blackout'

  return {
    id: String(event.id),
    name: event.name,
    date: event.date,
    endDate: event.date,
    severity: type === 'blackout' ? 'Severe' : type === 'typhoon' ? 'High' : 'Moderate',
    type,
    affectedPopulation: 0,
    description: event.description ?? 'No description available.',
    category: event.category,
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
  const [events, setEvents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [activeEventId, setActiveEventId] = useState(null)
  const [eventsError, setEventsError] = useState('')
  const [recoveryDate, setRecoveryDate] = useState(null)
  const [recoveryRecords, setRecoveryRecords] = useState([])
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0]
  const selectMunicipality = useCallback((id) => setSelectedId(id), [])

  useEffect(() => {
    fetch('/panay_municipalities.geojson')
      .then((response) => response.json())
      .then((geojson) => setMunicipalities(createMunicipalities(geojson.features)))
      .catch((error) => setEventsError(error.message))
  }, [])

  useEffect(() => {
    if (municipalities.length === 0) return

    fetch('/api/v1/recovery-scores').then((response) => {
        if (!response.ok) throw new Error(`Recovery data request failed: ${response.status}`)
        return response.json()
      })
      .then((recoveryPayload) => {
        setMunicipalities((current) => {
          const mappedMunicipalities = applyRecoveryScores(current, recoveryPayload.data)
          setRecoveryDate(mappedMunicipalities.find((municipality) => municipality.recoveryDate)?.recoveryDate ?? null)
          return mappedMunicipalities
        })
      })
      .catch((error) => setEventsError(error.message))
  }, [municipalities.length])

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
        setEvents(apiEvents)
        // Default to the flagship Panay blackout event which has verified VIIRS satellite data
        const defaultEvent = apiEvents.find((e) => e.id === 'panay-blackout-2024') ?? apiEvents[0]
        setActiveEventId(defaultEvent?.id ?? null)
      })
      .catch((error) => setEventsError(error.message))
  }, [])

  useEffect(() => {
    if (!activeEventId) return

    // Connect event-specific spatial radiance to update map layers with actual post-event observations
    fetch(`/api/v1/events/${activeEventId}/radiance`)
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
            const mapped = applyRecoveryScores(current, records)
            setRecoveryDate(payload.data[0]?.observation_date ?? null)
            return mapped
          })
        }
      })
      .catch(() => {
        // Fall back gracefully if spatial data is not available for this event
      })
  }, [activeEventId])

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
      {activeEvent && (
        <Hero
          municipalities={municipalities}
          activeEvent={activeEvent}
          events={events}
          onSelectEvent={setActiveEventId}
        />
      )}
      {eventsError && <p className="px-6 py-4 text-center text-rose-300">{eventsError}</p>}
      <main className="dashboard-main">
        <section id="map" className="dashboard-section">
          <PanayMap municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} recoveryDate={recoveryDate} />
        </section>
        <section id="recovery" className="dashboard-section">
          <RecoveryChart
            municipalities={municipalities}
            selectedId={selectedId}
            records={recoveryRecords}
            eventDate={activeEvent?.date}
          />
        </section>
        <section className="dashboard-section">
          <MunicipalityTable municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} />
        </section>
        <section id="events" className="dashboard-section">
          <EventTimeline events={events} activeEventId={activeEventId} onSelect={setActiveEventId} />
        </section>
        <section className="dashboard-section">
          {activeEvent && <AIBriefing event={activeEvent} municipalities={municipalities} />}
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
