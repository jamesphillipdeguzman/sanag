from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import sqlite3
from typing import List, Optional, Dict, Any
from calculator import compute_recovery_index
from weather_service import fetch_historical_weather
from ai_briefing import generate_recovery_briefing
from contextlib import asynccontextmanager
from seed_events import seed_observations_for_all_events

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

class MunicipalityResponse(BaseModel):
    municipalities: List[str]
    items: Optional[List[MunicipalityItem]] = None

class EventModel(BaseModel):
    id: str
    municipality_code: Optional[str] = None
    name: str
    description: Optional[str] = None
    date: str
    category: str
    image_url: Optional[str] = None

class EventsResponse(BaseModel):
    events: List[EventModel]

class RecoveryScoresResponse(BaseModel):
    records_count: int
    data: List[Dict[str, Any]]

class TimelineResponse(BaseModel):
    municipality: str
    pcode: Optional[str] = None
    timeline: List[Dict[str, Any]]


# --- Endpoints ---

@app.get("/", tags=["System"])
def read_root():
    return {"status": "SANAG Engine Online", "docs": "/docs", "version": "1.1.0"}


@app.get("/api/v1/municipalities", response_model=MunicipalityResponse, tags=["Municipalities"])
def get_municipalities():
    """
    Returns a clean list of all 93 monitored Panay municipalities
    with their ADM3_PCODE for geospatial binding.
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT name, code FROM municipalities ORDER BY name ASC")
        rows = cursor.fetchall()
        conn.close()

        items = [{"name": row["name"], "pcode": row["code"]} for row in rows]
        return {
            "municipalities": [row["name"] for row in rows],
            "items": items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.get("/api/v1/events", response_model=EventsResponse, tags=["Events"])
def get_events():
    """
    Returns all historical disaster and power disruption event records.
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
        conn.close()

        events = []
        for row in rows:
            event = dict(row)
            if event.get("id") is not None:
                event["id"] = str(event["id"])
            events.append(event)

        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


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
    """
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
        
    lookup_id = "panay-blackout-2024" if event_id.strip() == "1" else event_id
    cursor.execute(evt_sql, (lookup_id,))
    event = cursor.fetchone()
    if not event:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Event ID '{event_id}' not found.")

    event_dict = dict(event)
    if event_dict.get("id") is not None:
        event_dict["id"] = str(event_dict["id"])
    target_date = observation_date or event_dict.get("date")
    
    query = """
        SELECT 
            o.municipality_name,
            COALESCE(o.municipality_pcode, m.code) AS pcode,
            o.observation_date,
            o.daily_radiance,
            COALESCE(
                (SELECT b1.baseline_radiance FROM baselines b1 
                 WHERE b1.municipality_name = o.municipality_name 
                   AND b1.baseline_radiance IS NOT NULL 
                   AND (b1.month_date = substr(o.observation_date, 1, 7) OR b1.month_date = substr(o.observation_date, 1, 7) || '-01')
                 LIMIT 1),
                (SELECT b2.baseline_radiance FROM baselines b2 
                 WHERE b2.municipality_name = o.municipality_name 
                   AND b2.baseline_radiance IS NOT NULL 
                   AND b2.month_date <= o.observation_date
                 ORDER BY b2.month_date DESC LIMIT 1),
                (SELECT b3.baseline_radiance FROM baselines b3 
                 WHERE b3.municipality_name = o.municipality_name 
                   AND b3.baseline_radiance IS NOT NULL 
                 ORDER BY b3.month_date DESC LIMIT 1)
            ) AS baseline_radiance
        FROM radiance_observations o
        LEFT JOIN municipalities m ON o.municipality_name = m.name
        WHERE o.observation_date = ?
    """
    params = [target_date]
    
    if municipality and isinstance(municipality, str):
        mun_q = municipality.strip().lower()
        query += " AND (LOWER(o.municipality_name) = ? OR LOWER(COALESCE(o.municipality_pcode, m.code)) = ?)"
        params.extend([mun_q, mun_q])
        
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
        
    return {
        "event": event_dict,
        "spatial_time_records_count": len(spatial_time_data),
        "data": spatial_time_data
    }


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


@app.get("/api/v1/weather/historical", tags=["Weather"])
async def get_historical_weather_endpoint(
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-05",
    latitude: float = 11.15,
    longitude: float = 122.50
):
    """
    Fetches historical daily weather data from Open-Meteo for disaster correlation.
    """
    try:
        data = await fetch_historical_weather(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date
        )
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/generate-briefing")
def api_generate_briefing(event_context: str):
    """
    Endpoint to trigger an automated disaster recovery briefing using Gemini 2.5 Flash.
    """
    try:
        briefing = generate_recovery_briefing(event_context)
        return {"status": "success", "briefing": briefing}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
