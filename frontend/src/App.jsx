import { useCallback, useEffect, useState } from 'react'
import AIBriefing from './components/AIBriefing.tsx'
import EventTimeline from './components/EventTimeline.tsx'
import Footer from './components/Footer.tsx'
import Hero from './components/Hero.tsx'
import MunicipalityTable from './components/MunicipalityTable.tsx'
import Navbar from './components/Navbar.tsx'
import PanayMap from './components/PanayMap.tsx'
import RecoveryChart from './components/RecoveryChart.tsx'
import { createMunicipalities, events } from './data/mockData.ts'
import './App.css'

function App() {
  const [municipalities, setMunicipalities] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [activeEventId, setActiveEventId] = useState(events[0].id)
  const activeEvent = events.find((event) => event.id === activeEventId) ?? events[0]
  const selectMunicipality = useCallback((id) => setSelectedId(id), [])

  useEffect(() => {
    fetch('/panay_municipalities.geojson')
      .then((response) => response.json())
      .then((geojson) => setMunicipalities(createMunicipalities(geojson.features)))
  }, [])

  return (
    <div id="top">
      <Navbar />
      <Hero
        municipalities={municipalities}
        activeEvent={activeEvent}
        events={events}
        onSelectEvent={setActiveEventId}
      />
      <main className="dashboard-main">
        <section id="map" className="dashboard-section">
          <PanayMap municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} />
        </section>
        <section id="recovery" className="dashboard-section">
          <RecoveryChart municipalities={municipalities} selectedId={selectedId} />
        </section>
        <section className="dashboard-section">
          <MunicipalityTable municipalities={municipalities} selectedId={selectedId} onSelect={selectMunicipality} />
        </section>
        <section id="events" className="dashboard-section">
          <EventTimeline events={events} activeEventId={activeEventId} onSelect={setActiveEventId} />
        </section>
        <section className="dashboard-section">
          <AIBriefing event={activeEvent} municipalities={municipalities} />
        </section>
      </main>
      <Footer />
    </div>
  )
}

export default App
