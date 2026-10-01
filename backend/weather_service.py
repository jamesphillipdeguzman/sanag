import logging
import math
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Centroid for Panay Island
DEFAULT_LAT = 11.15
DEFAULT_LON = 122.50

# 30-minute in-memory cache to prevent 429 Too Many Requests on Open-Meteo API
_FORECAST_CACHE: Dict[Tuple[float, float, int], Tuple[float, Dict[str, Any]]] = {}
_FORECAST_CACHE_TTL_SECONDS = 30 * 60  # 1800 seconds (30 minutes)


def get_cached_weather_forecast(lat: float, lon: float, days: int) -> Optional[Dict[str, Any]]:
    key = (round(lat, 2), round(lon, 2), days)
    if key in _FORECAST_CACHE:
        cached_time, cached_data = _FORECAST_CACHE[key]
        if time.time() - cached_time < _FORECAST_CACHE_TTL_SECONDS:
            return cached_data
    return None


def set_cached_weather_forecast(lat: float, lon: float, days: int, data: Dict[str, Any]) -> None:
    key = (round(lat, 2), round(lon, 2), days)
    _FORECAST_CACHE[key] = (time.time(), data)


def get_fallback_weather_forecast(
    latitude: float = DEFAULT_LAT,
    longitude: float = DEFAULT_LON,
    days: int = 5,
) -> Dict[str, Any]:
    """
    Generates a realistic 1-to-16 day weather forecast for Panay Island / Philippines
    when external Open-Meteo API is unreachable or rate-limited.
    Matches Open-Meteo v1 forecast JSON response format.
    """
    try:
        safe_days = max(1, min(16, days))
    except (ValueError, TypeError):
        safe_days = 5

    try:
        safe_lat = round(latitude, 4)
    except (ValueError, TypeError):
        safe_lat = DEFAULT_LAT

    try:
        safe_lon = round(longitude, 4)
    except (ValueError, TypeError):
        safe_lon = DEFAULT_LON

    today = datetime.now(timezone.utc).date()

    # Tropical Philippine climatology patterns (alternating sun, clouds, localized convective showers)
    # WMO Codes:
    # 0: Clear Sky, 1: Mainly Clear, 2: Partly Cloudy, 3: Overcast, 61: Light Rain, 80: Rain Showers
    base_pattern = [
        {"code": 2, "t_max": 31.5, "t_min": 24.8, "rain": 2.2, "pop": 45, "wind": 15.5},  # Day 0: Partly Cloudy
        {"code": 3, "t_max": 30.8, "t_min": 24.2, "rain": 5.8, "pop": 65, "wind": 18.0},  # Day 1: Overcast
        {"code": 61, "t_max": 29.5, "t_min": 23.9, "rain": 14.2, "pop": 85, "wind": 22.4}, # Day 2: Light Rain / Monsoonal
        {"code": 1, "t_max": 31.0, "t_min": 24.4, "rain": 0.8, "pop": 30, "wind": 14.2},  # Day 3: Mainly Clear
        {"code": 0, "t_max": 32.2, "t_min": 24.9, "rain": 0.0, "pop": 15, "wind": 12.0},  # Day 4: Clear Sky
        {"code": 2, "t_max": 31.8, "t_min": 24.6, "rain": 1.5, "pop": 40, "wind": 13.8},  # Day 5
        {"code": 80, "t_max": 30.2, "t_min": 24.1, "rain": 8.0, "pop": 75, "wind": 17.5}, # Day 6
        {"code": 1, "t_max": 31.4, "t_min": 24.5, "rain": 0.4, "pop": 25, "wind": 13.0},  # Day 7
    ]

    times: List[str] = []
    weather_codes: List[int] = []
    temp_maxs: List[float] = []
    temp_mins: List[float] = []
    precip_sums: List[float] = []
    precip_probs: List[int] = []
    wind_speeds: List[float] = []

    for i in range(safe_days):
        day_date = (today + timedelta(days=i)).isoformat()
        pattern = base_pattern[i % len(base_pattern)]
        times.append(day_date)
        weather_codes.append(int(pattern["code"]))
        temp_maxs.append(pattern["t_max"])
        temp_mins.append(pattern["t_min"])
        precip_sums.append(pattern["rain"])
        precip_probs.append(int(pattern["pop"]))
        wind_speeds.append(pattern["wind"])

    return {
        "latitude": safe_lat,
        "longitude": safe_lon,
        "generationtime_ms": 0.18,
        "utc_offset_seconds": 28800,
        "timezone": "Asia/Manila",
        "timezone_abbreviation": "PST",
        "elevation": 45.0,
        "is_fallback": True,
        "daily_units": {
            "time": "iso8601",
            "weather_code": "wmo code",
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
            "precipitation_probability_max": "%",
            "wind_speed_10m_max": "km/h"
        },
        "daily": {
            "time": times,
            "weather_code": weather_codes,
            "temperature_2m_max": temp_maxs,
            "temperature_2m_min": temp_mins,
            "precipitation_sum": precip_sums,
            "precipitation_probability_max": precip_probs,
            "wind_speed_10m_max": wind_speeds
        }
    }


def get_fallback_historical_weather(
    latitude: float = DEFAULT_LAT,
    longitude: float = DEFAULT_LON,
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-05"
) -> Dict[str, Any]:
    """
    Generates realistic historical daily weather data between start_date and end_date
    when external Open-Meteo Archive API is unreachable.
    """
    try:
        d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        d_start = datetime(2024, 1, 1).date()

    try:
        d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        d_end = d_start + timedelta(days=4)

    if d_end < d_start:
        d_start, d_end = d_end, d_start

    num_days = max(1, min(60, (d_end - d_start).days + 1))

    times: List[str] = []
    temp_maxs: List[float] = []
    temp_mins: List[float] = []
    precip_sums: List[float] = []
    wind_speeds: List[float] = []

    for i in range(num_days):
        current_date = (d_start + timedelta(days=i)).isoformat()
        times.append(current_date)
        temp_maxs.append(round(30.0 + (i % 3) * 0.8, 1))
        temp_mins.append(round(24.0 + (i % 2) * 0.5, 1))
        precip_sums.append(round((i * 3.5) % 15.0, 1))
        wind_speeds.append(round(14.0 + (i % 4) * 2.2, 1))

    return {
        "latitude": round(latitude, 4),
        "longitude": round(longitude, 4),
        "generationtime_ms": 0.15,
        "utc_offset_seconds": 28800,
        "timezone": "Asia/Manila",
        "timezone_abbreviation": "PST",
        "elevation": 45.0,
        "is_fallback": True,
        "daily_units": {
            "time": "iso8601",
            "temperature_2m_max": "°C",
            "temperature_2m_min": "°C",
            "precipitation_sum": "mm",
            "wind_speed_10m_max": "km/h"
        },
        "daily": {
            "time": times,
            "temperature_2m_max": temp_maxs,
            "temperature_2m_min": temp_mins,
            "precipitation_sum": precip_sums,
            "wind_speed_10m_max": wind_speeds
        }
    }


async def fetch_historical_weather(
    latitude: float = DEFAULT_LAT,
    longitude: float = DEFAULT_LON,
    start_date: str = "2024-01-01",
    end_date: str = "2024-01-05"
) -> Dict[str, Any]:
    try:
        safe_lat = latitude
    except (ValueError, TypeError):
        safe_lat = DEFAULT_LAT

    try:
        safe_lon = longitude
    except (ValueError, TypeError):
        safe_lon = DEFAULT_LON

    params = {
        "latitude": safe_lat,
        "longitude": safe_lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max"
        ],
        "timezone": "Asia/Manila"
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_ARCHIVE_URL, params=params)
            response.raise_for_status()
            data = response.json()
            if "daily" in data and isinstance(data["daily"], dict) and "time" in data["daily"]:
                return data
            logger.warning("Open-Meteo archive missing daily array, using fallback")
            return get_fallback_historical_weather(safe_lat, safe_lon, start_date, end_date)
    except Exception as exc:
        logger.warning(f"Open-Meteo archive request failed ({type(exc).__name__}: {exc}). Using historical fallback.")
        return get_fallback_historical_weather(safe_lat, safe_lon, start_date, end_date)


async def fetch_weather_forecast(
    latitude: float = DEFAULT_LAT,
    longitude: float = DEFAULT_LON,
    days: int = 5,
) -> Dict[str, Any]:
    try:
        safe_days = max(1, min(16, days))
    except (ValueError, TypeError):
        safe_days = 5

    try:
        safe_lat = latitude
    except (ValueError, TypeError):
        safe_lat = DEFAULT_LAT

    try:
        safe_lon = longitude
    except (ValueError, TypeError):
        safe_lon = DEFAULT_LON

    # Check 30-minute in-memory cache first to avoid 429 Too Many Requests
    cached_data = get_cached_weather_forecast(safe_lat, safe_lon, safe_days)
    if cached_data is not None:
        logger.info(
            f"Serving 30-minute cached Open-Meteo forecast (lat={safe_lat}, lon={safe_lon}, days={safe_days})"
        )
        return cached_data

    params = {
        "latitude": safe_lat,
        "longitude": safe_lon,
        "daily": [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "precipitation_probability_max",
            "wind_speed_10m_max",
        ],
        "forecast_days": safe_days,
        "timezone": "Asia/Manila",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(OPEN_METEO_FORECAST_URL, params=params)
            response.raise_for_status()
            data = response.json()
            if "daily" in data and isinstance(data["daily"], dict) and "time" in data["daily"]:
                set_cached_weather_forecast(safe_lat, safe_lon, safe_days, data)
                return data
            logger.warning("Open-Meteo forecast missing daily array, using fallback")
            return get_fallback_weather_forecast(safe_lat, safe_lon, safe_days)
    except Exception as exc:
        logger.warning(
            f"Open-Meteo forecast request failed ({type(exc).__name__}: {exc}). Checking stale cache or fallback."
        )
        # If rate-limited (429) or connection error, check if any cached data exists regardless of TTL
        key = (round(safe_lat, 2), round(safe_lon, 2), safe_days)
        if key in _FORECAST_CACHE:
            logger.info("Serving stale cached forecast following rate limit / network error")
            return _FORECAST_CACHE[key][1]
        return get_fallback_weather_forecast(safe_lat, safe_lon, safe_days)