# SANAG — Satellite Analytics for Nightlight & Assessment Grid

**Senior Project — Panay Island, Philippines**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-sanag.vercel.app-10b981?style=for-the-badge&logo=vercel&logoColor=white)](https://sanag.vercel.app/)
[![Deployment](https://img.shields.io/badge/Production-Live-0284c7?style=for-the-badge)](https://sanag.vercel.app/)
[![YouTube Demo](https://img.shields.io/badge/Video%20Demo-YouTube-red?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID)

> 🌐 **Live Web Application:** **[https://sanag.vercel.app/](https://sanag.vercel.app/)**  
> 📺 **Video Demonstration:** **[https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID](https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID)** *(Replace with your YouTube demo link)*

SANAG is a web-based disaster recovery dashboard that uses **NASA VIIRS nighttime-light satellite data** to analyze how areas of Panay Island are affected by major disasters or power disruptions and how quickly nighttime-light activity returns toward normal.

The project focuses on **Aklan, Antique, Capiz, and Iloilo**.

---

## 🎯 Project Goal

SANAG helps users answer:

> **"How much has nighttime-light activity recovered after a major disaster or power disruption?"**

The system compares satellite nighttime-light observations:

**Before Event → During/After Event → Recovery**

It then calculates a **Recovery Ratio** for each municipality and displays the results through an interactive map, charts, and optional AI-generated explanations.

### Recovery Ratio

```text
Recovery Ratio = Post-Event Light / Baseline Light
```

Example:

```text
Baseline Light = 100
Post-Event Light = 80

Recovery Ratio = 80 / 100
               = 0.80
               = 80%
```

> **Important:** Recovery Ratio is an analytical indicator based on nighttime-light observations. It does **not** mean that exactly 80% of the electrical grid has been restored.

# SANAG Power Grid Recovery Index Specification

## 1. Core Formula
The recovery index $R(t)$ for a given municipality at time $t$ is defined as:

$$R(t) = \frac{L(t)}{L_{\text{baseline}}}$$

Where:
* $L(t)$: Post-event daily nighttime luminosity/radiance measured by satellite at date $t$.
* $L_{\text{baseline}}$: Pre-disaster baseline monthly radiance established for the municipality under normal operating conditions.

---

## 2. Status Benchmarks & Interpretation
The resulting ratio $R(t)$ is classified into three operational categories:

| Range                    | Status Category                     | Interpretation                                                                     |
| :----------------------- | :---------------------------------- | :--------------------------------------------------------------------------------- |
| **$R(t) \ge 0.9$**       | **Normal Operating Conditions**     | Power grid has fully or near-fully recovered to pre-disaster baseline levels.      |
| **$0.3 \le R(t) < 0.9$** | **Partial Power / Brownouts**       | Active recovery underway; partial grid stability or rolling brownouts experienced. |
| **$R(t) < 0.3$**         | **Severe Grid Collapse / Blackout** | Major grid failure resulting in catastrophic loss of nighttime luminosity.         |


---



# 🗺️ What SANAG Does

1. Displays municipalities across Panay Island.
2. Retrieves NASA VIIRS nighttime-light data.
3. Selects a historical disaster or power event.
4. Compares normal nighttime light with post-event observations.
5. Calculates Recovery Ratio.
6. Classifies municipalities by recovery status.
7. Displays recovery trends over time.
8. Allows municipality-to-municipality comparison.
9. Provides an optional Gemini AI situational briefing.
10. Explores aftermath photojournalism and ground incident media.
11. Monitors 14 high-voltage transmission nodes across 93 LGUs with real-time API telemetry.

---

# 📸 Incident Ground Media & Telemetry Infrastructure

### 1. Incident Ground Images & Multi-Source News Coverage
To complement satellite radiance indices with ground-truth visual verification, SANAG integrates multi-source incident photojournalism:
- **Ground Images & News Coverage Integration:** Real-time multi-source photojournalism and aftermath image retrieval for active incidents (typhoons, floods, earthquakes, and blackouts).
- **DuckDuckGo Image Search Fallback:** Configured resilient fallback querying via DuckDuckGo news/image indexing when primary upstream search quotas or credentials are unavailable, with keyword weighting (`-art -painting -wallpaper`) tuned for incident reporting.
- **Manual Query Refinement & Refresh:** Added manual query input and explicit force-refresh triggers with cache-busting to rotate through alternate ground coverage.
- **Contextual Disclaimer:** Transparent analyst disclaimer advising manual refresh if automated indexing returns tangential results:
  > *"Disaster aftermath imagery indexed from news and wire services. If images appear irrelevant or outdated, click the **Refresh** button to pull alternative coverage."*

### 2. Telemetry & Situational Awareness Grid
- **Panay Island Grid Telemetry:** Replaced synthetic client-side visitor counters with grounded operational metrics reflecting the **14 High-Voltage Transmission Substation nodes** operated across the 4 provinces (Iloilo, Capiz, Aklan, Antique) monitoring all **93 Local Government Units (LGUs)**.
- **Adaptive Backend Connection Status:** Dynamic probe indicators reflecting Render API state:
  - `Online` (Emerald pulse): Active real-time grid feeds and healthy API responses.
  - `Waking Server` (Amber pulse): Visual notification during backend cold starts with countdown tickers.
  - `Local Cache` (Slate dot): Offline operation utilizing local baseline municipal data across 93 LGUs when the server is unreachable.

---

# 👥 Team Responsibilities

## James — Data & Backend Lead

James is responsible for the **data pipeline, calculations, database, and backend API**.

### Main responsibilities

- Google Earth Engine authentication
- NASA VIIRS data retrieval
- Python/Pandas data processing
- Data cleaning and validation
- Municipality aggregation
- Baseline calculations
- Event/post-event calculations
- Recovery Ratio calculation
- Recovery classification
- SQLite database
- FastAPI backend
- API validation
- Gemini API backend integration
- Backend deployment support

### Main question James answers

> **"Is the data and calculation correct?"**

---

## Katherine — Frontend & UI/UX Lead

Katherine is responsible for making the data **easy to understand and interact with**.

### Main responsibilities

- HTML/CSS
- Responsive design
- Leaflet.js map
- Panay GeoJSON
- Municipality map visualization
- Recovery status colors/legend
- Chart.js charts
- Recovery curves
- Municipality comparison
- Event and municipality selectors
- Loading/error states
- Gemini briefing interface
- Mobile/browser testing
- Final UI polish

### Main question Katherine answers

> **"Can the user easily understand the results?"**

---

## 🤝 Shared Responsibilities

Both team members work together on:

- Requirements
- Project planning
- Architecture
- GitHub
- Pull Requests
- Code review
- Integration
- Testing
- Bug fixing
- Deployment
- Documentation
- Video presentation
- Final submission

### Team Golden Rule

> **James makes the data trustworthy. Katherine makes the data understandable. Both make sure the complete system works.**

---

# 🛠️ Technology Stack

| Area                     | Technology                         |
| ------------------------ | ---------------------------------- |
| Satellite Data           | NASA VIIRS VNP46A2                 |
| Additional Baseline Data | NOAA VCMSLCFG                      |
| Satellite Processing     | Google Earth Engine                |
| Data Processing          | Python / Pandas                    |
| Backend                  | FastAPI + Uvicorn                  |
| Database                 | SQLite                             |
| Frontend Framework       | React 19 + Vite 8                  |
| Mapping                  | Leaflet.js + CartoDB Basemap Tiles |
| Geographic Data          | GeoJSON (PSA ADM3 boundaries)      |
| Charts                   | Recharts                           |
| AI                       | Gemini API (gemini-2.0-flash)      |
| Containerization         | Docker                             |
| Source Control           | Git / GitHub                       |

---

# 🚀 Setup & Installation

> Both servers are started together via `python run.py` from the project root.

## Prerequisites

| Tool    | Minimum Version | Notes                                |
| ------- | --------------- | ------------------------------------ |
| Python  | 3.11+           | Required for the FastAPI backend     |
| Node.js | 18+             | Required for the Vite/React frontend |
| npm     | 9+              | Included with Node.js                |
| Git     | Any             | For cloning the repository           |

## 1 — Clone the Repository

```bash
git clone https://github.com/jamesphillipdeguzman/sanag.git
cd sanag
```

## 2 — Backend Setup (Python / FastAPI)

```bash
# Create and activate a virtual environment
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

Start the backend server only (binds to `http://localhost:8000`):

```bash
uvicorn backend.main:app --reload --port 8000
```

Interactive API docs are available at `http://localhost:8000/docs` once the server is running.

## 3 — Frontend Setup (Node.js / Vite)

```bash
cd frontend
npm install
```

Start the Vite dev server only (binds to `http://localhost:5173`):

```bash
npm run dev
```

## 4 — Run Both Servers Together (Recommended)

From the project root (after activating the virtual environment):

```bash
python run.py
```

This script starts the FastAPI backend on port **8000** and the Vite frontend dev server on port **5173** simultaneously, and shuts both down cleanly on `Ctrl+C`.

---

# 🔧 Environment Configuration

Create a `.env` file in the **`backend/`** directory (see `backend/.env.example`). This file must **never** be committed to Git (it is already listed in `.gitignore`).

```env
# ─── backend/.env ─────────────────────────────────────────────────────────────

# Required — Google Gemini API key used for AI disaster-recovery briefings.
# Model: gemini-2.0-flash
# Obtain at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here
```

Create a `.env` file in the **`frontend/`** directory for frontend-only variables (see `frontend/.env.example`):

```env
# ─── frontend/.env ────────────────────────────────────────────────────────────

# Optional — Public search provider / CARTO basemap API key for incident media retrieval & map styling.
# Used by Leaflet map tiles and external incident media retrieval.
VITE_MY_API_KEY=your_search_provider_or_carto_api_key_here
```

### Variable Reference

| Variable | Description | Type / Scope | Location | Required |
| :--- | :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Authenticates calls to the Gemini API for AI-generated situational briefings. Without this key the `/api/generate-briefing` endpoint will return a 500 error. | Secret (Backend) | `backend/.env` | **Yes** |
| `VITE_MY_API_KEY` | Public search provider API key for incident media retrieval & CARTO basemap tiles. If omitted, falls back to direct DuckDuckGo/Wikimedia indexing and CARTO anonymous CDN. | Config (Client) | `frontend/.env` | No |

> **Security note:** Both `.env` files are in `.gitignore`. Never paste real API keys directly into source files or commit them to the repository.

---

# 📡 API Endpoints Reference

The FastAPI backend runs at `http://localhost:8000`. All endpoints are also browsable at `http://localhost:8000/docs` (Swagger UI) or `http://localhost:8000/redoc`.

## System

| Method | Endpoint | Description                                                                    |
| ------ | -------- | ------------------------------------------------------------------------------ |
| `GET`  | `/`      | Health-check — returns `{"status": "SANAG Engine Online", "version": "1.1.0"}` |

## Municipalities

| Method | Endpoint                 | Key Query Params              | Description                                                                                                          |
| ------ | ------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/municipalities` | `scope`, `region`, `province` | Returns monitored LGU list with ADM3_PCODE for Leaflet binding. Defaults to 93 Panay municipalities (`scope=panay`). |
| `GET`  | `/api/v1/regions`        | —                             | Returns nationwide regional centre coordinates and province metadata.                                                |

## Events

| Method | Endpoint                      | Key Query Params | Description                                                                                                                   |
| ------ | ----------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/events`              | —                | Lists all historical disaster and power-disruption events with computed affected population and VIIRS data availability flag. |
| `POST` | `/api/v1/events/import-gdacs` | —                | Imports a live GDACS alert as a new event record in the database.                                                             |

## GDACS Live Feeds

| Method | Endpoint                    | Key Query Params | Description                                                                                   |
| ------ | --------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/gdacs-live`        | `limit`          | Fetches real-time GDACS natural hazard alerts filtered for the Philippines (max 100 results). |
| `GET`  | `/api/v1/gdacs/alerts`      | `limit`          | Alias for `/api/v1/gdacs-live`.                                                               |
| `GET`  | `/api/v1/events/gdacs/live` | `limit`          | Alias for `/api/v1/gdacs-live`.                                                               |

## Recovery Engine

| Method | Endpoint                             | Key Query Params                                              | Description                                                                                                                                                                 |
| ------ | ------------------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/recovery-scores`            | `municipality`, `start_date`, `end_date`, `month`, `event_id` | Computes R(t) recovery scores for one or all municipalities across a date window. Returns `r_t`, `baseline_radiance`, `daily_radiance`, and `pcode` for direct map binding. |
| `GET`  | `/api/v1/events/{event_id}/radiance` | `municipality`, `observation_date`                            | Returns per-municipality radiance snapshot for a specific event date. Accepts event slug (e.g. `panay-blackout-2024`) or numeric ID.                                        |

## Timeline

| Method | Endpoint                                                | Key Query Params                                                        | Description                                                                      |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/resilience/timeline`                           | `municipality`, `muniId`, `start_date`, `end_date`, `month`, `event_id` | Day-by-day recovery timeline for a municipality via query params.                |
| `GET`  | `/api/v1/resilience/timeline/{municipality_identifier}` | `start_date`, `end_date`, `month`, `event_id`                           | Same as above but municipality is passed as a path segment (name or ADM3_PCODE). |

## Weather

| Method | Endpoint                     | Key Query Params                                  | Description                                                                                            |
| ------ | ---------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET`  | `/api/v1/weather/historical` | `start_date`, `end_date`, `latitude`, `longitude` | Historical daily weather data from Open-Meteo. Falls back to mock data if external API is unreachable. |
| `GET`  | `/api/v1/weather/forecast`   | `days`, `latitude`, `longitude`                   | Daily weather forecast for the Panay region (1–16 days).                                               |

## AI Briefing

| Method | Endpoint                    | Body / Params                                      | Description                                                                                                                               |
| ------ | --------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/v1/generate-briefing` | `{"event_context": "..."}` or `?event_context=...` | Generates an AI situational briefing using Gemini. Requires `GEMINI_API_KEY`. Also accessible at `/api/generate-briefing` (legacy alias). |
| `POST` | `/api/v1/executive-summary` | `{"event_context": "..."}`                         | Alias for `/api/v1/generate-briefing`.                                                                                                    |

## Image Search & Incident Media

| Method | Endpoint | Key Query Params | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/search-event-images` | `q`, `count`, `refresh`, `event_type` | Multi-source photojournalism search with DuckDuckGo indexing and Wikimedia/Openverse fallback. |
| `GET` | `/api/v1/search-event-images` | `q`, `count`, `refresh`, `event_type` | Versioned alias for incident photojournalism search. |
| `GET` | `/api/media/search` | `q`, `count`, `refresh`, `event_type` | RESTful media search alias. |

---

# 🔄 System Workflow

```text
NASA VIIRS
    ↓
Google Earth Engine
    ↓
Python Data Processing
    ↓
Data Cleaning & Validation
    ↓
Municipality Aggregation
    ↓
Baseline Calculation
    ↓
Event / Post-Event Data
    ↓
Recovery Ratio
    ↓
SQLite Database
    ↓
FastAPI
    ↓
Leaflet + Chart.js
    ↓
SANAG Dashboard
    ↓
Gemini AI Explanation
```

### Important Rule

The application calculates the actual metrics.

**Gemini only explains the validated results.**

Gemini should **not** calculate the Recovery Ratio.

---

# 📅 Development Plan

## Week 1 — Planning & Setup

### James

- Understand project requirements
- Define Recovery Ratio methodology
- Set up Python environment
- Set up Google Earth Engine
- Test VIIRS access
- Research January 2024 Panay event
- Plan database/API structure

### Katherine

- Define dashboard layout
- Prepare Panay GeoJSON
- Identify municipality names/IDs
- Create initial HTML/CSS
- Research Leaflet.js
- Plan map and chart interface

### Shared

- Freeze MVP scope
- Set up GitHub
- Define folder structure
- Agree on Recovery Ratio methodology
- Define team workflow

### Done when

- GitHub repository works
- GEE authentication works
- VIIRS test data works
- Panay GeoJSON is ready
- Basic frontend exists
- Recovery methodology is documented

---

# 🚀 Sprint 1 — Historical Data & Base Map

**Week 2**

### James

Build the initial satellite data pipeline.

- Connect to Google Earth Engine
- Retrieve NASA VIIRS data
- Process January 2024 data
- Apply Panay boundary
- Clean satellite observations
- Validate data
- Prepare municipality-level data

### Katherine

Build the initial map interface.

- Create dashboard HTML
- Create responsive CSS
- Add Leaflet.js
- Center map on Panay
- Add municipality boundaries
- Connect municipality IDs

### Sprint Demo

```text
VIIRS Data
    ↓
Municipality
    ↓
Panay Map
```

---

# 🚀 Sprint 2 — Recovery Engine & API

**Week 3**

### James

Build the core calculation system.

```text
VIIRS
 ↓
Clean Data
 ↓
Municipality
 ↓
Baseline
 ↓
Event
 ↓
Post-Event
 ↓
Recovery Ratio
```

Implement:

- SQLite database
- Event data
- Municipality data
- Baseline values
- Recovery observations
- Recovery Ratio
- Recovery classifications
- FastAPI endpoints

Example endpoints:

```text
/api/v1/events
/api/v1/events/{event_id}
/api/v1/municipalities
/api/v1/resilience/timeline
/api/v1/resilience/summary
```

### Katherine

Connect the frontend to the API.

- Event selector
- Municipality selector
- API requests
- Loading states
- Error states
- Recovery result containers

### Sprint Demo

The frontend receives **real recovery data from the backend**.

---

# 🚀 Sprint 3 — Maps & Analytics

**Week 4**

### James

Validate:

- Recovery calculations
- Municipality aggregation
- Timeline API
- Before/during/after data
- Comparison data
- Backend integration

### Katherine

Build the main dashboard experience.

#### Recovery Map

- Leaflet map
- Municipality recovery status
- Recovery legend
- Municipality selection

#### Charts

Use Chart.js to display:

- Baseline
- Event impact
- Post-event recovery
- Recovery curves
- Municipality comparisons
- Recovery timeline

### Sprint Demo

Users can:

```text
Select Event
     ↓
Select Municipality
     ↓
View Map
     ↓
View Recovery Ratio
     ↓
View Recovery Curve
     ↓
Compare Municipalities
```

---

# 🚀 Sprint 4 — Gemini, Integration & Deployment

**Week 5**

### James

- Integrate Gemini API
- Create briefing prompt
- Send validated recovery data to Gemini
- Handle API errors
- Secure API keys
- Optimize backend
- Prepare deployment

### Katherine

- Create Gemini briefing panel
- Add loading state
- Add error state
- Improve dashboard layout
- Improve navigation
- Improve mobile responsiveness
- Perform browser testing
- Final UI polish

### Final End-to-End Test

```text
Open SANAG
   ↓
Select January 2024 Event
   ↓
View Panay Municipalities
   ↓
Select Municipality
   ↓
Load Satellite Data
   ↓
Calculate Recovery
   ↓
Display Recovery Ratio
   ↓
Display Recovery Curve
   ↓
Compare Municipalities
   ↓
Generate Gemini Briefing
```

---

# 📚 Week 7 — Finalization & Submission

There is a gap after the main development sprints for final preparation.

### James

- Clean backend
- Remove debugging code
- Document database
- Document GEE setup
- Document API
- Document methodology
- Document data processing
- Document Gemini integration
- Verify no secrets are committed

### Katherine

- Final screenshots
- Final UI polish
- Presentation visuals
- Demo preparation
- Workflow documentation

### Shared

- Clean GitHub repository
- Update README
- Document installation
- Document architecture
- Document limitations
- Final testing
- Record video
- Complete submission worksheet

---

# 📁 Project Structure

```text
sanag-project/
│
├── backend/
│   ├── api/
│   │   ├── routes.py
│   │   ├── models.py
│   │   └── __init__.py
│   │
│   ├── engine/
│   │   ├── gee_client.py
│   │   ├── calculator.py
│   │   └── __init__.py
│   │
│   ├── db/
│   │   ├── database.py
│   │   └── schema.sql
│   │
│   ├── main.py
│   └── requirements.txt
│
├── frontend/
│   ├── index.html
│   │
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   ├── app.js
│   │   ├── map.js
│   │   └── charts.js
│   │
│   └── data/
│       └── panay_lgu.geojson
│
├── docs/
│   ├── architecture/
│   ├── methodology/
│   └── screenshots/
│
├── .env
├── .gitignore
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# 🌿 Git Workflow

Use feature branches instead of working directly on `main`.

### James

```text
feature/gee-extraction
feature/recovery-engine
feature/fastapi-backend
```

### Katherine

```text
feature/leaflet-map-ui
feature/chartjs-analytics
feature/responsive-ui
```

### Workflow

```text
main
 ↓
Feature Branch
 ↓
Develop
 ↓
Test
 ↓
Push
 ↓
Pull Request
 ↓
Code Review
 ↓
Merge
```

Both team members should review each other's Pull Requests.

---

# 🔐 Security

**Never commit:**

- Gemini API keys
- Google Earth Engine credentials
- Service-account credentials
- Passwords
- Tokens
- Private keys

Use `.env` for local secrets.

Example:

```text
GEMINI_API_KEY=your_key_here
```

The `.env` file must remain in `.gitignore`.

---

# 📊 MVP Features

The minimum working product should include:

- [x] Panay Island map
- [x] Municipality boundaries
- [x] NASA VIIRS data
- [x] Historical event selection
- [x] Baseline calculation
- [x] Recovery Ratio
- [x] Recovery classification
- [x] Recovery timeline
- [x] Municipality comparison
- [x] FastAPI backend
- [x] SQLite database
- [x] Leaflet map
- [x] Chart.js charts
- [x] Responsive interface
- [ ] Gemini AI briefing

Gemini is important, but the **core recovery analysis should work without it**.

---

# ⚠️ Technical Limitations & Assumptions

SANAG uses NASA VIIRS nighttime-light satellite observations as a **proxy indicator** of power-grid recovery. This methodology carries inherent constraints that users and evaluators must understand.

## NASA VIIRS Satellite Data (VNP46A2)

| Constraint              | Detail                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Temporal resolution** | Daily composites; one observation per 24-hour pass over Panay Island. A single cloudy overpass produces a data gap that cannot be filled retroactively.                                                             |
| **Spatial resolution**  | ~500 m pixel grid. Small barangays or sparsely populated municipalities may fall within a single pixel, limiting granularity below the LGU level.                                                                   |
| **Radiance units**      | Measurements are in nanoWatts/cm²/sr. Raw values are not directly interpretable as electricity kilowatt-hours or grid voltage — they represent reflected and emitted visible-infrared light, not power consumption. |
| **Overpass timing**     | The Suomi NPP satellite passes over the Philippines during late local evening hours. Observations therefore capture activity during a narrow nighttime window, not 24-hour load.                                    |
| **Data latency**        | Level-2 VNP46A2 gap-filled products are typically published 5–7 days after observation date. Near-real-time assessment is not possible using this dataset alone.                                                    |

## Cloud Occlusion Over Panay Island

The Western Visayas region experiences persistent cloud cover, particularly during the southwest monsoon (*habagat*, June–October) and typhoon season. This creates several compounding issues:

- **Missing observations:** Thick cloud cover causes the satellite sensor to record `NaN` or zero-fill values rather than surface light. The recovery pipeline treats missing observations as data gaps and applies fallback date matching (nearest valid observation within ±3 days).
- **Systematically underestimated recovery:** If cloud cover coincidentally peaks in the days following a typhoon or blackout, the satellite will record low radiance even if power has been partially restored on the ground. This can make recovery appear slower than it actually is.
- **January 2024 context:** The January 2024 Panay blackout event (the primary case study) occurred during the northeast monsoon (*amihan*). While cloud cover is generally lower in this season, multi-day cloud gaps are still present in the VIIRS record and are handled by the fallback logic in `calculator.py`.

## Proxy Indicator Interpretation

The Recovery Ratio R(t) = Post-Event Light / Baseline Light is a **proxy**, not a ground-truth measurement. The following assumptions are made:

1. **Stable baseline assumption:** The pre-event monthly baseline radiance (`baselines` table) is assumed to reflect normal operating conditions for that municipality. Seasonal variations, population growth, or infrastructure changes between the baseline period and the event can introduce systematic bias.
2. **Light ≠ Power:** Areas with generators, emergency lighting, or festival lighting may report higher-than-expected post-event radiance even when the central grid has not recovered. Conversely, sudden widespread evacuation or curfews can suppress radiance independently of grid status.
3. **Municipality-level aggregation:** Radiance observations are spatially averaged over the administrative boundary of each municipality (ADM3). Intra-municipality variation — for example, a town centre recovering while rural barangays remain dark — is not captured.
4. **Single event focus:** SANAG is designed and validated around the **January 2024 Panay Island grid disruption**. Application to other events or regions requires independent baseline recalculation and data validation.
5. **No physical grid data:** SANAG does not integrate actual distribution utility (DU) restoration reports, outage tickets, or WESM (Wholesale Electricity Spot Market) data. Recovery Ratio scores should be cross-referenced with official DU reports for operational decisions.

> **SANAG estimates recovery based on observed nighttime-light changes. It does not directly measure electrical voltage, current, or physical grid infrastructure. Results are analytical indicators intended for academic and situational-awareness purposes only.**

---

# 🔮 Future Improvements & Scalability Roadmap

As SANAG scales from its initial Panay Island baseline into a comprehensive nationwide disaster response and power grid intelligence platform, the following scalable milestones define the development roadmap:

1. **Nationwide Province Expansion**:
   - Add support for uploading custom provincial GeoJSON boundaries and vector tiles to analyze power recovery outside Panay Island (e.g., Region IV-A CALABARZON, Region VII Central Visayas, Region VIII Eastern Visayas, and Northern/Southern Mindanao).
   - Enable plug-and-play ingestion of multi-scale administrative layers (ADM2 provincial, ADM3 municipal, and ADM4 barangay levels) with dynamic spatial indexing and on-the-fly raster aggregation.

2. **Automated GDACS-to-Region Linkage**:
   - Implement spatial bounding-box (`bbox`) and polygon intersection logic to automatically map live GDACS hazard coordinates and centroid alerts to target LGU boundaries upon ingestion.
   - Automatically trigger pre-calibrated baseline lookups and regional recovery timelines as soon as live seismic, cyclonic, or flood events are imported into the engine, removing manual geographic configuration.

3. **Multi-Sensor Fusion (SAR & Cloud Penetration)**:
   - Integrate Sentinel-1 Synthetic Aperture Radar (SAR) observations alongside NASA VIIRS Day-Night Band imagery to ensure continuous, all-weather, cloud-penetrating damage assessment during active typhoon seasons.

4. **Distribution Utility Telemetry Ingestion**:
   - Establish automated webhooks and ingestion pipelines with regional electric cooperatives (e.g., ILECO, ANTECO, CAPELCO, AKELCO) and WESM grid dispatch telemetry to ground-truth satellite estimates against physical substation feeder telemetry.

---

# 🎯 Priority If We Run Out of Time

Build in this order:

1. **Working VIIRS data**
2. **Correct Recovery Ratio**
3. **FastAPI backend**
4. **Municipality map**
5. **Recovery charts**
6. **End-to-end integration**
7. **Gemini briefing**
8. **UI polish**

The project should prioritize **correct data and a working system over extra features**.

---

# 👥 Responsibility Summary

| Area                     | James | Katherine |
| ------------------------ | :---: | :-------: |
| Requirements             |   🤝   |     🤝     |
| Architecture             |   🤝   |     🤝     |
| GEE                      |   ✅   |           |
| VIIRS Data               |   ✅   |           |
| Data Cleaning            |   ✅   |           |
| Municipality Aggregation |   ✅   |           |
| Recovery Calculation     |   ✅   |           |
| Recovery Engine          |   ✅   |           |
| SQLite                   |   ✅   |           |
| FastAPI                  |   ✅   |           |
| API Testing              |   ✅   |     🤝     |
| GeoJSON                  |       |     ✅     |
| Leaflet                  |       |     ✅     |
| HTML/CSS                 |       |     ✅     |
| Responsive UI            |       |     ✅     |
| Chart.js                 |       |     ✅     |
| Recovery Map             |       |     🤝     |
| Recovery Charts          |       |     🤝     |
| Gemini Backend           |   ✅   |           |
| Gemini UI                |       |     ✅     |
| Integration              |   🤝   |     🤝     |
| Testing                  |   🤝   |     🤝     |
| Deployment               |   🤝   |     🤝     |
| Documentation            |   🤝   |     🤝     |
| Video                    |   🤝   |     🤝     |
| Final Submission         |   🤝   |     🤝     |

---

# 🎥 Final Video

📺 **Watch Presentation / Demo:** **[https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID](https://www.youtube.com/watch?v=YOUR_DEMO_VIDEO_ID)** *(Replace with your YouTube demo link)*

Target length: **5–8 minutes**

Suggested structure:

1. Problem
2. Why nighttime satellite data?
3. SANAG solution
4. System architecture
5. Data pipeline
6. Dashboard demonstration
7. Recovery analysis
8. Gemini briefing
9. Limitations
10. Future improvements

**Both James and Katherine should participate in the presentation.**

---

# ✅ Final Definition of Done

SANAG is complete when:

- [ ] VIIRS data can be retrieved and processed
- [ ] Panay municipalities are mapped
- [ ] Baseline values are calculated
- [ ] Recovery Ratio is calculated correctly
- [ ] Municipalities receive recovery classifications
- [ ] Recovery timelines work
- [ ] Backend API works
- [ ] Frontend receives real API data
- [ ] Map and charts display correct results
- [ ] Gemini briefing works
- [ ] Application works end-to-end
- [ ] No secrets are committed
- [ ] Documentation is complete
- [x] Project is deployed: [https://sanag.vercel.app/](https://sanag.vercel.app/)
- [ ] Video presentation is recorded
- [ ] Final submission is ready

---

## 🏁 SANAG in One Sentence

> **SANAG uses satellite nighttime-light data to help visualize and measure how Panay Island municipalities recover from major disasters and power disruptions.**
> 
### 💡 Favorite Quotes

> *"And behold, I tell you these things that ye may learn wisdom; that ye may learn that when ye are in the service of your fellow beings ye are only in the service of your God."*
> 
> — **James Phillip De Guzman** *(Mosiah 2:17)*

> *"No man can serve two masters; for either he will hate the one and love the other, or else he will hold to the one and despise the other."*
> 
> — **Katherine Cendana** *(3 Nephi 13:24)*