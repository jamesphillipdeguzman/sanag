# Changelog

All notable changes to **Project SANAG** (Satellite Analytics for Nightlight & Assessment Grid) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-10-09

### Added
- **5-Step Narrative Journey Navigation**: Reorganized navigation into an intuitive, sequential disaster workflow (`Home` → `Events` (Step 1) → `Map` (Step 2) → `Recovery` (Step 3) → `Summary` (Step 4) → `Guide & Glossary`).
- **Interactive Home Launchpad**: Redesigned landing page featuring a provocative narrative hook, compact environmental status ribbon (5-day weather & GDACS ticker), and a clean 4-step horizontal roadmap.
- **Dedicated Executive Summary View (`SummaryView.tsx`)**: Created a centralized synthesis view consolidating island-wide KPIs, AI Situational Briefing (Gemini 2.5 Flash), and inline Substation & Transmission Infrastructure status.
- **Active Event Traceability**: Added persistent event baseline context headers across the municipality telemetry sidebar (in both active and standby states) and a floating event brief in maximized map view.
- **Dynamic GDACS Alert Badges**: Maximized map view now dynamically adapts badge colors, glows, and borders to match hazard severity levels (Red / Orange / Green).
- **Radial Grid & Hazard Buffers**: Added tooltips and legend indicators explaining the yellow dashed secondary grid stress buffer (35 km) and primary outage impact rings.

### Changed
- **Header Simplification**: Removed the redundant version pill (`v1.2.0`) and relocated the active substations dropdown from `Navbar.tsx` to the Summary view.
- **Enlarged VIIRS Scale Ruler**: Scaled up `ViirsScaleRuler.tsx` card dimensions, typography, and tick mark heights for better readability and contrast.
- **Dynamic Administrative Scope Labels**: Replaced static "Region" prefix with dynamic tiers (`Municipality`, `City`, `Province`, `Region`, `Scope`) synchronized between the tree selector and Leaflet polygons.

### Fixed
- **Runtime ReferenceError**: Resolved `findLguQuickLookup is not defined` crash in `RegionTreeSelector.tsx` when picking municipalities.
- **Leaflet Refresh Bounds**: Added optional chaining and boundary checks in `PanayMap.tsx` during map refreshes to prevent `_pxBounds` undefined exceptions.
- **Mobile Viewport Collisions**: Fixed GDACS modal overlay inversion over the VIIRS scale widget and eliminated left-edge search bar truncation on mobile screens.
- **Historical Event Simulation Toggle**: Standardized simulation identifiers so clicking "Simulate Event" on historical disaster archives correctly triggers the "Active Simulation" state.
- **Map Tab Re-centering Drift**: Removed animated fly/pan transitions when navigating back to the Map tab, locking GeoJSON polygons directly to base tiles.

---

## [1.2.0] - 2026-10-07
- Corrected Panay Island LGU baseline to 95 monitored municipalities.
- Integrated dual-axis 500m VIIRS ground resolution calibration ruler.
- Added scope filter toggle between Panay Island (95 LGUs) and Nationwide (187 LGUs).
- Stabilized Gemini AI situational intelligence fallbacks and markdown parsing.

## [1.1.0] - 2026-09-30
- Live GDACS hazard stream integration and 1-click event simulation.
- Multi-LGU recovery trajectory curve plotting via SVG charting.
- CartoDB Dark Matter tile integration with 2D Canvas rendering optimization.

## [1.0.0] - 2026-09-15
- Initial production release for Panay Island power grid resilience monitoring.
- Automated daily NASA VIIRS VNP46A2 DNB radiance ingestion pipeline via Google Earth Engine.
- Normalized Power Restoration Index (NPRI) calculation engine.