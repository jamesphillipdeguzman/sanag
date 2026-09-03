# SANAG — Satellite Analytics for Nightlight & Assessment Grid

**Senior Project — Panay Island, Philippines**

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

| Area                     | Technology                      |
| ------------------------ | ------------------------------- |
| Satellite Data           | NASA VIIRS VNP46A2              |
| Additional Baseline Data | NOAA VCMSLCFG                   |
| Satellite Processing     | Google Earth Engine             |
| Data Processing          | Python / Pandas                 |
| Backend                  | FastAPI                         |
| Database                 | SQLite                          |
| API Server               | Uvicorn                         |
| Frontend                 | HTML / CSS / Vanilla JavaScript |
| Mapping                  | Leaflet.js                      |
| Geographic Data          | GeoJSON                         |
| Charts                   | Chart.js                        |
| AI                       | Gemini API                      |
| Containerization         | Docker                          |
| Source Control           | Git / GitHub                    |

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

# ⚠️ Project Limitations

SANAG uses nighttime-light satellite observations as an indicator of recovery.

Nighttime light can be affected by:

- Cloud cover
- Atmospheric conditions
- Temporary lighting
- Fires
- Construction
- Seasonal changes
- Satellite limitations
- Missing observations

Therefore:

> **SANAG estimates recovery based on observed nighttime-light changes. It does not directly measure electrical voltage, current, or physical grid infrastructure.**

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
- [ ] Project is deployed
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