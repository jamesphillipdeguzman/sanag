from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
import math
import logging
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

# Allow production domain and local dev
allowed_origins = os.getenv(
    "ALLOWED_ORIGINS", 
    "https://sanag-project.netlify.app,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    image_url: Optional[str] = None
    affected_population: Optional[int] = None
    critical_municipalities: Optional[List[Dict[str, Any]]] = None
    viirs_data_available: Optional[bool] = None

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
    scope: Optional[str] = Query("panay", description="Scope: 'panay' (default, 93 LGUs), 'nationwide', or region code"),
    region: Optional[str] = Query(None, description="Optional region code/name filter"),
    province: Optional[str] = Query(None, description="Optional province code/name filter")
):
    """
    Returns monitored municipalities with their ADM3_PCODE/PSGC for geospatial binding.
    Defaults to Panay Island (93 municipalities) to preserve default focused behavior,
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


@app.get("/api/v1/events", response_model=EventsResponse, tags=["Events"])
def get_events():
    """
    Returns all historical disaster and power disruption event records
    with computed total affected population based on municipal radiance recovery.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check actual table schema to dynamically alias columns safely
        cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
        if "event_title" in cols:
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
        for row in rows:
            event = dict(row)
            if event.get("id") is not None:
                event["id"] = str(event["id"])
            date_val = str(event["date"]) if event.get("date") is not None else None
            # Compute total affected population dynamically from satellite observations
            event["affected_population"] = compute_event_affected_population(cursor, date_val)
            event["critical_municipalities"] = compute_event_critical_municipalities(cursor, date_val, limit=5)
            # Check confirmed NASA VIIRS nightlight radiance data across Panay LGU grid
            event["viirs_data_available"] = check_viirs_data_availability(date_val, conn=conn)
            events.append(event)

        conn.close()
        return {"events": events}
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
        briefing = generate_recovery_briefing(context)
        return {"status": "success", "briefing": briefing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    
