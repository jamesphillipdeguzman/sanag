from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import os
import re
import urllib.parse
import httpx
import sqlite3
import math
import logging
import asyncio
from pathlib import Path

import sys
_backend_dir = Path(__file__).resolve().parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

# Load environment variables from .env files
try:
    from dotenv import load_dotenv
    load_dotenv(_backend_dir / ".env")
    load_dotenv(_backend_dir.parent / ".env")
except ImportError:
    pass

from datetime import datetime, timezone
from functools import lru_cache
from typing import List, Optional, Dict, Any, Union, Tuple
from calculator import compute_recovery_index
from weather_service import (
    fetch_historical_weather,
    fetch_weather_forecast,
    get_fallback_weather_forecast,
    get_fallback_historical_weather,
)
from ai_briefing import generate_recovery_briefing
from contextlib import asynccontextmanager
from seed_events import seed_observations_for_all_events, seed_single_event, to_naive_utc
from gdacs_service import get_latest_philippines_disasters, EVENT_TYPE_MAP, check_viirs_data_availability

logger = logging.getLogger(__name__)

# --- 1. Define your lifespan startup handler ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs automatically on application startup
    try:
        from database import get_db_connection, seed_historical_event_profiles
        conn = get_db_connection(DB_PATH)
        seed_historical_event_profiles(conn)
        conn.close()
    except Exception as e:
        print(f"Startup event profile seeding error: {e}")

    try:
        print("Running automatic database seeding for events...")
        seed_observations_for_all_events()
    except Exception as e:
        print(f"Startup seeding error: {e}")
    yield

# --- 2. Initialize FastAPI ONCE with the lifespan attached ---
app = FastAPI(
    title="SANAG API",
    description="Satellite Analytics for Nightlight & Assessment Grid - Backend API",
    version="1.1.0",
    lifespan=lifespan
)

# Enable GZip compression to keep response payloads well below 32KB buffer limits
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Allow production domain and local dev
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", 
    "https://sanag.vercel.app,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend assets (e.g., images) if directory exists
images_dir = Path(__file__).resolve().parent.parent / "frontend" / "public" / "images"
if images_dir.is_dir():
    from fastapi.staticfiles import StaticFiles
    app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

# --- Pydantic Response Shapes ---

class MunicipalityItem(BaseModel):
    name: str
    pcode: str
    province: Optional[str] = None
    region: Optional[str] = None

class MunicipalityResponse(BaseModel):
    municipalities: List[str]
    items: Optional[List[MunicipalityItem]] = None
    total_count: Optional[int] = None
    scope: Optional[str] = None

class EventModel(BaseModel):
    id: str
    municipality_code: Optional[str] = None
    name: str
    description: Optional[str] = None
    date: str
    category: str
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    type: Optional[str] = None
    resource_url: Optional[str] = None
    image_url: Optional[str] = None
    affected_population: Optional[int] = None
    critical_municipalities: Optional[List[Dict[str, Any]]] = None
    viirs_data_available: Optional[bool] = None
    event_type: Optional[str] = None
    disaster_category: Optional[str] = None
    root_cause_summary: Optional[str] = None
    infrastructure_impact: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[EventModel]

class GDACSImportRequest(BaseModel):
    event_id: Union[str, int]
    name: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    alert_level: Optional[str] = "Green"
    date: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    affected_population: Optional[int] = None
    window_days: Optional[int] = 14
    force: Optional[bool] = False

class RecoveryScoresResponse(BaseModel):
    records_count: int
    data: List[Dict[str, Any]]

class TimelineResponse(BaseModel):
    municipality: str
    pcode: Optional[str] = None
    timeline: List[Dict[str, Any]]


# --- Population Cache & Aggregation Logic ---

_MUNICIPALITY_POP_CACHE: Optional[Dict[str, int]] = None

def get_municipality_population_lookup() -> Dict[str, int]:
    global _MUNICIPALITY_POP_CACHE
    if _MUNICIPALITY_POP_CACHE is not None:
        return _MUNICIPALITY_POP_CACHE
    try:
        from loader import load_philippines_boundaries_geojson
        fc = load_philippines_boundaries_geojson()
        pop_map = {}
        for f in fc.get("features", []):
            props = f.get("properties", {})
            pcode = props.get("ADM3_PCODE") or props.get("psgc_id") or props.get("psgc_code")
            name = props.get("ADM3_EN") or props.get("psgc_name") or props.get("name")
            area = float(props.get("AREA_SQKM", 50))
            pop = round(area * 860)
            if pcode:
                pop_map[pcode] = pop
                pop_map[pcode.lower()] = pop
            if name:
                pop_map[name.lower()] = pop
        _MUNICIPALITY_POP_CACHE = pop_map
        return pop_map
    except Exception as e:
        print(f"Error loading municipality population lookup: {e}")
        _MUNICIPALITY_POP_CACHE = {}
        return {}

def compute_event_affected_population(cursor: sqlite3.Cursor, event_date: Optional[str]) -> int:
    """
    Sums the population totals of all municipalities flagged as affected
    or under critical thresholds (R(t) < 0.60 or < 0.90) for an event date.
    """
    if not event_date:
        return 0
    try:
        pop_lookup = get_municipality_population_lookup()

        query = """
            SELECT 
                o.municipality_name,
                COALESCE(o.municipality_pcode, m.code) AS pcode,
                o.daily_radiance,
                COALESCE(
                    (SELECT b1.baseline_radiance FROM baselines b1 
                     WHERE (b1.municipality_name = o.municipality_name OR b1.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                       AND b1.baseline_radiance IS NOT NULL 
                       AND (b1.month_date = substr(o.observation_date, 1, 7) OR b1.month_date = substr(o.observation_date, 1, 7) || '-01')
                     LIMIT 1),
                    (SELECT b2.baseline_radiance FROM baselines b2 
                     WHERE (b2.municipality_name = o.municipality_name OR b2.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                       AND b2.baseline_radiance IS NOT NULL 
                       AND (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) <= o.observation_date
                     ORDER BY (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) DESC LIMIT 1),
                    0.75
                ) AS baseline_radiance
            FROM radiance_observations o
            LEFT JOIN municipalities m ON (o.municipality_name = m.name OR o.municipality_pcode = m.code)
            WHERE o.observation_date = ?
        """
        cursor.execute(query, (event_date,))
        rows = cursor.fetchall()

        if not rows:
            cursor.execute("""
                SELECT observation_date, ABS(JULIANDAY(observation_date) - JULIANDAY(?)) AS diff
                FROM radiance_observations
                ORDER BY diff ASC LIMIT 1
            """, (event_date,))
            nearest = cursor.fetchone()
            if nearest and nearest["diff"] is not None and nearest["diff"] <= 3:
                cursor.execute(query, (nearest["observation_date"],))
                rows = cursor.fetchall()

        if not rows:
            return 0

        crit_warn_pop = 0
        unrestored_pop = 0

        for r in rows:
            rad = r["daily_radiance"]
            base = r["baseline_radiance"]
            if rad is None or base is None or base <= 0:
                continue
            r_t = rad / base
            pcode = r["pcode"]
            name = (r["municipality_name"] or "").lower()
            pop = pop_lookup.get(pcode, pop_lookup.get(name, 80000))

            if r_t < 0.60:
                crit_warn_pop += pop
            if r_t < 0.90:
                unrestored_pop += pop

        return crit_warn_pop if crit_warn_pop > 0 else unrestored_pop
    except Exception as e:
        print(f"Error computing affected population for date {event_date}: {e}")
        return 0

def compute_event_critical_municipalities(cursor: sqlite3.Cursor, event_date: Optional[str], limit: int = 5) -> List[Dict[str, Any]]:
    """
    Returns the top severely affected municipalities (ranked by lowest R(t) recovery ratio)
    for an event date, ensuring a robust list of multiple critical LGUs (e.g. top 4-5) is returned
    rather than a truncated single-item list.
    """
    if not event_date:
        return []
    try:
        query = """
            SELECT 
                o.municipality_name,
                COALESCE(o.municipality_pcode, m.code) AS pcode,
                o.daily_radiance,
                COALESCE(
                    (SELECT b1.baseline_radiance FROM baselines b1 
                     WHERE (b1.municipality_name = o.municipality_name OR b1.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                       AND b1.baseline_radiance IS NOT NULL 
                       AND (b1.month_date = substr(o.observation_date, 1, 7) OR b1.month_date = substr(o.observation_date, 1, 7) || '-01')
                     LIMIT 1),
                    (SELECT b2.baseline_radiance FROM baselines b2 
                     WHERE (b2.municipality_name = o.municipality_name OR b2.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                       AND b2.baseline_radiance IS NOT NULL 
                       AND (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) <= o.observation_date
                     ORDER BY (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) DESC LIMIT 1),
                    0.75
                ) AS baseline_radiance
            FROM radiance_observations o
            LEFT JOIN municipalities m ON (o.municipality_name = m.name OR o.municipality_pcode = m.code)
            WHERE o.observation_date = ?
        """
        cursor.execute(query, (event_date,))
        rows = cursor.fetchall()

        if not rows and event_date:
            cursor.execute("""
                SELECT observation_date, ABS(JULIANDAY(observation_date) - JULIANDAY(?)) AS diff
                FROM radiance_observations
                ORDER BY diff ASC LIMIT 1
            """, (event_date,))
            nearest = cursor.fetchone()
            if nearest and nearest["diff"] is not None and nearest["diff"] <= 3:
                cursor.execute(query, (nearest["observation_date"],))
                rows = cursor.fetchall()

        results = []
        for r in rows:
            rad = r["daily_radiance"]
            base = r["baseline_radiance"]
            if rad is None or base is None or base <= 0:
                continue
            r_t = round(rad / base, 4)
            score = max(0, min(100, round(r_t * 100)))
            results.append({
                "name": r["municipality_name"],
                "pcode": r["pcode"] or "UNKNOWN",
                "recovery_score": score,
                "r_t": r_t,
                "status": "critical" if score < 40 else "warning" if score < 60 else "recovering" if score < 90 else "restored"
            })

        results.sort(key=lambda x: (x["r_t"], x["recovery_score"]))
        return results[:limit]
    except Exception as e:
        print(f"Error computing critical municipalities for date {event_date}: {e}")
        return []


# --- Endpoints ---

@app.get("/", tags=["System"])
def read_root():
    return {"status": "SANAG Engine Online", "docs": "/docs", "version": "1.1.0"}


@app.get("/health", tags=["System"])
@app.get("/api/health", tags=["System"])
@app.get("/api/v1/health", tags=["System"])
def health_check():
    return {
        "status": "healthy",
        "service": "sanag-backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.1.0"
    }


@app.get("/api/v1/municipalities", response_model=MunicipalityResponse, tags=["Municipalities"])
def get_municipalities(
    scope: Optional[str] = Query("panay", description="Scope: 'panay' (default, 95 LGUs), 'nationwide', or region code"),
    region: Optional[str] = Query(None, description="Optional region code/name filter"),
    province: Optional[str] = Query(None, description="Optional province code/name filter")
):
    """
    Returns monitored municipalities with their ADM3_PCODE/PSGC for geospatial binding.
    Defaults to Panay Island (95 municipalities) to preserve default focused behavior,
    while supporting nationwide inspection when scope='nationwide' or region/province is queried.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        where_clauses = []
        params = []

        if province:
            where_clauses.append("(LOWER(province_name) = ? OR LOWER(province_code) = ?)")
            params.extend([province.lower().strip(), province.lower().strip()])
        elif region:
            where_clauses.append("(LOWER(region_name) LIKE ? OR LOWER(region_code) = ?)")
            params.extend([f"%{region.lower().strip()}%", region.lower().strip()])
        elif scope and scope.lower().strip() in ["panay", "panay_island"]:
            # Panay Island 4 provinces
            where_clauses.append("province_name IN ('Aklan', 'Antique', 'Capiz', 'Iloilo')")

        sql = "SELECT name, code, province_name, region_name FROM municipalities"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += " ORDER BY name ASC"

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        conn.close()

        items = [
            {
                "name": row["name"], 
                "pcode": row["code"],
                "province": row["province_name"] if "province_name" in row.keys() else None,
                "region": row["region_name"] if "region_name" in row.keys() else None
            } 
            for row in rows
        ]
        return {
            "municipalities": [row["name"] for row in rows],
            "items": items,
            "total_count": len(rows),
            "scope": scope or "panay"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/regions", tags=["Municipalities"])
def get_regions():
    """
    Returns nationwide regional centers and boundaries metadata,
    defaulting to Panay Island focus.
    """
    try:
        try:
            from generate_nationwide_boundaries import PHILIPPINE_REGIONS
        except ImportError:
            from backend.generate_nationwide_boundaries import PHILIPPINE_REGIONS
        regions_list = []
        for reg in PHILIPPINE_REGIONS:
            regions_list.append({
                "name": reg["region_name"],
                "code": reg["region_code"],
                "center": reg["center"],
                "zoom": reg["zoom"],
                "provinces": [p["name"] for p in reg["provinces"]],
                "is_default": "Western Visayas" in reg["region_name"]
            })
        return {
            "status": "success",
            "default_region": "Region VI (Western Visayas)",
            "default_center": [11.0, 122.5],
            "default_zoom": 8,
            "regions": regions_list
        }
    except Exception as e:
        return {
            "status": "fallback",
            "default_region": "Region VI (Western Visayas)",
            "default_center": [11.0, 122.5],
            "default_zoom": 8,
            "regions": [
                {
                    "name": "Region VI (Western Visayas)",
                    "code": "PH06",
                    "center": [11.0, 122.5],
                    "zoom": 8,
                    "provinces": ["Aklan", "Antique", "Capiz", "Iloilo", "Guimaras", "Negros Occidental"],
                    "is_default": True
                }
            ]
        }


@app.get("/api/v1/events/presets", tags=["Events"])
def get_event_presets():
    """
    Returns the verified Panay disaster event presets catalog (VIIRS epoch: 2012–present).
    """
    from event_presets import get_presets
    return get_presets()


@app.get("/api/v1/events", response_model=EventsResponse, tags=["Events"])
def get_events():
    """
    Returns all historical disaster and power disruption event records
    with computed total affected population based on municipal radiance recovery,
    structured event metadata, and root-cause contextual attributes.
    """
    try:
        from event_presets import get_presets
        from database import get_event_profile
        presets_list = get_presets()
        presets_by_id = {p["id"]: p for p in presets_list}

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check actual table schema to dynamically alias columns safely
        cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
        has_root_cause = "event_type" in cols
        has_metadata = "start_date" in cols and "resource_url" in cols
        
        if has_root_cause:
            sql = """
                SELECT id, municipality_code, name, description, date, category, image_url,
                       start_date, end_date, type, resource_url,
                       event_type, disaster_category, root_cause_summary, infrastructure_impact
                FROM events ORDER BY date DESC
            """
        elif has_metadata:
            sql = """
                SELECT id, municipality_code, name, description, date, category, image_url,
                       start_date, end_date, type, resource_url
                FROM events ORDER BY date DESC
            """
        elif "event_title" in cols:
            sql = """
                SELECT 
                    id, 
                    affected_pcode AS municipality_code, 
                    event_title AS name, 
                    description, 
                    event_date AS date, 
                    event_type AS category, 
                    NULL AS image_url 
                FROM events ORDER BY event_date DESC
            """
        else:
            sql = "SELECT id, municipality_code, name, description, date, category, image_url FROM events ORDER BY date DESC"
            
        cursor.execute(sql)
        rows = cursor.fetchall()

        events = []
        seen_ids = set()

        for row in rows:
            event = dict(row)
            ev_id = str(event.get("id", "")).strip()
            name = str(event.get("name", "")).strip()

            # Filter out erroneous/non-existent and pre-VIIRS events
            if (
                ev_id in {"gdacs-1568718", "1568718", "panay-earthquake-1990", "19900614", "gdacs-19900614", "odette", "typhoon-tino", "gdacs-tc-odette-2021"}
                or "1990" in name
                or "Panay Fault" in name
                or ("Odette" in name and "Rai" not in name)
            ):
                continue

            if ev_id in seen_ids:
                continue
            seen_ids.add(ev_id)

            event["id"] = ev_id
            date_val = str(event["date"]) if event.get("date") is not None else None
            
            # Enrich with preset metadata if available
            preset_match = presets_by_id.get(ev_id)
            if not preset_match:
                for p in presets_list:
                    if p["name"].lower() == name.lower() or p.get("startDate") == date_val:
                        preset_match = p
                        break

            event["startDate"] = event.get("start_date") or (preset_match.get("startDate") if preset_match else date_val)
            event["endDate"] = event.get("end_date") or (preset_match.get("endDate") if preset_match else None)
            event["type"] = event.get("type") or (preset_match.get("type") if preset_match else "typhoon" if "typhoon" in event.get("category", "").lower() else "grid_failure" if "power" in event.get("category", "").lower() else "monsoon_flood")
            event["resource_url"] = event.get("resource_url") or (preset_match.get("resource_url") if preset_match else None)

            # Enrich root cause contextual parameters
            prof = get_event_profile(ev_id) or get_event_profile(name)
            event["event_type"] = event.get("event_type") or (preset_match.get("event_type") if preset_match else None) or (prof.get("event_type") if prof else None)
            event["disaster_category"] = event.get("disaster_category") or (preset_match.get("disaster_category") if preset_match else None) or (prof.get("disaster_category") if prof else None)
            event["root_cause_summary"] = event.get("root_cause_summary") or (preset_match.get("root_cause_summary") if preset_match else None) or (prof.get("root_cause_summary") if prof else None)
            event["infrastructure_impact"] = event.get("infrastructure_impact") or (preset_match.get("infrastructure_impact") if preset_match else None) or (prof.get("infrastructure_impact") if prof else None)

            # Compute total affected population dynamically from satellite observations
            event["affected_population"] = compute_event_affected_population(cursor, date_val)
            event["critical_municipalities"] = compute_event_critical_municipalities(cursor, date_val, limit=5)
            # Check confirmed NASA VIIRS nightlight radiance data across Panay LGU grid
            event["viirs_data_available"] = check_viirs_data_availability(date_val, conn=conn)
            events.append(event)

        conn.close()

        # Sort all historical events in reverse chronological order (newest / most recent first)
        events.sort(
            key=lambda ev: str(ev.get("startDate") or ev.get("start_date") or ev.get("date") or ""),
            reverse=True
        )

        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/events/{event_id}", response_model=EventModel, tags=["Events"])
def get_event_by_id(event_id: str):
    """
    Returns single disaster event details including event context, root cause narrative,
    affected population, and critical municipalities.
    """
    try:
        from event_presets import get_presets
        from database import get_event_profile
        presets_list = get_presets()
        presets_by_id = {p["id"]: p for p in presets_list}

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
        has_root_cause = "event_type" in cols

        # Check direct ID or common aliases
        query_ids = [event_id]
        alias_pairs = {
            "panay-grid-collapse-2024": "panay-blackout-2024",
            "panay-blackout-2024": "panay-grid-collapse-2024",
            "typhoon-odette-2021": "typhoon-rai-2021",
            "typhoon-rai-2021": "typhoon-odette-2021",
        }
        if event_id in alias_pairs:
            query_ids.append(alias_pairs[event_id])

        placeholders = ",".join("?" for _ in query_ids)
        if has_root_cause:
            sql = f"""
                SELECT id, municipality_code, name, description, date, category, image_url,
                       start_date, end_date, type, resource_url,
                       event_type, disaster_category, root_cause_summary, infrastructure_impact
                FROM events WHERE id IN ({placeholders}) LIMIT 1
            """
        else:
            sql = f"""
                SELECT id, municipality_code, name, description, date, category, image_url,
                       start_date, end_date, type, resource_url
                FROM events WHERE id IN ({placeholders}) LIMIT 1
            """

        cursor.execute(sql, query_ids)
        row = cursor.fetchone()

        preset_match = presets_by_id.get(event_id)
        if not preset_match and event_id in alias_pairs:
            preset_match = presets_by_id.get(alias_pairs[event_id])

        if not row and not preset_match:
            conn.close()
            raise HTTPException(status_code=404, detail=f"Event '{event_id}' not found")

        event = dict(row) if row else {}
        if not event:
            event["id"] = event_id
            if preset_match is not None:
                event["name"] = preset_match.get("name", event_id)
                event["description"] = preset_match.get("description")
                event["date"] = preset_match.get("startDate") or preset_match.get("date")
                event["category"] = preset_match.get("category", "Typhoon")
            else:
                event["name"] = event_id
                event["description"] = ""
                event["date"] = None
                event["category"] = "Typhoon"
            event["municipality_code"] = "PANAY_ALL"

        ev_id = str(event.get("id") or event_id)
        name_candidate = event.get("name") or (preset_match.get("name") if preset_match else ev_id)
        name = str(name_candidate or ev_id)
        date_val = str(event["date"]) if event.get("date") is not None else (preset_match.get("startDate") if preset_match else None)

        event["startDate"] = event.get("start_date") or (preset_match.get("startDate") if preset_match else date_val)
        event["endDate"] = event.get("end_date") or (preset_match.get("endDate") if preset_match else None)
        event["type"] = event.get("type") or (preset_match.get("type") if preset_match else "typhoon")
        event["resource_url"] = event.get("resource_url") or (preset_match.get("resource_url") if preset_match else None)

        prof = get_event_profile(ev_id) or get_event_profile(name) or get_event_profile((event_id))
        event["event_type"] = event.get("event_type") or (preset_match.get("event_type") if preset_match else None) or (prof.get("event_type") if prof else None)
        event["disaster_category"] = event.get("disaster_category") or (preset_match.get("disaster_category") if preset_match else None) or (prof.get("disaster_category") if prof else None)
        event["root_cause_summary"] = event.get("root_cause_summary") or (preset_match.get("root_cause_summary") if preset_match else None) or (prof.get("root_cause_summary") if prof else None)
        event["infrastructure_impact"] = event.get("infrastructure_impact") or (preset_match.get("infrastructure_impact") if preset_match else None) or (prof.get("infrastructure_impact") if prof else None)

        event["affected_population"] = compute_event_affected_population(cursor, date_val) or (preset_match.get("affected_population") if preset_match else None)
        event["critical_municipalities"] = compute_event_critical_municipalities(cursor, date_val, limit=5)
        event["viirs_data_available"] = check_viirs_data_availability(date_val, conn=conn)

        conn.close()
        return event
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/gdacs-live", tags=["GDACS Live Feeds"])
@app.get("/api/v1/gdacs/alerts", tags=["GDACS Live Feeds"])
@app.get("/api/v1/events/gdacs/live", tags=["GDACS Live Feeds"])
def get_gdacs_alerts(limit: int = Query(25, ge=1, le=100)):
    """
    Fetches real-time GDACS natural hazard alerts filtered for the Philippines,
    enriching each item with status on whether it is already imported into SANAG,
    as well as spatial geographic coordinates (latitude, longitude, bbox, geometry).
    Results are strictly sorted in reverse chronological order (newest first).
    """
    try:
        raw_alerts = get_latest_philippines_disasters(limit=limit)
        
        # Check database for existing imported GDACS event IDs
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM events")
        existing_event_ids = {str(row["id"]) for row in cursor.fetchall()}
        enriched = []
        for alert in raw_alerts:
            item = dict(alert)
            ev_id = str(item.get("event_id", ""))
            clean_id = f"gdacs-{ev_id}" if not ev_id.startswith("gdacs-") else ev_id
            item["id"] = clean_id
            item["is_imported"] = (clean_id in existing_event_ids or ev_id in existing_event_ids)
            # Validate NASA VIIRS data availability for hazard date
            alert_date = item.get("date")
            item["viirs_data_available"] = check_viirs_data_availability(alert_date, conn=conn)
            enriched.append(item)
        conn.close()

        # Strictly sort enriched alerts in reverse chronological order (newest / most recent first)
        enriched.sort(
            key=lambda item: str(item.get("fromdate") or item.get("startDate") or item.get("date") or item.get("pubDate") or ""),
            reverse=True
        )

        return {
            "status": "success",
            "count": len(enriched),
            "alerts": enriched,
            "data": enriched
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch GDACS alerts: {str(e)}")


@app.post("/api/v1/events/import-gdacs", tags=["Events & GDACS"])
def import_gdacs_event(payload: GDACSImportRequest):
    """
    Imports a live GDACS event alert into the SANAG simulation timeline:
    1. Extracts hazard metrics (alert level, hazard type, epicenter/region, date).
    2. Upserts into the disaster events database.
    3. Dynamically generates and seeds calibrated Day-0 to Day-13 municipal recovery
       curves across all 93 Panay LGUs using their baseline radiance values.
    4. Immediately computes affected population and critical LGUs.
    """
    raw_id = str(payload.event_id).strip()
    if not raw_id:
        raise HTTPException(status_code=400, detail="A valid GDACS event_id is required.")
    
    clean_id = f"gdacs-{raw_id}" if not raw_id.startswith("gdacs-") else raw_id
    
    # Categorize hazard type
    raw_type = (payload.type or "GEN").upper().strip()
    category = payload.category or EVENT_TYPE_MAP.get(raw_type, "Power Disruption")
    payload_name_lower = (payload.name or "").lower()
    if "typhoon" in payload_name_lower or "cyclone" in payload_name_lower:
        category = "Typhoon"
    elif "earthquake" in payload_name_lower:
        category = "Earthquake"
    elif "flood" in payload_name_lower:
        category = "Flood"
        
    alert_lvl = (payload.alert_level or "Green").capitalize()
    
    # Clean and standardize date (format YYYY-MM-DD, offset-naive UTC)
    raw_date = (payload.date or "").strip()
    parsed_dt = to_naive_utc(raw_date) if raw_date else None
    fallback_date = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y-%m-%d")
    if parsed_dt:
        date_clean = parsed_dt.strftime("%Y-%m-%d")
    elif len(raw_date) >= 10:
        date_clean = raw_date[:10]
    else:
        date_clean = fallback_date
        
    event_name = (payload.name or f"GDACS: {category} Incident #{raw_id}").strip()
    desc = (payload.description or f"Live GDACS alert ({alert_lvl} Alert) initialized with calibrated Panay recovery baseline.").strip()
    
    # Determine severity label
    if alert_lvl == "Red":
        severity = "Severe"
    elif alert_lvl == "Orange":
        severity = "High"
    else:
        severity = "Moderate"

    # Backend Validation: check if confirmed NASA VIIRS radiance data exists for this hazard
    viirs_available = check_viirs_data_availability(date_clean)
    if not viirs_available and not payload.force:
        raise HTTPException(
            status_code=400,
            detail=f"Simulation rejected: Confirmed NASA VIIRS radiance data is pending for hazard date {date_clean} across the Panay LGU grid. Live hazard has not impacted ground sensors yet."
        )

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Check actual table schema
        cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
        if "event_title" in cols:
            cursor.execute("""
                INSERT INTO events (id, affected_pcode, event_title, description, event_date, event_type)
                VALUES (?, 'PANAY_ALL', ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    event_title = excluded.event_title,
                    description = excluded.description,
                    event_date = excluded.event_date,
                    event_type = excluded.event_type
            """, (clean_id, event_name, desc, date_clean, category))
        else:
            cursor.execute("""
                INSERT INTO events (id, municipality_code, name, description, date, category, image_url)
                VALUES (?, 'PANAY_ALL', ?, ?, ?, ?, NULL)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    date = excluded.date,
                    category = excluded.category
            """, (clean_id, event_name, desc, date_clean, category))
        
        conn.commit()
        conn.close()

        # 2. Dynamically seed baseline recovery observations across all 93 Panay municipalities
        window = payload.window_days or 14
        try:
            seed_res = seed_single_event(
                event_id=clean_id,
                event_date_str=date_clean,
                category=category,
                alert_level=alert_lvl,
                target_mun_code="PANAY_ALL",
                overwrite=True,
                window_days=window
            )
        except Exception as seed_err:
            print(f"Non-fatal error seeding single event '{clean_id}': {seed_err}")
            seed_res = {"records_processed": 0, "error": str(seed_err)}

        # 3. Calculate affected population & critical LGUs from newly seeded observations
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        try:
            affected_pop = compute_event_affected_population(cursor, date_clean)
            critical_lgus = compute_event_critical_municipalities(cursor, date_clean, limit=5)
        except Exception as pop_err:
            print(f"Non-fatal error computing event metrics: {pop_err}")
            affected_pop = payload.affected_population or 0
            critical_lgus = []
        finally:
            conn.close()

        mapped_event = {
            "id": clean_id,
            "municipality_code": "PANAY_ALL",
            "name": event_name,
            "description": desc,
            "date": date_clean,
            "category": category,
            "alert_level": alert_lvl,
            "severity": severity,
            "affected_population": affected_pop,
            "critical_municipalities": critical_lgus,
            "image_url": None,
            "viirs_data_available": True,
            "seed_stats": seed_res
        }

        return {
            "status": "success",
            "message": f"GDACS alert '{event_name}' successfully imported and seeded into active simulation grid.",
            "event": mapped_event
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"GDACS import fallback due to error: {e}")
        return {
            "status": "success",
            "message": f"GDACS alert imported with fallback parameters: {str(e)}",
            "event": {
                "id": clean_id,
                "municipality_code": "PANAY_ALL",
                "name": event_name,
                "description": desc,
                "date": date_clean,
                "category": category,
                "alert_level": alert_lvl,
                "severity": severity,
                "affected_population": payload.affected_population or 0,
                "critical_municipalities": [],
                "image_url": None,
                "seed_stats": {"records_processed": 0, "error": str(e)}
            }
        }


@app.get("/api/v1/recovery-scores", response_model=RecoveryScoresResponse, tags=["Recovery Engine"])
def get_recovery_scores(
    municipality: Optional[str] = Query(None, description="Filter by specific municipality name or ADM3_PCODE"),
    start_date: Optional[str] = Query(None, description="Filter observations from YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter observations up to YYYY-MM-DD"),
    month: Optional[str] = Query(None, description="Filter observations for full month (e.g. YYYY-MM)"),
    event_id: Optional[str] = Query(None, description="Filter observations by disaster event ID (with safe fallback event window)")
):
    """
    Computes and returns R(t) recovery scores with both municipality_name and pcode
    for direct Leaflet map binding without string-matching errors.
    Supports full monthly and custom date ranges, plus safe event-window fallbacks.

    Harmonized 3-tier operational benchmarks:
      * Near-Full Recovery: >= 90% baseline radiance (R(t) >= 0.90)
      * Active Restoration: 60% to 89% baseline radiance (0.60 <= R(t) < 0.90)
      * Critical Deficit: < 60% baseline radiance (R(t) < 0.60)
    """
    try:
        filtered = compute_recovery_index(
            start_date=start_date,
            end_date=end_date,
            municipality=municipality,
            event_id=event_id,
            month=month
        )
        return {"records_count": len(filtered), "data": filtered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/events/{event_id}/radiance", tags=["Events & Spatial Data"])
def get_event_radiance(
    event_id: str,
    municipality: Optional[str] = Query(None, description="Optional municipality name or ADM3_PCODE filter"),
    observation_date: Optional[str] = Query(None, description="Observation date in YYYY-MM-DD format; defaults to the event date")
):
    """
    Connects historical event records to spatial/time radiance data across Panay municipalities.
    Exposes both municipality_name and pcode for direct GIS map layers.
    Cached in-memory via lru_cache to avoid redundant database reads.
    """
    lookup_id = "panay-blackout-2024" if event_id.strip() == "1" else event_id.strip()
    clean_mun = municipality.strip().lower() if municipality and isinstance(municipality, str) else None
    
    event_dict, spatial_time_data = _cached_event_radiance_query(lookup_id, observation_date, clean_mun)
    
    return {
        "event": event_dict,
        "spatial_time_records_count": len(spatial_time_data),
        "data": list(spatial_time_data)
    }

@lru_cache(maxsize=128)
def _cached_event_radiance_query(
    lookup_id: str,
    observation_date: Optional[str],
    municipality: Optional[str]
) -> Tuple[Dict[str, Any], Tuple[Dict[str, Any], ...]]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
    if "event_title" in cols:
        evt_sql = """
            SELECT 
                id, 
                affected_pcode AS municipality_code, 
                event_title AS name, 
                description, 
                event_date AS date, 
                event_type AS category, 
                NULL AS image_url 
            FROM events WHERE id = ?
        """
    else:
        evt_sql = "SELECT id, municipality_code, name, description, date, category, image_url FROM events WHERE id = ?"
        
    cursor.execute(evt_sql, (lookup_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Event ID '{lookup_id}' not found.")

    event_dict = dict(event)
    if event_dict.get("id") is not None:
        event_dict["id"] = str(event_dict["id"])
    raw_date = observation_date or event_dict.get("date")
    target_date: Optional[str] = str(raw_date)[:10] if raw_date is not None else None
    
    query = """
        SELECT 
            o.municipality_name,
            COALESCE(o.municipality_pcode, m.code) AS pcode,
            o.observation_date,
            o.daily_radiance,
            COALESCE(
                (SELECT b1.baseline_radiance FROM baselines b1 
                 WHERE (b1.municipality_name = o.municipality_name OR b1.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b1.baseline_radiance IS NOT NULL 
                   AND (b1.month_date = substr(o.observation_date, 1, 7) OR b1.month_date = substr(o.observation_date, 1, 7) || '-01')
                 LIMIT 1),
                (SELECT b2.baseline_radiance FROM baselines b2 
                 WHERE (b2.municipality_name = o.municipality_name OR b2.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b2.baseline_radiance IS NOT NULL 
                   AND (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) <= o.observation_date
                 ORDER BY (CASE WHEN length(b2.month_date) = 7 THEN b2.month_date || '-01' ELSE b2.month_date END) DESC LIMIT 1),
                (SELECT b3.baseline_radiance FROM baselines b3 
                 WHERE (b3.municipality_name = o.municipality_name OR b3.municipality_pcode = COALESCE(o.municipality_pcode, m.code))
                   AND b3.baseline_radiance IS NOT NULL 
                 ORDER BY b3.month_date ASC LIMIT 1),
                (SELECT AVG(b4.baseline_radiance) FROM baselines b4 WHERE b4.baseline_radiance IS NOT NULL),
                0.7885
            ) AS baseline_radiance
        FROM radiance_observations o
        LEFT JOIN municipalities m ON (o.municipality_name = m.name OR o.municipality_pcode = m.code)
        WHERE o.observation_date = ?
    """
    params = [target_date]
    
    if municipality:
        query += " AND (LOWER(o.municipality_name) = ? OR LOWER(COALESCE(o.municipality_pcode, m.code)) = ?)"
        params.extend([municipality, municipality])
        
    query += " ORDER BY o.municipality_name ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()

    if not rows and target_date:
        cursor.execute("""
            SELECT observation_date, ABS(JULIANDAY(observation_date) - JULIANDAY(?)) AS diff
            FROM radiance_observations
            ORDER BY diff ASC LIMIT 1
        """, (target_date,))
        nearest = cursor.fetchone()
        if nearest and nearest["diff"] is not None and nearest["diff"] <= 3:
            params[0] = nearest["observation_date"]
            cursor.execute(query, params)
            rows = cursor.fetchall()

    if target_date is not None:
        event_dict["affected_population"] = compute_event_affected_population(cursor, target_date)
        event_dict["critical_municipalities"] = compute_event_critical_municipalities(cursor, target_date, limit=5)
    else:
        event_dict["affected_population"] = 0
        event_dict["critical_municipalities"] = []
    conn.close()
    
    spatial_time_data = []
    for row in rows:
        rad = row["daily_radiance"]
        base = row["baseline_radiance"]
        r_t = round(rad / base, 4) if base and base > 0 and rad is not None else None
        
        spatial_time_data.append({
            "municipality_name": row["municipality_name"],
            "pcode": row["pcode"] or "UNKNOWN",
            "observation_date": row["observation_date"],
            "post_event_radiance": rad,
            "baseline_radiance": base,
            "r_t": r_t
        })
        
    return (event_dict, tuple(spatial_time_data))


@app.get("/api/v1/resilience/timeline", response_model=TimelineResponse, tags=["Timeline"])
def get_timeline_query(
    municipality: Optional[str] = Query(None, description="Filter by municipality name or ADM3_PCODE"),
    muniId: Optional[str] = Query(None, description="Alias for municipality or ADM3_PCODE"),
    start_date: Optional[str] = Query(None, description="Start date filter YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date filter YYYY-MM-DD"),
    month: Optional[str] = Query(None, description="Filter observations for full month (e.g. YYYY-MM)"),
    event_id: Optional[str] = Query(None, description="Filter observations by disaster event ID"),
    eventId: Optional[str] = Query(None, description="Alias for event_id")
):
    """
    Query-param based recovery timeline endpoint supporting full date ranges and event views.
    Example: /api/v1/resilience/timeline?muniId=iloilo_city&eventId=panay-blackout-2024

    Harmonized 3-tier operational benchmarks:
      * Near-Full Recovery: >= 90% baseline radiance (R(t) >= 0.90)
      * Active Restoration: 60% to 89% baseline radiance (0.60 <= R(t) < 0.90)
      * Critical Deficit: < 60% baseline radiance (R(t) < 0.60)
    """
    target_mun = municipality or muniId
    if not target_mun:
        raise HTTPException(
            status_code=400,
            detail="A municipality identifier ('municipality' or 'muniId') is required."
        )
    target_event = event_id or eventId
    return get_municipality_timeline(
        municipality_identifier=target_mun,
        start_date=start_date,
        end_date=end_date,
        month=month,
        event_id=target_event
    )


@app.get("/api/v1/resilience/timeline/{municipality_identifier}", response_model=TimelineResponse, tags=["Timeline"])
def get_municipality_timeline(
    municipality_identifier: str,
    start_date: Optional[str] = Query(None, description="Start date filter YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date filter YYYY-MM-DD"),
    month: Optional[str] = Query(None, description="Filter observations for full month (e.g. YYYY-MM)"),
    event_id: Optional[str] = Query(None, description="Filter observations by disaster event ID (with safe fallback event window)")
):
    """
    Returns the day-by-day recovery timeline for a specific municipality.
    Accepts either municipality name (e.g. 'Altavas') or ADM3_PCODE (e.g. 'PH0600401').
    Supports full monthly and custom date ranges, plus safe event-window fallbacks.

    Harmonized 3-tier operational benchmarks:
      * Near-Full Recovery: >= 90% baseline radiance (R(t) >= 0.90)
      * Active Restoration: 60% to 89% baseline radiance (0.60 <= R(t) < 0.90)
      * Critical Deficit: < 60% baseline radiance (R(t) < 0.60)
    """
    # Verify municipality exists
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    ident = municipality_identifier.strip().lower()
    cursor.execute(
        "SELECT name, code FROM municipalities WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1",
        (ident, ident)
    )
    mun_row = cursor.fetchone()
    conn.close()

    if not mun_row:
        raise HTTPException(
            status_code=404, 
            detail=f"Municipality '{municipality_identifier}' not found."
        )

    mun_name = mun_row["name"]
    mun_pcode = mun_row["code"]

    timeline = compute_recovery_index(
        municipality=mun_name,
        start_date=start_date,
        end_date=end_date,
        month=month,
        event_id=event_id
    )

    return {
        "municipality": mun_name,
        "pcode": mun_pcode,
        "timeline": timeline
    }


def _parse_int_param(val: Any, default: int = 5, min_val: int = 1, max_val: int = 16) -> int:
    try:
        if val is None:
            return default
        parsed = int(val)
        return max(min_val, min(max_val, parsed))
    except (ValueError, TypeError):
        return default


def _parse_float_param(val: Any, default: float, min_val: float = -90.0, max_val: float = 90.0) -> float:
    try:
        if val is None:
            return default
        parsed = float(val)
        if math.isnan(parsed) or math.isinf(parsed):
            return default
        return max(min_val, min(max_val, parsed))
    except (ValueError, TypeError):
        return default


@app.get("/api/v1/weather/historical", tags=["Weather"])
async def get_historical_weather_endpoint(
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-05",
    latitude: Optional[Union[float, str]] = 11.15,
    longitude: Optional[Union[float, str]] = 122.50
):
    """
    Fetches historical daily weather data from Open-Meteo for disaster correlation.
    Gracefully falls back to high-fidelity mock data if the external API is unreachable.
    """
    safe_lat = _parse_float_param(latitude, default=11.15, min_val=-90.0, max_val=90.0)
    safe_lon = _parse_float_param(longitude, default=122.50, min_val=-180.0, max_val=180.0)

    try:
        data = await fetch_historical_weather(
            latitude=safe_lat,
            longitude=safe_lon,
            start_date=start_date,
            end_date=end_date
        )
        return {"status": "success", "data": data}
    except Exception as e:
        logger.warning(f"Error in historical weather endpoint: {e}")
        fallback = get_fallback_historical_weather(
            latitude=safe_lat,
            longitude=safe_lon,
            start_date=start_date,
            end_date=end_date
        )
        return {"status": "success", "data": fallback, "fallback": True}


@app.get("/api/v1/weather/forecast", tags=["Weather"])
async def get_weather_forecast_endpoint(
    days: Optional[Union[int, str]] = Query(5, description="Number of forecast days (1-16)"),
    latitude: Optional[Union[float, str]] = Query(11.15, description="Latitude centroid"),
    longitude: Optional[Union[float, str]] = Query(122.50, description="Longitude centroid"),
):
    """
    Fetches a daily weather forecast for the Panay region from Open-Meteo.
    Gracefully falls back to high-fidelity mock data if the external API is unreachable.
    """
    safe_days = _parse_int_param(days, default=5, min_val=1, max_val=16)
    safe_lat = _parse_float_param(latitude, default=11.15, min_val=-90.0, max_val=90.0)
    safe_lon = _parse_float_param(longitude, default=122.50, min_val=-180.0, max_val=180.0)

    try:
        data = await fetch_weather_forecast(
            latitude=safe_lat,
            longitude=safe_lon,
            days=safe_days,
        )
        return {"status": "success", "data": data}
    except Exception as e:
        logger.warning(f"Error in weather forecast endpoint: {e}")
        fallback = get_fallback_weather_forecast(
            latitude=safe_lat,
            longitude=safe_lon,
            days=safe_days
        )
        return {"status": "success", "data": fallback, "fallback": True}


class BriefingRequest(BaseModel):
    event_context: Optional[str] = None
    event_id: Optional[str] = None
    event_type: Optional[str] = None
    disaster_category: Optional[str] = None
    root_cause_summary: Optional[str] = None
    infrastructure_impact: Optional[str] = None

@app.post("/api/generate-briefing", tags=["AI Briefing"])
@app.post("/api/v1/generate-briefing", tags=["AI Briefing"])
@app.post("/api/executive-summary", tags=["AI Briefing"])
@app.post("/api/v1/executive-summary", tags=["AI Briefing"])
def api_generate_briefing(
    request: Optional[BriefingRequest] = None,
    event_context: Optional[str] = None,
):
    """
    Endpoint to trigger an automated disaster recovery briefing using Gemini.
    Accepts input via JSON body {"event_context": "..."} or query parameter ?event_context=...
    """
    try:
        context = (request.event_context if request and request.event_context else None) or event_context or ""
        briefing = generate_recovery_briefing(
            context,
            event_type=request.event_type if request else None,
            disaster_category=request.disaster_category if request else None,
            root_cause_summary=request.root_cause_summary if request else None,
            infrastructure_impact=request.infrastructure_impact if request else None,
        )
        return {"status": "success", "briefing": briefing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def build_search_query(raw_query: str, event_type: Optional[str] = None) -> str:
    clean = raw_query.strip()
    # Strip common parenthetical aliases if needed (e.g. "Typhoon Phanfone (Ursula)" -> "Typhoon Phanfone")
    base_name = clean.split('(')[0].strip().replace('"', '')
    if not base_name:
        base_name = clean.replace('"', '')

    lower = base_name.lower()
    type_lower = (event_type or "").lower()

    is_grid = (
        "grid" in type_lower
        or "blackout" in type_lower
        or "power" in type_lower
        or "grid" in lower
        or "blackout" in lower
        or "power outage" in lower
        or "electricity" in lower
    )
    is_quake = (
        "quake" in type_lower
        or "earthquake" in type_lower
        or "seismic" in type_lower
        or "earthquake" in lower
        or "seismic" in lower
    )
    is_oil_spill = (
        "oil" in type_lower
        or "spill" in type_lower
        or "oil spill" in lower
        or "spill" in lower
    )
    is_flood = (
        "flood" in type_lower
        or "monsoon" in type_lower
        or "habagat" in type_lower
        or "flood" in lower
        or "monsoon" in lower
        or "habagat" in lower
    )

    negative_filters = "-art -painting -wallpaper"
    if is_grid:
        return f'"{base_name}" (blackout OR "power outage" OR grid OR electricity OR NGCP) Philippines {negative_filters}'
    elif is_quake:
        return f'"{base_name}" (earthquake OR tremor OR damage OR aftermath OR seismic) Philippines {negative_filters}'
    elif is_oil_spill:
        return f'"{base_name}" ("oil spill" OR cleanup OR coast OR tanker OR environmental) Philippines {negative_filters}'
    elif is_flood:
        return f'"{base_name}" (flood OR inundation OR "heavy rain" OR aftermath OR evacuation) Philippines {negative_filters}'
    else:
        # Default typhoon / storm
        return f'"{base_name}" (typhoon OR disaster OR aftermath OR damage OR satellite OR flood) Philippines {negative_filters}'


def generate_wikimedia_queries(raw_query: str, event_type: Optional[str] = None) -> List[str]:
    """
    Generates intelligent, prioritized search queries for Wikimedia Commons.
    Rather than relying solely on exact full-phrase strings (which frequently return 0 on Commons),
    this produces the cleaned event name followed by targeted regional and disaster keywords.
    E.g. "Western Visayas Monsoon Flooding" ->
      ["Western Visayas Monsoon Flooding", "Western Visayas flood", "Iloilo flood", "Panay flood",
       "Western Visayas typhoon", "Western Visayas monsoon", "Antique flood", "Visayas flood", "Philippines flood disaster"]
    """
    clean = raw_query.replace('"', '').strip()
    match = re.match(r'^(.*?)\s*\((.*?)\)$', clean)
    base = match.group(1).strip() if match else clean
    local_alias = match.group(2).strip() if match else ""

    lower = clean.lower()
    base_lower = base.lower()
    type_lower = (event_type or "").lower()

    # Disaster type classification
    is_flood = any(k in lower or k in type_lower for k in ["flood", "monsoon", "habagat", "inundation", "rain", "fl"])
    is_typhoon = any(k in lower or k in type_lower for k in ["typhoon", "storm", "cyclone", "bagyo", "tc"])
    is_quake = any(k in lower or k in type_lower for k in ["quake", "earthquake", "seismic", "tremor", "eq"])
    is_grid = any(k in lower or k in type_lower for k in ["grid", "blackout", "power", "outage", "collapse", "electricity"])
    is_oil_spill = any(k in lower or k in type_lower for k in ["oil", "spill"])
    is_volcano = any(k in lower or k in type_lower for k in ["volcano", "eruption", "ashfall", "vo"])

    # Regional detection
    is_wv = any(k in lower for k in ["western visayas", "panay", "iloilo", "capiz", "antique", "aklan", "guimaras", "negros occidental", "bacolod", "roxas", "kalibo"])
    is_cv = any(k in lower for k in ["central visayas", "cebu", "bohol", "negros oriental", "dumaguete"])
    is_ev = any(k in lower for k in ["eastern visayas", "leyte", "samar", "tacloban", "ormoc"])
    is_bicol = any(k in lower for k in ["bicol", "albay", "camarines", "legazpi", "naga"])
    is_ncr = any(k in lower for k in ["manila", "marikina", "batangas", "cavite", "laguna", "rizal", "quezon", "calabarzon"])
    is_nl = any(k in lower for k in ["cagayan", "isabela", "ilocos", "benguet", "baguio", "cordillera"])
    is_mindanao = any(k in lower for k in ["mindanao", "davao", "agusan", "surigao", "cotabato"])

    # Typhoon name cross-mappings (International <-> PAGASA)
    typhoon_cross_map = {
        "gaemi": "Carina", "carina": "Gaemi",
        "trami": "Kristine", "kristine": "Trami",
        "nalgae": "Paeng", "paeng": "Nalgae",
        "megi": "Agaton", "agaton": "Megi",
        "rai": "Odette", "odette": "Rai",
        "molave": "Quinta", "quinta": "Molave",
        "phanfone": "Ursula", "ursula": "Phanfone",
        "hagupit": "Ruby", "ruby": "Hagupit",
        "haiyan": "Yolanda", "yolanda": "Haiyan",
        "fengshen": "Frank", "frank": "Fengshen",
        "kalmaegi": "Tino", "tino": "Kalmaegi",
        "ketsana": "Ondoy", "ondoy": "Ketsana",
        "vamco": "Ulysses", "ulysses": "Vamco",
        "goni": "Rolly", "rolly": "Goni",
    }

    queries: List[str] = []

    # 1. Cleaned base name without restrictive quotes
    if base:
        queries.append(base)
    if local_alias and local_alias.lower() != base_lower:
        queries.append(f"Typhoon {local_alias}")
        queries.append(f"{base} {local_alias}")

    # Check cross-mapped typhoon names
    for key, mapped in typhoon_cross_map.items():
        if key in lower:
            queries.append(f"Typhoon {mapped}")
            queries.append(f"Typhoon {mapped} flood")
            queries.append(f"Typhoon {mapped} damage")

    # 2. Regional and hazard keywords
    if is_wv or (not any([is_cv, is_ev, is_bicol, is_ncr, is_nl, is_mindanao])):
        # Default or Western Visayas focus
        if is_flood:
            wv_flood_queries = []
            if "antique" in lower:
                wv_flood_queries.extend(["Antique flood", "Antique Philippines flood"])
            if "iloilo" in lower:
                wv_flood_queries.extend(["Iloilo flood", "Iloilo City flood"])
            if "capiz" in lower:
                wv_flood_queries.extend(["Capiz flood", "Roxas City flood"])
            wv_flood_queries.extend([
                "Western Visayas flood",
                "Iloilo flood",
                "Panay flood",
                "Western Visayas typhoon",
                "Western Visayas monsoon",
                "Antique flood",
                "Capiz flood",
                "Visayas flood",
            ])
            queries.extend(wv_flood_queries)
        elif is_typhoon:
            queries.extend([
                "Western Visayas typhoon",
                "Panay typhoon",
                "Iloilo typhoon",
                "Visayas typhoon damage",
                "Typhoon Frank Iloilo",
            ])
        elif is_grid:
            queries.extend([
                "Panay blackout",
                "Panay power outage",
                "Panay grid",
                "Iloilo blackout",
                "Visayas power grid",
            ])
        elif is_quake:
            queries.extend([
                "Panay earthquake",
                "Western Visayas earthquake",
                "Iloilo earthquake",
            ])
        elif is_oil_spill:
            queries.extend([
                "Guimaras oil spill",
                "Iloilo oil spill",
                "Western Visayas oil spill",
            ])
        else:
            queries.extend([
                "Western Visayas disaster",
                "Iloilo flood",
                "Panay flood",
                "Western Visayas typhoon",
            ])

    if is_cv:
        if is_quake:
            queries.extend(["Bohol earthquake", "Cebu earthquake", "Central Visayas earthquake"])
        elif is_flood:
            queries.extend(["Cebu flood", "Central Visayas flood"])
        else:
            queries.extend(["Cebu typhoon", "Typhoon Odette Cebu", "Central Visayas disaster"])

    if is_ev:
        if is_flood:
            queries.extend(["Leyte flood", "Samar flood", "Tacloban flood"])
        elif is_quake:
            queries.extend(["Leyte earthquake", "Samar earthquake"])
        else:
            queries.extend(["Tacloban typhoon", "Typhoon Haiyan Leyte", "Eastern Visayas typhoon"])

    if is_bicol:
        if is_flood:
            queries.extend(["Bicol flood", "Legazpi flood", "Albay flood"])
        elif is_volcano:
            queries.extend(["Mayon volcano eruption", "Mayon ashfall Albay"])
        else:
            queries.extend(["Albay typhoon", "Bicol typhoon damage", "Legazpi flood"])

    if is_ncr:
        if is_flood:
            queries.extend(["Marikina flood", "Metro Manila flood", "Manila flood"])
        else:
            queries.extend(["Metro Manila typhoon", "Manila flood typhoon", "Batangas volcano"])

    if is_nl:
        if is_flood:
            queries.extend(["Cagayan flood", "Ilocos flood", "Isabela flood"])
        else:
            queries.extend(["Cagayan typhoon", "Isabela typhoon", "Baguio landslide"])

    if is_mindanao:
        if is_quake:
            queries.extend(["Davao earthquake", "Mindanao earthquake", "Cotabato earthquake"])
        elif is_flood:
            queries.extend(["Davao flood", "Agusan flood", "Mindanao flood"])
        else:
            queries.extend(["Mindanao typhoon", "Davao typhoon damage"])

    # 3. National context fallbacks
    if is_flood:
        queries.extend(["Philippines flood disaster", "Philippines flood aftermath"])
    elif is_typhoon:
        queries.extend(["Philippines typhoon damage", "Philippines typhoon disaster"])
    elif is_quake:
        queries.extend(["Philippines earthquake damage"])
    elif is_grid:
        queries.extend(["Philippines blackout"])

    # Deduplicate while preserving priority order
    seen = set()
    deduped = []
    for q in queries:
        cleaned_q = q.strip()
        q_norm = cleaned_q.lower()
        if cleaned_q and q_norm not in seen:
            seen.add(q_norm)
            deduped.append(cleaned_q)

    return deduped


def fetch_wikimedia_commons_images(
    raw_query: str,
    count: int = 12,
    event_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Robust image fetcher querying the Wikimedia Commons Action API
    (https://commons.wikimedia.org/w/api.php?action=query&generator=search).
    Automatically steps through event-specific and broader regional keywords
    to ensure regional events (e.g. Western Visayas Monsoon Flooding) return
    valid ground photos and photojournalistic damage imagery.
    """
    queries = generate_wikimedia_queries(raw_query, event_type=event_type)
    headers = {
        'User-Agent': 'SanagDisasterMonitor/1.0 (https://sanag.org; contact@sanag.org)',
        'Api-User-Agent': 'SanagDisasterMonitor/1.0 (https://sanag.org; contact@sanag.org)'
    }

    collected: List[Dict[str, Any]] = []
    seen_ids = set()
    seen_urls = set()

    clean_raw = raw_query.replace('"', '').strip()

    with httpx.Client(timeout=7.0, headers=headers) as client:
        for q_try in queries:
            try:
                params = {
                    "action": "query",
                    "generator": "search",
                    "gsrsearch": q_try,
                    "gsrnamespace": "6",  # Namespace 6 = File:
                    "gsrlimit": str(min(count, 20)),
                    "prop": "imageinfo",
                    "iiprop": "url|mime",
                    "iiurlwidth": "600",
                    "format": "json",
                    "origin": "*"
                }
                r = client.get("https://commons.wikimedia.org/w/api.php", params=params)
                if r.status_code != 200:
                    continue

                pages = r.json().get("query", {}).get("pages", {})
                if not pages or not isinstance(pages, dict):
                    continue

                query_added = 0
                for pid, p in pages.items():
                    info_list = p.get("imageinfo") or []
                    if not info_list:
                        continue
                    info = info_list[0]
                    mime = (info.get("mime") or "").lower()

                    # Strictly filter for web-compatible image formats, excluding SVG/PDF/audio
                    if not mime.startswith("image/") or "svg" in mime or "tiff" in mime or "djvu" in mime:
                        continue

                    thumb = info.get("thumburl") or info.get("url")
                    img = info.get("url") or thumb
                    if not thumb or not img:
                        continue

                    item_id = f"wiki-{pid}"
                    if item_id in seen_ids or img in seen_urls:
                        continue

                    raw_title = p.get("title", "")
                    clean_title = re.sub(r'^File:\s*', '', raw_title, flags=re.IGNORECASE)
                    clean_title = re.sub(r'\.[a-zA-Z0-9]+$', '', clean_title).replace('_', ' ').strip()

                    desc_url = info.get("descriptionurl") or f"https://commons.wikimedia.org/wiki/File:{urllib.parse.quote(raw_title)}"

                    collected.append({
                        "id": item_id,
                        "title": clean_title or clean_raw,
                        "thumbnailUrl": thumb,
                        "imageUrl": img,
                        "sourceUrl": desc_url,
                        "domain": "commons.wikimedia.org",
                        "isFallback": (q_try.lower() != clean_raw.lower()),
                        "queryUsed": q_try
                    })
                    seen_ids.add(item_id)
                    seen_urls.add(img)
                    query_added += 1

                if query_added > 0:
                    print(f"[IMAGE SEARCH] [Wikimedia Commons] '{q_try}' returned {query_added} valid photo(s). Total: {len(collected)}", flush=True)

                # Once we have collected enough relevant images, stop
                if len(collected) >= count:
                    break

            except Exception as e:
                print(f"[IMAGE SEARCH] [Wikimedia Commons Error on '{q_try}']: {e}", flush=True)

    return collected[:count]


def fallback_openverse_search(q: str, count: int = 12, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fallback image provider combining Wikimedia Commons, Openverse, and Wikipedia pageimages
    when DuckDuckGo is blocked, throttled, or returns 0 results for regional disasters.
    """
    clean_q = q.split('(')[0].strip().replace('"', '') or q.strip()

    # 1. Primary fallback: Wikimedia Commons with regional expansion
    results = fetch_wikimedia_commons_images(clean_q, count=count, event_type=event_type)
    if results:
        return results

    headers = {
        'User-Agent': 'SanagDisasterMonitor/1.0 (https://sanag.org; contact@sanag.org)',
        'Api-User-Agent': 'SanagDisasterMonitor/1.0 (https://sanag.org; contact@sanag.org)'
    }
    lower = clean_q.lower()
    type_lower = (event_type or "").lower()

    is_grid = "grid" in type_lower or "blackout" in type_lower or "grid" in lower or "blackout" in lower
    is_quake = "quake" in type_lower or "earthquake" in type_lower or "quake" in lower
    is_oil_spill = "oil" in type_lower or "spill" in lower
    is_flood = "flood" in type_lower or "monsoon" in lower or "flood" in lower

    # 2. Secondary fallback: Openverse API search with disaster-anchored context
    try:
        if is_grid:
            openverse_q = f"{clean_q} blackout power outage grid Philippines"
        elif is_quake:
            openverse_q = f"{clean_q} earthquake damage Philippines"
        elif is_oil_spill:
            openverse_q = f"{clean_q} oil spill environmental Philippines"
        elif is_flood:
            openverse_q = f"{clean_q} flood aftermath Philippines"
        else:
            openverse_q = f"{clean_q} disaster damage flood Philippines"

        with httpx.Client(timeout=6.0, headers=headers) as client:
            r = client.get(
                "https://api.openverse.org/v1/images/",
                params={"q": openverse_q, "page_size": str(count)}
            )
            if r.status_code == 200:
                items = r.json().get("results", [])
                for idx, item in enumerate(items):
                    thumb = item.get("thumbnail") or item.get("url")
                    img = item.get("url") or thumb
                    if thumb and img:
                        results.append({
                            "id": str(item.get("id") or f"openverse-{idx}"),
                            "title": item.get("title") or clean_q,
                            "thumbnailUrl": thumb,
                            "imageUrl": img,
                            "sourceUrl": item.get("foreign_landing_url") or img,
                            "domain": item.get("source") or "openverse.org"
                        })
                if results:
                    print(f"[IMAGE SEARCH] [Fallback Openverse] Found {len(results)} items", flush=True)
                    return results[:count]
    except Exception as e:
        print(f"[IMAGE SEARCH] [Fallback Openverse Error]: {type(e).__name__}: {e}", flush=True)

    # 3. Tertiary fallback: Wikipedia Pageimages with Philippines disaster context
    try:
        if is_grid:
            wiki_search = f"{clean_q} blackout power grid Philippines"
        elif is_quake:
            wiki_search = f"{clean_q} earthquake seismic Philippines"
        elif is_oil_spill:
            wiki_search = f"{clean_q} oil spill Philippines"
        elif is_flood:
            wiki_search = f"{clean_q} flood monsoon Philippines"
        else:
            wiki_search = f"{clean_q} typhoon flood disaster Philippines"

        with httpx.Client(timeout=5.0, headers=headers) as client:
            params = {
                "action": "query",
                "generator": "search",
                "gsrsearch": wiki_search,
                "gsrlimit": str(count),
                "prop": "pageimages",
                "piprop": "thumbnail|original",
                "pithumbsize": "600",
                "format": "json"
            }
            r = client.get("https://en.wikipedia.org/w/api.php", params=params)
            if r.status_code == 200:
                pages = r.json().get("query", {}).get("pages", {})
                for pid, p in pages.items():
                    thumb = p.get("thumbnail", {}).get("source")
                    img = p.get("original", {}).get("source") or thumb
                    title = p.get("title") or clean_q
                    page_url = f"https://en.wikipedia.org/?curid={pid}"
                    if thumb and img:
                        results.append({
                            "id": f"wiki-page-{pid}",
                            "title": title,
                            "thumbnailUrl": thumb,
                            "imageUrl": img,
                            "sourceUrl": page_url,
                            "domain": "en.wikipedia.org"
                        })
                if results:
                    print(f"[IMAGE SEARCH] [Fallback Wikipedia Pages] Found {len(results)} items", flush=True)
                    return results[:count]
    except Exception as e:
        print(f"[IMAGE SEARCH] [Fallback Wikipedia Error]: {type(e).__name__}: {e}", flush=True)

    return results


_IMAGE_SEARCH_CACHE: Dict[str, List[Dict[str, Any]]] = {}


@app.get("/api/search-event-images", tags=["Image Search"])
@app.get("/api/v1/search-event-images", tags=["Image Search"])
@app.get("/api/media/search", tags=["Image Search"])
async def api_search_event_images(
    q: str = Query(..., description="Query for disaster ground images"),
    count: int = Query(12, description="Number of results"),
    refresh: bool = Query(False, description="Bypass cache or force refresh"),
    event_type: Optional[str] = Query(None, description="Type of disaster or event")
) -> List[Dict[str, Any]]:
    """
    Keyless photojournalism image search pipeline.
    Attempt 1: DuckDuckGo images (via ddgs) with hardened disaster query anchors.
    Attempt 2: If DDGS returned empty or threw an error on datacenter IP, query Wikimedia/Openverse fallback.
    """
    clean_q = q.split('(')[0].replace('"', '').strip() or q.strip()
    cache_key = f"{clean_q.lower()}_{event_type or ''}_{count}"

    if not refresh and cache_key in _IMAGE_SEARCH_CACHE:
        print(f"[IMAGE SEARCH] Cache hit for '{cache_key}' ({len(_IMAGE_SEARCH_CACHE[cache_key])} items)", flush=True)
        return _IMAGE_SEARCH_CACHE[cache_key]

    keywords = build_search_query(q, event_type=event_type)
    print(f"\n[IMAGE SEARCH] Incoming query: '{q}' (event_type: {event_type}, refresh: {refresh}) -> Hardened query: '{keywords}' | Max: {count}", flush=True)

    results: List[Dict[str, Any]] = []

    # Attempt 1: DuckDuckGo
    def _fetch_ddgs():
        try:
            from ddgs import DDGS  # type: ignore[import-untyped,import-not-found]
        except ImportError:
            from duckduckgo_search import DDGS  # type: ignore[import-untyped,import-not-found]

        try:
            with DDGS() as ddgs:
                try:
                    return list(ddgs.images(keywords, max_results=count))
                except TypeError:
                    return list(getattr(ddgs, "images")(query=keywords, max_results=count))
        except TypeError:
            client = DDGS()
            try:
                return list(client.images(keywords, max_results=count))
            except TypeError:
                return list(getattr(client, "images")(query=keywords, max_results=count))

    try:
        items = await asyncio.to_thread(_fetch_ddgs)
        if items:
            for idx, item in enumerate(items):
                thumb = item.get("thumbnail") or item.get("image") or ""
                img = item.get("image") or thumb
                page_url = item.get("url") or img
                domain = item.get("source") or ""
                if not domain and page_url:
                    try:
                        domain = urllib.parse.urlparse(page_url).netloc.replace("www.", "")
                    except Exception:
                        domain = "Web"
                if thumb or img:
                    results.append({
                        "id": item.get("url") or f"ddgs-{idx}",
                        "title": item.get("title") or clean_q,
                        "thumbnailUrl": thumb,
                        "imageUrl": img,
                        "sourceUrl": page_url,
                        "domain": domain or "Web"
                    })
            print(f"[IMAGE SEARCH] DDGS returned {len(results)} items.", flush=True)
        else:
            print(f"[IMAGE SEARCH] DDGS returned empty list for '{keywords}' (likely datacenter rate limit).", flush=True)
    except Exception as e:
        print(f"[DDGS Error in Prod]: {e}", flush=True)

    # Attempt 2: If DDGS returned empty or threw an error on datacenter IP, query Wikimedia/Openverse fallback
    if not results:
        print(f"[IMAGE SEARCH] Initiating Wikimedia/Openverse fallback for '{clean_q}'...", flush=True)
        results = await asyncio.to_thread(fallback_openverse_search, clean_q, count, event_type)
        print(f"[IMAGE SEARCH] Fallback returned {len(results)} image(s) for '{clean_q}'.", flush=True)

    if results:
        _IMAGE_SEARCH_CACHE[cache_key] = results

    return results



@app.get("/api/search-images", tags=["Image Search"])
@app.get("/api/v1/search-images", tags=["Image Search"])
async def api_search_images(
    q: str = Query(..., description="Query for disaster ground images"),
    refresh: bool = Query(False, description="Bypass cache or force refresh"),
    event_type: Optional[str] = Query(None, description="Type of disaster or event")
):
    """Legacy compatibility endpoint returning items array."""
    results = await api_search_event_images(q=q, count=12, refresh=refresh, event_type=event_type)
    items = [
        {
            "title": r["title"],
            "link": r["thumbnailUrl"],
            "displayLink": r["domain"],
            "image": {
                "thumbnailLink": r["thumbnailUrl"],
                "contextLink": r["sourceUrl"]
            }
        }
        for r in results
    ]
    return {"status": "success", "items": items}



    
