import os
import sqlite3
from gdacs.api import GDACSAPIReader, GDACSAPIError
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

EVENT_TYPE_MAP = {
    "TC": "Typhoon",
    "EQ": "Earthquake",
    "FL": "Flood",
    "VO": "Volcanic Eruption",
    "DR": "Drought",
    "TS": "Tsunami",
}

def check_viirs_data_availability(
    event_date: Optional[str],
    conn: Optional[Any] = None
) -> bool:
    """
    Validates whether confirmed NASA VIIRS nightlight radiance observations exist
    for the specified hazard date across the Panay LGU grid in radiance_observations.
    Returns:
        True: If calibrated observations exist across the Panay grid (e.g. >= 10 LGUs).
        False: If radiance data is pending (such as live approaching storms or dates without satellite downlink).
    """
    if not event_date:
        return False
    
    clean_date = event_date.strip()[:10]
    if len(clean_date) < 10:
        return False
        
    close_after = False
    if conn is None:
        try:
            db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")
            conn = sqlite3.connect(db_path)
            close_after = True
        except Exception as conn_err:
            print(f"Error opening DB for VIIRS check: {conn_err}")
            return False
            
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) FROM radiance_observations
            WHERE observation_date = ? AND daily_radiance IS NOT NULL
            """,
            (clean_date,)
        )
        row = cursor.fetchone()
        count = row[0] if row else 0
        return count >= 10
    except Exception as query_err:
        print(f"Error checking VIIRS radiance availability for {clean_date}: {query_err}")
        return False
    finally:
        if close_after and conn:
            try:
                conn.close()
            except Exception:
                pass


# Fallback realistic disaster alerts with spatial coordinates around Panay & Western Visayas.
# viirs_data_available is intentionally omitted here — it is resolved dynamically at runtime
# by resolve_fallback_viirs() so it always reflects actual DB observation records.
_FALLBACK_PH_ALERTS_TEMPLATE: List[Dict[str, Any]] = [
    {
        "event_id": "1002891",
        "id": "gdacs-1002891",
        "name": "Tropical Cyclone (Typhoon Track - Visayas)",
        "type": "TC",
        "category": "Typhoon",
        "alert_level": "Red",
        "alert_score": 2.5,
        "date": "2024-11-10",
        "startDate": "2024-11-10",
        "endDate": "2024-12-10",
        "description": "Category 3 Tropical Cyclone entering the Philippine Area of Responsibility with projected track towards Western Visayas and Panay Island. Satellite nightlight telemetry pending ground sensor impact.",
        "severity_text": "Wind speeds up to 185 km/h · Overpass pending",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 11.75,
        "longitude": 122.00,  # Positioned slightly northwest approach over Aklan/Antique waters
        "coordinates": [11.75, 122.00],
        "bbox": [121.0, 11.0, 123.0, 12.5],
        "geometry": {"type": "Point", "coordinates": [122.00, 11.75]},
        "is_imported": False,
    },
    {
        "event_id": "panay-grid-collapse-2024",
        "id": "panay-blackout-2024",
        "name": "Panay Island Grid Collapse",
        "type": "POW",
        "category": "Power Disruption",
        "alert_level": "Red",
        "alert_score": 2.9,
        "date": "2024-01-02",
        "startDate": "2024-01-02",
        "endDate": "2024-02-01",
        "description": "Cascading power plant shutdowns leading to total island-wide blackout across Iloilo, Capiz, Aklan, and Antique substations. Verified via multi-day VIIRS radiance drop analysis.",
        "severity_text": "Total Grid Failure · 93 LGUs Impacted",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 10.72,
        "longitude": 122.56,  # Centered near Iloilo City / major transmission hubs
        "coordinates": [10.72, 122.56],
        "bbox": [121.8, 10.3, 123.2, 11.8],
        "geometry": {"type": "Point", "coordinates": [122.56, 10.72]},
        "is_imported": False,
    },
    {
        "event_id": "tc-odette-2021",
        "id": "typhoon-rai-2021",
        "name": "Typhoon Rai (Odette)",
        "type": "TC",
        "category": "Typhoon",
        "alert_level": "Red",
        "alert_score": 3.0,
        "date": "2021-12-16",
        "startDate": "2021-12-16",
        "endDate": "2022-01-16",
        "description": "Destructive Category 5 equivalent storm tracking across Southern Visayas, heavily impacting southern portions of Panay and Negros corridors.",
        "severity_text": "Super Typhoon · Severe Radiance Loss",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 9.90,
        "longitude": 125.50,
        "coordinates": [9.90, 125.50],
        "bbox": [122.0, 9.0, 126.0, 11.0],
        "geometry": {"type": "Point", "coordinates": [125.50, 9.90]},
        "is_imported": False,
    },
    {
        "event_id": "tc-haiyan-2013",
        "id": "typhoon-haiyan-2013",
        "name": "Super Typhoon Haiyan (Yolanda)",
        "type": "TC",
        "category": "Typhoon",
        "alert_level": "Red",
        "alert_score": 3.0,
        "date": "2013-11-08",
        "startDate": "2013-11-08",
        "endDate": "2013-12-08",
        "description": "Historical catastrophic storm track crossing Central Philippines, serving as the ultimate multi-year baseline benchmark for SANAG recovery modeling.",
        "severity_text": "Maximum Intensity · Historical Benchmark",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 11.10,
        "longitude": 125.30,
        "coordinates": [11.10, 125.30],
        "bbox": [122.0, 10.0, 126.0, 12.0],
        "geometry": {"type": "Point", "coordinates": [125.30, 11.10]},
        "is_imported": False,
    },
    {
        "event_id": "1003412",
        "id": "habagat-carina-2024",
        "name": "Southwest Monsoon / Gaemi Floods",
        "type": "FL",
        "category": "Flood",
        "alert_level": "Green",
        "alert_score": 1.0,
        "date": "2024-07-24",
        "startDate": "2024-07-24",
        "endDate": "2024-08-24",
        "description": "Enhanced Southwest Monsoon low-pressure precipitation triggering precautionary substation isolation across Panay River Basin (Capiz/Iloilo inland plains).",
        "severity_text": "Heavy rainfall 120mm/24h · River basin flood watch",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 11.50,
        "longitude": 122.75,  # Centered over Capiz / Panay River basin
        "coordinates": [11.50, 122.75],
        "bbox": [122.2, 11.1, 123.1, 11.8],
        "geometry": {"type": "Point", "coordinates": [122.75, 11.50]},
        "is_imported": False,
    },
    {
        "event_id": "1004521",
        "id": "typhoon-kalmaegi-2025",
        "name": "Typhoon Kalmaegi (Tino)",
        "type": "TC",
        "category": "Tropical Cyclone",
        "alert_level": "Orange",
        "alert_score": 2.2,
        "date": "2025-11-03",
        "startDate": "2025-11-03",
        "endDate": "2025-12-03",
        "description": "Brought heavy flooding, widespread displacement, and power interruptions across Iloilo, Capiz, Antique, Aklan, and Guimaras.",
        "severity_text": "Severe wind gusts 140km/h · Regional grid alert",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 10.72,
        "longitude": 122.56,
        "coordinates": [10.72, 122.56],
        "bbox": [121.9, 10.3, 123.2, 11.9],
        "geometry": {"type": "Point", "coordinates": [122.56, 10.72]},
        "is_imported": False,
    },
    {
        "event_id": "1004892",
        "id": "gdacs-1004892",
        "name": "Tropical Storm Ramil Panay Floods",
        "type": "FL",
        "category": "Flood",
        "alert_level": "Green",
        "alert_score": 1.4,
        "date": "2025-10-18",
        "startDate": "2025-10-18",
        "endDate": "2025-11-18",
        "description": "Extensive flooding swept across Panay Island following torrential rains, extending beyond riverbanks into populated municipal areas.",
        "severity_text": "Prolonged rainfall 150mm/24h · Lowland inundation watch",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 11.10,
        "longitude": 122.40,
        "coordinates": [11.10, 122.40],
        "bbox": [122.0, 10.6, 122.9, 11.6],
        "geometry": {"type": "Point", "coordinates": [122.40, 11.10]},
        "is_imported": False,
    },
    {
        "event_id": "1005104",
        "id": "gdacs-1005104",
        "name": "Western Visayas Monsoon Flooding",
        "type": "FL",
        "category": "Flood",
        "alert_level": "Green",
        "alert_score": 1.1,
        "date": "2026-07-24",
        "startDate": "2026-07-24",
        "endDate": "2026-08-24",
        "description": "Monsoon-enhanced heavy rainfall triggered deep floods across multiple barangays in Iloilo City and coastal towns in Antique like Hamtic.",
        "severity_text": "Urban flash floods · Tidal backup advisory",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 10.70,
        "longitude": 122.05,
        "coordinates": [10.70, 122.05],
        "bbox": [121.8, 10.4, 122.7, 11.3],
        "geometry": {"type": "Point", "coordinates": [122.05, 10.70]},
        "is_imported": False,
    },
    {
        "event_id": "1005105",
        "id": "gdacs-1005105",
        "name": "Antique Coastal Flooding",
        "type": "FL",
        "category": "Flood",
        "alert_level": "Green",
        "alert_score": 1.1,
        "date": "2026-08-21",
        "startDate": "2026-08-21",
        "endDate": "2026-09-21",
        "description": "Moderate coastal inundation event affecting low-lying Antique municipalities, particularly coastal roads and seaside barangays.",
        "severity_text": "Coastal flood advisory · Near-shore tidal influence",
        "country": "Philippines",
        "url": "https://www.gdacs.org",
        "latitude": 10.70,
        "longitude": 121.50,
        "coordinates": [10.70, 121.50],
        "bbox": [121.2, 10.4, 121.8, 10.9],
        "geometry": {"type": "Point", "coordinates": [121.50, 10.70]},
        "is_imported": False,
    },
]

def _get_fallback_alerts() -> List[Dict[str, Any]]:
    """
    Returns a fresh copy of the fallback alert list with `viirs_data_available`
    resolved against the live DB for each alert's date — not hardcoded.
    """
    result = []
    for template in _FALLBACK_PH_ALERTS_TEMPLATE:
        alert = dict(template)
        alert["viirs_data_available"] = check_viirs_data_availability(alert.get("date"))
        result.append(alert)
    return result



def format_gdacs_feature(
    props: Dict[str, Any],
    geom: Optional[Dict[str, Any]] = None,
    bbox: Optional[List[float]] = None
) -> Dict[str, Any]:
    """Helper to transform raw GDACS GeoJSON feature into standard hazard model with coordinates."""
    raw_id = props.get('eventid') or props.get('event_id') or props.get('id') or 'unknown'
    ev_id_str = str(raw_id)
    event_name = str(props.get('name') or props.get('eventname') or 'Hazard Alert')
    raw_type = str(props.get('eventtype') or 'GEN').upper()
    category = EVENT_TYPE_MAP.get(raw_type, "Power Disruption")
    
    alert_level = str(props.get('alertlevel') or props.get('episodealertlevel') or 'Green').capitalize()
    alert_score = props.get('alertscore') or props.get('episodealertscore') or 1.0
    
    now_utc_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Expanded key lookup to capture true event dates from GDACS feeds/scrapers
    raw_date = str(
        props.get('fromdate') or 
        props.get('fromDate') or 
        props.get('pubDate') or 
        props.get('episodealertdate') or 
        props.get('to-date') or 
        props.get('date') or 
        now_utc_str
    )
    date_clean = raw_date[:10] if len(raw_date) >= 10 else now_utc_str
    
    description = str(props.get('description') or props.get('htmldescription') or f"{alert_level} Alert for {event_name}")
    
    severity_data = props.get('severitydata') or {}
    severity_text = ""
    if isinstance(severity_data, dict):
        severity_text = severity_data.get('severitytext') or severity_data.get('text') or ""
    if not severity_text:
        severity_text = f"Alert Level {alert_level} · Hazard Index {alert_score}"

    url_info = props.get('url')
    report_url = url_info.get('report') if isinstance(url_info, dict) else (str(url_info) if url_info else "https://www.gdacs.org")

    # Extract spatial coordinates [lat, lon]
    lat: Optional[float] = None
    lon: Optional[float] = None

    if geom and isinstance(geom, dict):
        coords = geom.get('coordinates')
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            # GeoJSON format: coordinates are [longitude, latitude]
            try:
                if isinstance(coords[0], (int, float)) and isinstance(coords[1], (int, float)):
                    lon = float(coords[0])
                    lat = float(coords[1])
                elif isinstance(coords[0], list):  # Line or Polygon centroid
                    p = coords[0][0] if isinstance(coords[0][0], list) else coords[0]
                    if len(p) >= 2:
                        lon = float(p[0])
                        lat = float(p[1])
            except Exception:
                pass

    if lat is None:
        raw_lat = props.get('latitude') or props.get('lat') or props.get('y')
        if raw_lat is not None:
            try:
                lat = float(raw_lat)
            except Exception:
                pass

    if lon is None:
        raw_lon = props.get('longitude') or props.get('lon') or props.get('lng') or props.get('x')
        if raw_lon is not None:
            try:
                lon = float(raw_lon)
            except Exception:
                pass

    if (lat is None or lon is None) and bbox and len(bbox) >= 4:
        try:
            lon = (bbox[0] + bbox[2]) / 2.0
            lat = (bbox[1] + bbox[3]) / 2.0
        except Exception:
            pass

    return {
        "event_id": ev_id_str,
        "id": f"gdacs-{ev_id_str}",
        "name": event_name,
        "type": raw_type,
        "category": category,
        "alert_level": alert_level,
        "alert_score": float(alert_score) if isinstance(alert_score, (int, float)) else 1.0,
        "date": date_clean,
        "fromdate": raw_date,
        "description": description,
        "severity_text": severity_text,
        "country": "Philippines",
        "url": report_url,
        "latitude": lat,
        "longitude": lon,
        "coordinates": [lat, lon] if (lat is not None and lon is not None) else None,
        "bbox": bbox,
        "geometry": geom,
        "is_imported": False,
        "viirs_data_available": check_viirs_data_availability(date_clean)
    }

def get_latest_philippines_disasters(limit: int = 50, include_historical: bool = True) -> List[Dict[str, Any]]:
    """Fetches recent natural disaster events and merges them with verified historical benchmarks for robust simulation."""
    try:
        client = GDACSAPIReader()
        events_response = getattr(client, "latest_events")(limit=limit)
        features = events_response.features if hasattr(events_response, 'features') else (
            events_response.get('features', []) if isinstance(events_response, dict) else events_response
        )
        
        ph_events = []
        for feature in features:
            props = feature.get('properties', {}) if isinstance(feature, dict) else getattr(feature, 'properties', {})
            geom = feature.get('geometry') if isinstance(feature, dict) else getattr(feature, 'geometry', None)
            bbox = feature.get('bbox') if isinstance(feature, dict) else getattr(feature, 'bbox', None)

            countries = props.get('affected_countries') or props.get('countries') or []
            country_name = props.get('country') or props.get('countryname') or ''
            iso3 = (props.get('iso3') or '').upper()
            event_name = str(props.get('name') or props.get('eventname') or '')
            description = str(props.get('description') or '')

            is_philippines = (
                iso3 == 'PHL' or
                'philippines' in country_name.lower() or
                'philippines' in event_name.lower() or
                'philippines' in description.lower() or
                any(
                    isinstance(c, dict) and (
                        c.get('iso3', '').upper() == 'PHL' or
                        'philippines' in str(c.get('countryname', '')).lower()
                    )
                    for c in countries
                )
            )

            if is_philippines:
                ph_events.append(format_gdacs_feature(props, geom=geom, bbox=bbox))

        seen_ids = set()
        deduped = []
        
        # 1. Add live/recent Philippine events first
        for ev in ph_events:
            if ev["event_id"] not in seen_ids:
                seen_ids.add(ev["event_id"])
                deduped.append(ev)

        # 2. Always merge historical benchmarks so past storms/earthquakes remain available for simulation
        if include_historical:
            for fb in _get_fallback_alerts():
                if fb["event_id"] not in seen_ids:
                    seen_ids.add(fb["event_id"])
                    deduped.append(fb)

        result_list = deduped if deduped else _get_fallback_alerts()

        # Strictly sort in reverse chronological order (newest/most recent first)
        result_list.sort(
            key=lambda ev: str(ev.get("fromdate") or ev.get("startDate") or ev.get("date") or ev.get("pubDate") or ""),
            reverse=True
        )

        return result_list

    except GDACSAPIError as error:
        print(f"GDACS API Error: {error}")
        fallback = _get_fallback_alerts()
        fallback.sort(
            key=lambda ev: str(ev.get("fromdate") or ev.get("startDate") or ev.get("date") or ev.get("pubDate") or ""),
            reverse=True
        )
        return fallback
    except Exception as e:
        print(f"Unexpected error fetching GDACS feed: {e}")
        fallback = _get_fallback_alerts()
        fallback.sort(
            key=lambda ev: str(ev.get("fromdate") or ev.get("startDate") or ev.get("date") or ev.get("pubDate") or ""),
            reverse=True
        )
        return fallback

if __name__ == "__main__":
    alerts = get_latest_philippines_disasters()
    print(f"Fetched {len(alerts)} total events (Live + Historical Benchmarks):")
    for alert in alerts:
        title = alert.get('title') or alert.get('name') or alert.get('eventname') or 'Untitled'
        level = alert.get('alert_level') or 'Unknown'
        date_str = alert.get('date') or 'No date'
        print(f"- [{date_str}] {title} ({level})")