from datetime import timezone
import sqlite3
import os
import math
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

# Disaster impact profiles and baseline parameters
CATEGORY_IMPACT_CONFIG = {
    "Power Disruption": {
        "base_ratio": 0.28,
        "base_k": 0.22,
        "urban_factor": 0.44,
        "description": "Grid-wide trip with rapid substation and priority feeder recovery",
    },
    "Typhoon": {
        "base_ratio": 0.32,
        "base_k": 0.18,
        "urban_factor": 0.35,
        "description": "Severe wind and pole damage; slower physical distribution line rebuild",
    },
    "Flood": {
        "base_ratio": 0.52,
        "base_k": 0.26,
        "urban_factor": 0.25,
        "description": "Lowland inundation and precautionary cutoff; fast recovery as waters recede",
    },
    "Earthquake": {
        "base_ratio": 0.25,
        "base_k": 0.20,
        "urban_factor": 0.35,
        "description": "Structural substation damage requiring component replacement",
    },
}
DEFAULT_IMPACT_CONFIG = {
    "base_ratio": 0.35,
    "base_k": 0.22,
    "urban_factor": 0.35,
    "description": "Standard disaster impact profile",
}

# Provincial geographic & grid characteristics:
# PH06030: Iloilo (Grid core, power generation plants, faster restoration)
# PH06004: Aklan (Northern tourism corridor, Boracay microgrids, rural interior)
# PH06019: Capiz (Northern agricultural flood plains, moderate grid speed)
# PH06006: Antique (Mountainous west coast, radial line extremities, slower line patrol)
PROVINCE_FACTORS = {
    "PH06030": {"mod": 0.10, "k_mod": 0.04},
    "PH06004": {"mod": 0.05, "k_mod": 0.02},
    "PH06019": {"mod": -0.02, "k_mod": -0.01},
    "PH06006": {"mod": -0.08, "k_mod": -0.04},
}

# Keywords indicating major urban centers, commercial hubs, or priority facilities
URBAN_HUB_KEYWORDS = [
    "capital", "city", "pavia", "kalibo", "malay", "roxas", "san jose",
    "passi", "oton", "santa barbara", "estancia", "san miguel", "leganes",
    "numancia", "pototan", "barotac", "miagao", "guimbal"
]


def parse_date_safe(date_str: Optional[str]) -> Optional[datetime]:
    """Parse date strings like 'YYYY-MM-DD' or 'YYYY-MM' safely."""
    if not date_str:
        return None
    s = date_str.strip()
    try:
        if len(s) == 7:
            return datetime.strptime(s, "%Y-%m")
        return datetime.strptime(s[:10], "%Y-%m-%d")
    except Exception:
        return None


def fetch_baselines_cache(cursor: sqlite3.Cursor) -> Tuple[Dict[str, List[Dict[str, Any]]], float]:
    """
    Fetches all non-null baselines from the database and returns:
    1. A dictionary indexed by municipality_name and municipality_pcode
    2. The regional average baseline radiance to use as a robust fallback
    """
    cursor.execute("SELECT AVG(baseline_radiance) FROM baselines WHERE baseline_radiance IS NOT NULL")
    avg_row = cursor.fetchone()
    regional_avg = float(avg_row[0]) if (avg_row and avg_row[0] is not None) else 0.75

    cursor.execute("""
        SELECT municipality_name, municipality_pcode, month_date, baseline_radiance
        FROM baselines
        WHERE baseline_radiance IS NOT NULL
    """)
    records = cursor.fetchall()

    baselines_by_mun: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        mun_name = r["municipality_name"]
        pcode = r["municipality_pcode"]
        dt = parse_date_safe(r["month_date"])
        if dt is None:
            continue

        item = {
            "month_date": r["month_date"],
            "dt": dt,
            "radiance": float(r["baseline_radiance"])
        }

        if mun_name:
            baselines_by_mun.setdefault(mun_name, []).append(item)
            baselines_by_mun.setdefault(mun_name.lower(), []).append(item)
        if pcode:
            baselines_by_mun.setdefault(pcode, []).append(item)
            baselines_by_mun.setdefault(pcode.lower(), []).append(item)

    return baselines_by_mun, regional_avg


def get_matching_baseline(
    baselines_by_mun: Dict[str, List[Dict[str, Any]]],
    regional_avg: float,
    mun_name: str,
    pcode: Optional[str],
    event_date: datetime
) -> float:
    """
    Retrieves the closest pre-disaster baseline radiance for a municipality:
    1. Highest priority: exact month match.
    2. Second priority: closest baseline record dated on or prior to the event date.
    3. Third priority: closest available baseline in time for this municipality.
    4. Fallback: regional average baseline across Panay Island.
    """
    candidates = (
        baselines_by_mun.get(mun_name)
        or (baselines_by_mun.get(pcode) if pcode else None)
        or baselines_by_mun.get(mun_name.lower())
        or (baselines_by_mun.get(pcode.lower()) if pcode else None)
        or []
    )

    if not candidates:
        return regional_avg

    # 1. Exact month match
    month_prefix = event_date.strftime("%Y-%m")
    exact_month = [c for c in candidates if c["month_date"].startswith(month_prefix)]
    if exact_month:
        return exact_month[0]["radiance"]

    # 2. Check for pre-disaster baselines (month_date <= event_date)
    pre_disaster = [c for c in candidates if c["dt"] <= event_date]
    if pre_disaster:
        closest_pre = max(pre_disaster, key=lambda c: c["dt"])
        return closest_pre["radiance"]

    # 3. Closest available baseline in time for this municipality
    closest_any = min(candidates, key=lambda c: abs((c["dt"] - event_date).total_seconds()))
    return closest_any["radiance"]


def get_mun_variance(event_id: str, pcode: str, name: str) -> float:
    """
    Generates a deterministic pseudo-random variance in [-0.5, +0.5] per municipality and event.
    Ensures simulations are 100% reproducible while introducing natural real-world variation.
    """
    key = f"{event_id}:{pcode}:{name}".encode("utf-8")
    h = int(hashlib.md5(key).hexdigest()[:8], 16)
    return ((h % 1000) / 1000.0) - 0.5


def compute_recovery_radiance(
    baseline: float,
    impact_ratio: Optional[float] = None,
    k: Optional[float] = None,
    day_index: int = 0,
    total_days: int = 14,
    event_id: str = "panay-blackout-2024",
    category: str = "Power Disruption",
    mun_name: str = "",
    pcode: str = "",
    province_code: str = "",
) -> float:
    """
    Generates simulated post-disaster daily radiance that:
    1. Scales properly with each municipality's true baseline radiance so R(t) = L(t) / L_baseline
       produces a realistic 0–100 recovery score.
    2. Introduces provincial diversity and urban-vs-rural differentiation so the map displays
       a healthy, vibrant distribution of 'Restored', 'Recovering', 'Limited', and 'Critical' states.
    3. Ensures Day-0 drops accurately reflect event severity and climb smoothly back toward baseline
       along an asymptotic recovery curve over the 14-day window.
    """
    # 1. Determine Urban / Infrastructure Index U in [0.0, 1.0]
    is_hub = any(kw in mun_name.lower() for kw in URBAN_HUB_KEYWORDS)
    base_factor = min(1.0, max(0.0, (baseline - 0.35) / (2.0 - 0.35)))
    urban_score = min(1.0, max(0.0, 0.50 * base_factor + (0.50 if is_hub else 0.0)))

    # 2. Deterministic noise per municipality
    noise = get_mun_variance(event_id, pcode, mun_name) * 0.20

    # 3. Provincial geographic modifier
    prov_cfg = PROVINCE_FACTORS.get(province_code, {"mod": 0.0, "k_mod": 0.0})
    prov_mod = prov_cfg["mod"]
    prov_k_mod = prov_cfg["k_mod"]

    # 4. Calibrate Day-0 impact ratio R0 and recovery speed k by event type
    config = CATEGORY_IMPACT_CONFIG.get(category, DEFAULT_IMPACT_CONFIG)
    base_ratio = config["base_ratio"]
    base_k = config["base_k"]
    urban_factor = config["urban_factor"]

    if category == "Power Disruption":
        if "malay" in mun_name.lower():
            # Malay / Boracay Island: heavy private resort generators & microgrid resilience
            day0_ratio = 0.85 + (noise * 0.20)
        else:
            day0_ratio = base_ratio + (urban_score * urban_factor) + prov_mod + noise
        rec_k = base_k + (urban_score * 0.12) + (prov_mod * 0.30)

    elif category == "Typhoon":
        if event_id == "haiyan":
            # Haiyan: Northern Panay eyewall trajectory (Capiz & Northern Aklan severely impacted)
            haiyan_prov_mod = {"PH06019": -0.15, "PH06004": -0.10, "PH06030": 0.08, "PH06006": 0.12}.get(province_code, 0.0)
            day0_ratio = 0.30 + (urban_score * urban_factor) + haiyan_prov_mod + noise
            rec_k = base_k + (urban_score * 0.10) + (haiyan_prov_mod * 0.20)
        else:
            # Odette: Southern Panay track (Southern Iloilo and Antique impacted)
            odette_prov_mod = {"PH06030": -0.08, "PH06006": -0.10, "PH06019": 0.12, "PH06004": 0.15}.get(province_code, 0.0)
            day0_ratio = 0.35 + (urban_score * urban_factor) + odette_prov_mod + noise
            rec_k = base_k + (urban_score * 0.10) + (odette_prov_mod * 0.20)

    elif category == "Flood":
        # Lowland river basins (Capiz plains and coastal Iloilo) flooded; mountains shielded
        flood_prov_mod = {"PH06019": -0.12, "PH06030": -0.04, "PH06004": 0.08, "PH06006": 0.14}.get(province_code, 0.0)
        day0_ratio = base_ratio + (urban_score * urban_factor) + flood_prov_mod + noise
        rec_k = base_k + (urban_score * 0.10) + (flood_prov_mod * 0.20)

    else:
        day0_ratio = base_ratio + (urban_score * urban_factor) + prov_mod + noise
        rec_k = base_k + (urban_score * 0.10) + prov_k_mod

    # If explicit impact_ratio and k were supplied by a caller, respect them while retaining noise
    if impact_ratio is not None and k is not None:
        day0_ratio = impact_ratio + (noise * 0.08)
        rec_k = k

    # Clamp Day-0 ratio to safe realistic bounds [0.10, 0.95]
    day0_ratio = min(max(day0_ratio, 0.10), 0.95)
    rec_k = max(0.14, min(rec_k, 0.38))

    # Day 0 onset
    if day_index <= 0:
        return round(baseline * day0_ratio, 4)

    # 5. Exponential asymptotic recovery curve over the disaster window
    max_days = max(total_days - 1, 1)
    norm = 1.0 - math.exp(-rec_k * max_days)
    progress = 1.0 if norm == 0 else (1.0 - math.exp(-rec_k * day_index)) / norm

    # Subtle daily satellite observation micro-variance (+/- 0.015)
    day_h = int(hashlib.md5(f"{event_id}:{pcode}:{day_index}".encode("utf-8")).hexdigest()[:6], 16)
    day_noise = (((day_h % 1000) / 1000.0) - 0.5) * 0.03 if day_index < total_days - 1 else 0.0

    current_ratio = day0_ratio + (1.0 - day0_ratio) * progress + day_noise
    # Ensure progression never drops below 95% of Day 0 and gracefully climbs to 100% of baseline
    current_ratio = min(max(current_ratio, day0_ratio * 0.95), 1.02)
    return round(baseline * current_ratio, 4)


def seed_observations_for_all_events(overwrite: bool = True, window_days: int = 14):
    """
    Seeds radiance_observations for all events using actual database baselines
    and realistic asymptotic recovery curves with provincial and urban/rural diversity.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Fetch all municipalities with their province code
    cursor.execute("SELECT name, code, province_code FROM municipalities")
    municipalities = cursor.fetchall()

    if not municipalities:
        print("No municipalities found in database to seed.")
        conn.close()
        return

    # 2. Fetch all events with their date, category, and municipality target
    cols = [col[1] for col in cursor.execute("PRAGMA table_info(events)").fetchall()]
    date_col = "event_date" if "event_date" in cols else "date"
    category_col = "category" if "category" in cols else "'Power Disruption'"
    mun_col = "municipality_code" if "municipality_code" in cols else "'PANAY_ALL'"

    cursor.execute(f"SELECT id, name, {category_col} AS category, {mun_col} AS municipality_code, {date_col} AS event_date FROM events")
    events = cursor.fetchall()

    if not events:
        print("No events found in database to seed around.")
        conn.close()
        return

    # 3. Load baseline data cache and regional average fallback
    baselines_by_mun, regional_avg = fetch_baselines_cache(cursor)

    print(
        f"Seeding realistic recovery curves for {len(municipalities)} municipalities "
        f"across {len(events)} events (regional baseline fallback: {regional_avg:.4f})..."
    )

    records_processed = 0

    for event in events:
        ev_id = str(event["id"])
        raw_date = event["event_date"]
        category = event["category"] or "Power Disruption"
        target_mun_code = event["municipality_code"]

        event_date = parse_date_safe(raw_date)
        if not event_date:
            continue

        # Filter target municipalities if the event targets a single municipality
        if target_mun_code and target_mun_code != "PANAY_ALL":
            target_munis = [m for m in municipalities if m["code"] == target_mun_code or m["name"] == target_mun_code]
            if not target_munis:
                target_munis = municipalities
        else:
            target_munis = municipalities

        day0_states: Dict[str, int] = {"restored": 0, "recovering": 0, "warning": 0, "critical": 0}
        day0_scores: List[float] = []

        for mun in target_munis:
            mun_name = mun["name"]
            pcode = mun["code"]
            province_code = mun["province_code"] or ""

            # Fetch matching baseline radiance
            baseline = get_matching_baseline(baselines_by_mun, regional_avg, mun_name, pcode, event_date)

            for day_idx in range(window_days):
                current_date = event_date + timedelta(days=day_idx)
                date_str = current_date.strftime("%Y-%m-%d")

                simulated_radiance = compute_recovery_radiance(
                    baseline=baseline,
                    day_index=day_idx,
                    total_days=window_days,
                    event_id=ev_id,
                    category=category,
                    mun_name=mun_name,
                    pcode=pcode,
                    province_code=province_code,
                )

                if day_idx == 0:
                    r_val = simulated_radiance / baseline if baseline > 0 else 0.0
                    score = round(r_val * 100)
                    day0_scores.append(score)
                    if score >= 80:
                        day0_states["restored"] += 1
                    elif score >= 60:
                        day0_states["recovering"] += 1
                    elif score >= 40:
                        day0_states["warning"] += 1
                    else:
                        day0_states["critical"] += 1

                if overwrite:
                    cursor.execute("""
                        INSERT INTO radiance_observations (municipality_name, municipality_pcode, observation_date, daily_radiance)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(municipality_name, observation_date) DO UPDATE SET
                            daily_radiance = excluded.daily_radiance,
                            municipality_pcode = excluded.municipality_pcode
                    """, (mun_name, pcode, date_str, simulated_radiance))
                else:
                    cursor.execute(
                        "SELECT 1 FROM radiance_observations WHERE municipality_name = ? AND observation_date = ?",
                        (mun_name, date_str)
                    )
                    if not cursor.fetchone():
                        cursor.execute("""
                            INSERT INTO radiance_observations (municipality_name, municipality_pcode, observation_date, daily_radiance)
                            VALUES (?, ?, ?, ?)
                        """, (mun_name, pcode, date_str, simulated_radiance))

                records_processed += 1

        avg_day0 = sum(day0_scores) / len(day0_scores) if day0_scores else 0.0
        print(
            f"  [Event: {ev_id} ({category})] Day 0 Avg: {avg_day0:.1f}% | "
            f"Restored: {day0_states['restored']} | "
            f"Recovering: {day0_states['recovering']} | "
            f"Limited: {day0_states['warning']} | "
            f"Critical: {day0_states['critical']}"
        )

    conn.commit()
    conn.close()
    print(f"\nSuccessfully seeded {records_processed} observation records with diverse, data-driven recovery curves!")


def seed_single_event(
    event_id: str,
    event_date_str: str,
    category: str = "Power Disruption",
    alert_level: str = "Green",
    target_mun_code: str = "PANAY_ALL",
    overwrite: bool = True,
    window_days: int = 14
) -> Dict[str, Any]:
    """
    Dynamically seeds radiance_observations for a single disaster event (such as an imported GDACS alert)
    across all 93 Panay municipalities, scaling the initial radiance impact and recovery trajectory
    according to GDACS hazard type and alert level (Red / Orange / Green).
    """
    event_date = parse_date_safe(event_date_str)
    event_date = datetime.now(timezone.utc)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT name, code, province_code FROM municipalities")
    municipalities = cursor.fetchall()
    if not municipalities:
        conn.close()
        return {"records_processed": 0, "day0_avg": 0.0, "day0_states": {}}

    baselines_by_mun, regional_avg = fetch_baselines_cache(cursor)

    # Determine hazard-level impact parameters based on GDACS alert level & hazard category
    alert = (alert_level or "Green").strip().lower()
    cat_cfg = CATEGORY_IMPACT_CONFIG.get(category, DEFAULT_IMPACT_CONFIG)

    if alert == "red":
        base_impact = min(0.25, cat_cfg["base_ratio"] * 0.70)
        base_k = max(0.14, cat_cfg["base_k"] * 0.80)
    elif alert == "orange":
        base_impact = min(0.42, cat_cfg["base_ratio"] * 0.95)
        base_k = max(0.18, cat_cfg["base_k"] * 0.95)
    else:  # Green or informational alert
        base_impact = min(0.65, max(0.50, cat_cfg["base_ratio"] * 1.35))
        base_k = min(0.32, cat_cfg["base_k"] * 1.25)

    if target_mun_code and target_mun_code != "PANAY_ALL":
        target_munis = [m for m in municipalities if m["code"] == target_mun_code or m["name"] == target_mun_code]
        if not target_munis:
            target_munis = municipalities
    else:
        target_munis = municipalities

    records_processed = 0
    day0_scores: List[float] = []
    day0_states: Dict[str, int] = {"restored": 0, "recovering": 0, "warning": 0, "critical": 0}

    for mun in target_munis:
        mun_name = mun["name"]
        pcode = mun["code"]
        province_code = mun["province_code"] or ""

        baseline = get_matching_baseline(baselines_by_mun, regional_avg, mun_name, pcode, event_date)

        for day_idx in range(window_days):
            current_date = event_date + timedelta(days=day_idx)
            date_str = current_date.strftime("%Y-%m-%d")

            simulated_radiance = compute_recovery_radiance(
                baseline=baseline,
                impact_ratio=base_impact,
                k=base_k,
                day_index=day_idx,
                total_days=window_days,
                event_id=event_id,
                category=category,
                mun_name=mun_name,
                pcode=pcode,
                province_code=province_code,
            )

            if day_idx == 0:
                r_val = simulated_radiance / baseline if baseline > 0 else 0.0
                score = round(r_val * 100)
                day0_scores.append(score)
                if score >= 90:
                    day0_states["restored"] += 1
                elif score >= 60:
                    day0_states["recovering"] += 1
                elif score >= 30:
                    day0_states["warning"] += 1
                else:
                    day0_states["critical"] += 1

            if overwrite:
                cursor.execute("""
                    INSERT INTO radiance_observations (municipality_name, municipality_pcode, observation_date, daily_radiance)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(municipality_name, observation_date) DO UPDATE SET
                        daily_radiance = excluded.daily_radiance,
                        municipality_pcode = excluded.municipality_pcode
                """, (mun_name, pcode, date_str, simulated_radiance))
            else:
                cursor.execute(
                    "SELECT 1 FROM radiance_observations WHERE municipality_name = ? AND observation_date = ?",
                    (mun_name, date_str)
                )
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO radiance_observations (municipality_name, municipality_pcode, observation_date, daily_radiance)
                        VALUES (?, ?, ?, ?)
                    """, (mun_name, pcode, date_str, simulated_radiance))

            records_processed += 1

    conn.commit()
    conn.close()

    avg_day0 = sum(day0_scores) / len(day0_scores) if day0_scores else 0.0
    return {
        "event_id": event_id,
        "date": event_date.strftime("%Y-%m-%d"),
        "records_processed": records_processed,
        "day0_avg": avg_day0,
        "day0_states": day0_states
    }


if __name__ == "__main__":
    seed_observations_for_all_events()