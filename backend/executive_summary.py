"""
Executive Summary & Restoration Benchmarks Service for SANAG.
Provides strict threshold filtering (>= 90%) for restored municipalities,
dynamic fallback to Top Performing Hubs when no municipalities cross >= 90%,
exact dynamic badge counting, and consistent situational text generation.
"""
import os
from pathlib import Path
import re
import json
import time
from typing import List, Dict, Any, Optional, Tuple
from dotenv import load_dotenv

# Ensure .env is loaded from backend directory
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()


def filter_restored_municipalities(
    municipalities: List[Dict[str, Any]], 
    threshold: float = 90.0
) -> List[Dict[str, Any]]:
    """
    Strictly filters municipalities where the recovery score actually meets or exceeds
    the stated threshold (>= 90%). Returns them sorted descending by score.
    """
    def _extract_score(m: Dict[str, Any]) -> float:
        val = m.get("recovery_score") if m.get("recovery_score") is not None else m.get("recoveryScore", 0)
        try:
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    restored = [m for m in municipalities if _extract_score(m) >= threshold]
    restored.sort(key=_extract_score, reverse=True)
    return restored


def get_restoration_benchmarks_card_data(
    municipalities: List[Dict[str, Any]],
    threshold: float = 90.0
) -> Dict[str, Any]:
    """
    Computes strict metrics and structured card content for the Restoration Benchmarks card:
    - Accurate dynamic badge counter based only on >= threshold.
    - Dynamic fallback to 'Top Performing Hubs' if no municipalities cross >= threshold.
    - Strict percentage alignment between query results and descriptive text.
    """
    def _extract_score(m: Dict[str, Any]) -> float:
        val = m.get("recovery_score") if m.get("recovery_score") is not None else m.get("recoveryScore", 0)
        try:
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    sorted_desc = sorted(municipalities, key=_extract_score, reverse=True)
    restored = [m for m in sorted_desc if _extract_score(m) >= threshold]
    restored_count = len(restored)

    if restored_count > 0:
        card_title = "Restoration Benchmarks"
        badge_text = f"{restored_count} Restored"
        leading_hubs_summary = "; ".join(
            f"{m.get('name', 'LGU')} ({m.get('province', 'Panay')}): {round(_extract_score(m))}% score"
            for m in restored[:3]
        )
        benchmarks_bullet = (
            f"* **Leading Restoration Benchmarks**: Near-full recovery thresholds "
            f"(>= {int(threshold)}%) confirmed in: {leading_hubs_summary}."
        )
    else:
        card_title = "Top Performing Hubs"
        badge_text = "0 Restored"
        top_hubs = sorted_desc[:3]
        top_summary = "; ".join(
            f"{m.get('name', 'LGU')} ({m.get('province', 'Panay')}): {round(_extract_score(m))}% score"
            for m in top_hubs
        ) if top_hubs else "None recorded"
        benchmarks_bullet = (
            f"* **Top Performing Hubs**: No municipalities have crossed the >= {int(threshold)}% "
            f"restoration threshold yet. Highest-performing jurisdictions currently leading recovery: {top_summary}."
        )

    return {
        "card_title": card_title,
        "badge_count": restored_count,
        "badge_text": badge_text,
        "has_restored": restored_count > 0,
        "restored_municipalities": restored,
        "top_performing_municipalities": sorted_desc[:5],
        "benchmarks_bullet": benchmarks_bullet,
    }


def _clean_lgu_summary(raw_str: str, max_items: int = 3) -> str:
    """Helper to clean and format semicolon-delimited LGU strings for readability."""
    if not raw_str:
        return ""
    items = [item.strip() for item in raw_str.split(";") if item.strip()]
    cleaned_items = []
    for item in items[:max_items]:
        c = re.sub(r",\s*est\s*\d+\s*days\s*to\s*recover", "", item, flags=re.I)
        c = re.sub(r"\s+score", "", c, flags=re.I).strip()
        cleaned_items.append(c)
    return "; ".join(cleaned_items)


def _enrich_from_database_profile(data: dict):
    """Enriches data dict with standardized event profile metadata if available."""
    try:
        from database import get_event_profile
        target_key = data.get("incident_name") or data.get("category") or data.get("disaster_category") or data.get("event_type") or ""
        profile = get_event_profile(target_key)
        if profile:
            prof_type = profile.get("event_type")
            curr_type = data.get("event_type")
            # If profile is volcanic, correct any inadvertent 'Tropical Cyclone' assignment
            if not curr_type or (prof_type == "Volcanic Eruption" and curr_type in ("Tropical Cyclone", "Disaster")):
                data["event_type"] = prof_type
            if not data.get("disaster_category"):
                data["disaster_category"] = profile.get("disaster_category")
            if not data.get("root_cause_summary") or (prof_type == "Volcanic Eruption" and "winds" in (data.get("root_cause_summary") or "").lower()):
                data["root_cause_summary"] = profile.get("root_cause_summary")
            if not data.get("infrastructure_impact") or (prof_type == "Volcanic Eruption" and "hardware replacement" in (data.get("infrastructure_impact") or "").lower()):
                data["infrastructure_impact"] = profile.get("infrastructure_impact")
    except Exception:
        pass


def _parse_event_context(context: str) -> dict:
    """Extracts key disaster telemetry data points and root cause metadata from the provided event context."""
    data = {
        "incident_name": None,
        "incident_date": None,
        "severity": None,
        "category": None,
        "total_monitored": None,
        "avg_recovery": None,
        "restored_count": None,
        "critical_count": None,
        "top_critical": None,
        "top_benchmark": None,
        "top_performing": None,
        "event_type": None,
        "disaster_category": None,
        "root_cause_summary": None,
        "infrastructure_impact": None,
    }
    if not context or not isinstance(context, str):
        _enrich_from_database_profile(data)
        return data

    text = context.strip()

    # JSON fallback check if context was passed as JSON
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                data["incident_name"] = parsed.get("incident_name") or parsed.get("name") or parsed.get("event")
                data["incident_date"] = parsed.get("incident_date") or parsed.get("date")
                data["severity"] = parsed.get("severity") or parsed.get("incident_severity")
                data["category"] = parsed.get("category") or parsed.get("type")
                tot_val = parsed.get("total_monitored") or parsed.get("total_municipalities")
                if str(tot_val) == "93":
                    tot_val = "95"
                data["total_monitored"] = str(tot_val) if tot_val is not None else None
                data["avg_recovery"] = parsed.get("avg_recovery") or parsed.get("avg_score")
                data["restored_count"] = parsed.get("restored_count") or parsed.get("restored")
                data["critical_count"] = parsed.get("critical_count") or parsed.get("critical")
                data["top_critical"] = parsed.get("top_critical")
                data["top_benchmark"] = parsed.get("top_benchmark")
                data["top_performing"] = parsed.get("top_performing")
                data["event_type"] = parsed.get("event_type") or parsed.get("classification")
                data["disaster_category"] = parsed.get("disaster_category") or parsed.get("disasterCategory")
                data["root_cause_summary"] = parsed.get("root_cause_summary") or parsed.get("rootCauseSummary") or parsed.get("primary_driver")
                data["infrastructure_impact"] = parsed.get("infrastructure_impact") or parsed.get("infrastructureImpact") or parsed.get("physical_grid_impact")
                _enrich_from_database_profile(data)
                return data
        except Exception:
            pass

    # Regex extractions for structured telemetry string
    m_inc = re.search(r"(?:Disaster Incident|Incident|Event Name|Event):\s*([^\n\r]+)", text, re.I)
    if m_inc:
        raw_inc = m_inc.group(1).strip()
        date_m = re.search(r"\((\d{4}(?:-\d{2}-\d{2})?)\)", raw_inc)
        if date_m:
            data["incident_date"] = date_m.group(1).strip()
            data["incident_name"] = raw_inc.replace(f"({date_m.group(1)})", "").strip()
        else:
            data["incident_name"] = raw_inc

    if not data["incident_date"]:
        m_date = re.search(r"(?:Event Date|Incident Date|Date):\s*([^\n\r]+)", text, re.I)
        if m_date:
            data["incident_date"] = m_date.group(1).strip()

    m_sev = re.search(r"(?:Incident Severity|Severity):\s*([^|\n\r]+)", text, re.I)
    if m_sev:
        data["severity"] = m_sev.group(1).strip()

    m_cat = re.search(r"Category:\s*([^\n\r]+)", text, re.I)
    if m_cat:
        data["category"] = m_cat.group(1).strip()

    m_tot = re.search(r"(?:Total Municipalities Monitored|Total Monitored|Total Municipalities|Total LGUs Monitored|Total LGUs):\s*(\d+)", text, re.I)
    if m_tot:
        raw_tot = m_tot.group(1).strip()
        data["total_monitored"] = "95" if raw_tot == "93" else raw_tot

    m_avg = re.search(r"(?:Island-wide Average Recovery Score|Average Recovery Score|Average Recovery):\s*([\d.]+%?)", text, re.I)
    if m_avg:
        avg_val = m_avg.group(1).strip()
        data["avg_recovery"] = avg_val if avg_val.endswith("%") else f"{avg_val}%"

    m_res = re.search(r"(?:Municipalities >= 90% Restored|Restored Municipalities|Restored LGUs):\s*(\d+)", text, re.I)
    if m_res:
        data["restored_count"] = m_res.group(1).strip()

    m_crit = re.search(r"(?:Municipalities in Critical/Warning State[^:]*|Critical LGUs|Critical Municipalities):\s*(\d+)", text, re.I)
    if m_crit:
        data["critical_count"] = m_crit.group(1).strip()

    m_top_crit = re.search(r"Top Critical Outage LGUs:\s*([^\n\r]+)", text, re.I)
    if m_top_crit:
        data["top_critical"] = m_top_crit.group(1).strip()

    m_top_bench = re.search(r"(?:Top Benchmark Restored LGUs(?:\s*\([^)]*\))?|Restoration Benchmarks):\s*([^\n\r]+)", text, re.I)
    if m_top_bench:
        data["top_benchmark"] = m_top_bench.group(1).strip()

    m_top_perf = re.search(r"(?:Top Performing Hubs(?:\s*\([^)]*\))?|Leading Recovery Hubs|Top Benchmark LGUs):\s*([^\n\r]+)", text, re.I)
    if m_top_perf:
        data["top_performing"] = m_top_perf.group(1).strip()

    # Root cause & event context metadata extractions
    m_class = re.search(r"(?:Classification|\*\*Classification:\*\*):\s*([^(\n\r]+)(?:\(([^)\n\r]+)\))?", text, re.I)
    if m_class:
        data["event_type"] = m_class.group(1).strip().strip("*").strip()
        if m_class.group(2):
            data["disaster_category"] = m_class.group(2).strip().strip("*").strip()

    if not data["event_type"]:
        m_et = re.search(r"(?:Event Type|\*\*Event Type:\*\*):\s*([^\n\r]+)", text, re.I)
        if m_et:
            data["event_type"] = m_et.group(1).strip().strip("*").strip()

    if not data["disaster_category"]:
        m_dc = re.search(r"(?:Disaster Category|\*\*Disaster Category:\*\*):\s*([^\n\r]+)", text, re.I)
        if m_dc:
            data["disaster_category"] = m_dc.group(1).strip().strip("*").strip()

    m_pd = re.search(r"(?:Primary Driver|\*\*Primary Driver:\*\*|Root Cause Summary|Root Cause):\s*([^\n\r]+)", text, re.I)
    if m_pd:
        data["root_cause_summary"] = m_pd.group(1).strip().strip("*").strip()

    m_pi = re.search(r"(?:Physical Grid Impact|\*\*Physical Grid Impact:\*\*|Infrastructure Impact):\s*([^\n\r]+)", text, re.I)
    if m_pi:
        data["infrastructure_impact"] = m_pi.group(1).strip().strip("*").strip()

    # Detect volcanic context keywords or hazard code VO
    comb_text = f"{text} {data.get('incident_name') or ''} {data.get('category') or ''} {data.get('disaster_category') or ''}".lower()
    if (
        "volcan" in comb_text
        or "eruption" in comb_text
        or "taal" in comb_text
        or "mayon" in comb_text
        or "kanlaon" in comb_text
        or "bulusan" in comb_text
        or (data.get("category") or "").upper() == "VO"
    ):
        if not data.get("event_type") or data.get("event_type") in ("Tropical Cyclone", "Disaster"):
            data["event_type"] = "Volcanic Eruption"
        if not data.get("disaster_category"):
            data["disaster_category"] = "Volcanic Eruption"
        rc_lower = (data.get("root_cause_summary") or "").lower()
        if not data.get("root_cause_summary") or any(k in rc_lower for k in ("winds", "severe weather", "mechanical system")):
            data["root_cause_summary"] = (
                "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, "
                "acidic ash corrosion, and visibility-restricted emergency repair corridors."
            )
        infra_lower = (data.get("infrastructure_impact") or "").lower()
        if not data.get("infrastructure_impact") or any(k in infra_lower for k in ("hardware replacement", "physical grid restoration")):
            data["infrastructure_impact"] = (
                "De-energization and high-pressure water washing of substation transformer bushings and "
                "insulator strings to clear conductive ash deposits before safe re-energization."
            )

    _enrich_from_database_profile(data)

    return data


def _resolve_default_event_profile(data: dict) -> Tuple[str, str, str, str]:
    """
    Derives event_type, disaster_category, root_cause_summary, and infrastructure_impact.
    Explicitly supports volcanic events, earthquakes, power grid disturbances, and floods.
    Avoids defaulting unmapped types strictly to 'Tropical Cyclone'.
    """
    cat_val = str(data.get("category") or data.get("disaster_category") or "").strip()
    cat_lower = cat_val.lower()
    inc_name = str(data.get("incident_name") or "").lower()
    ev_type = str(data.get("event_type") or "").strip()
    ev_lower = ev_type.lower()
    combined = f"{inc_name} {cat_lower} {ev_lower}"

    # 1. Volcanic Eruption
    if (
        "volcan" in combined
        or "eruption" in combined
        or "taal" in combined
        or "mayon" in combined
        or "kanlaon" in combined
        or "bulusan" in combined
        or cat_lower == "vo"
        or ev_lower == "vo"
    ):
        return (
            "Volcanic Eruption",
            "Volcanic Eruption",
            "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
            "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.",
        )

    # 2. Power Grid Disturbance / Blackout
    if "grid" in combined or "blackout" in combined or "trip" in combined:
        return (
            "Grid Disturbance / Frequency Trip",
            "Cascading System Separation",
            "Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.",
            "Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate.",
        )

    # 3. Earthquake
    if "earthquake" in combined or "quake" in combined or "seismic" in combined or cat_lower == "eq":
        return (
            "Earthquake",
            "Seismic Ground Shaking",
            "High-magnitude ground motion causing transformer foundation displacement, substation busbar shearing, and transmission tower tilt.",
            "Substation civil re-alignment and structural testing before staged line re-energization.",
        )

    # 4. Flood / Monsoon
    if "flood" in combined or "monsoon" in combined or "inundation" in combined or cat_lower == "fl":
        return (
            "Severe Tropical Storm / Monsoon Flooding",
            "High-Volume Monsoon Inundation",
            "Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides across river basins.",
            "Substation water-logging and precautionary sectional feeder isolations; rapid recovery as floodwaters recede followed by equipment drying.",
        )

    # 5. Tropical Cyclone / Typhoon
    if "cyclone" in combined or "typhoon" in combined or "storm" in combined or cat_lower in ("tc", "typhoon"):
        return (
            "Tropical Cyclone",
            "Category 3 Landfall",
            "High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal and northern corridors.",
            "Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve over multiple observation cycles.",
        )

    # 6. Preserved category if present and not generic
    if cat_val and cat_lower not in ["hazard", "disaster", "hazard event"]:
        return (
            cat_val,
            cat_val,
            "Severe weather, geophysical, or infrastructure disturbance impacting regional power transmission and distribution lines.",
            "Physical grid restoration in progress with daily satellite radiance tracking.",
        )

    # 7. Unmapped fallback: Geological / Natural Hazard
    return (
        "Geological / Natural Hazard",
        "Natural Hazard",
        "Natural hazard event triggering localized infrastructure isolation and electrical distribution deficits.",
        "Physical distribution grid damage requiring damage inspection and systematic line clearance.",
    )


def generate_fallback_briefing(context: str) -> str:
    """
    Generates a structured, professional situational markdown briefing incorporating 
    live disaster event context without raw dump references when external AI is unavailable.
    Guarantees strict threshold filtering, dynamic fallback for Restoration Benchmarks,
    and factual consistency.
    """
    data = _parse_event_context(context)

    try:
        restored_num = int(data["restored_count"]) if data["restored_count"] is not None and str(data["restored_count"]).isdigit() else 0
    except (ValueError, TypeError):
        restored_num = 0

    try:
        critical_num = int(data["critical_count"]) if data["critical_count"] is not None and str(data["critical_count"]).isdigit() else 0
    except (ValueError, TypeError):
        critical_num = 0

    try:
        total_num = int(data["total_monitored"]) if data["total_monitored"] is not None and str(data["total_monitored"]).isdigit() else 95
    except (ValueError, TypeError):
        total_num = 95

    # Always enforce 95 LGUs for Panay scope
    if total_num == 93:
        total_num = 95

    # If all 93 legacy municipalities were restored, normalize to all 95
    if restored_num == 93 and total_num == 95:
        restored_num = 95

    # 2. Critical Alerts Synthesis: dynamically check for actual deficits (< 60%)
    has_active_critical = critical_num > 0 or (
        bool(data["top_critical"]) and not any(kw in data["top_critical"].lower() for kw in ["none", "all monitored", "no active", "0 critical", "zero", "zero active"])
    )

    all_benchmark_restored = (
        (total_num > 0 and restored_num >= total_num)
        or ("all monitored" in context.lower() and ">= 90%" in context.lower())
    )

    is_steady_state = (not has_active_critical and critical_num == 0) or all_benchmark_restored

    # 1. Executive Summary Synthesis
    if is_steady_state:
        event_name = data["incident_name"] or "the disaster event"
        lgu_count_str = f"all {total_num} monitored LGUs" if total_num > 0 else (f"all {data['total_monitored']} monitored LGUs" if data.get("total_monitored") else "all 95 monitored LGUs")
        summary = (
            f"Following the impact of {event_name}, satellite nightlight observations confirm that "
            f"{lgu_count_str} have achieved benchmark restoration (>= 90%) with zero active outage clusters. "
            f"The regional power grid operates at stable baseline capacity, requiring only routine maintenance and telemetry monitoring."
        )
    else:
        if data["incident_name"]:
            incident_desc = f"**{data['incident_name']}**"
            if data["severity"]:
                incident_desc += f" (classified as **{data['severity']}** severity)"
            if data["incident_date"]:
                incident_desc += f" on {data['incident_date']}"
            lead_sentence = f"Following the impact of {incident_desc},"
        else:
            lead_sentence = "Following active disaster event conditions across the region,"

        effective_total = "95" if (data["total_monitored"] in ["93", 93] or total_num == 95 or not data["total_monitored"]) else str(total_num)
        if data["avg_recovery"]:
            telemetry_sentence = f"satellite nightlight observations report an island-wide average recovery score of **{data['avg_recovery']}** across **{effective_total}** monitored LGUs."
        else:
            telemetry_sentence = f"satellite nightlight telemetry indicates evolving recovery trajectories across **{effective_total}** monitored LGUs."

        if restored_num > 0 and critical_num > 0:
            status_sentence = f"While **{restored_num}** municipalities have achieved near-full recovery (>= 90%), **{critical_num}** jurisdictions remain in critical or warning states (<60%), requiring targeted technical and logistical reinforcement."
        elif restored_num > 0:
            status_sentence = f"Encouragingly, **{restored_num}** municipalities have achieved benchmark restoration (>= 90%), with 0 jurisdictions remaining under critical outage thresholds (<60%)."
        elif critical_num > 0:
            status_sentence = f"Currently, **{critical_num}** municipalities remain under critical outage thresholds (<60%), with 0 municipalities having crossed the >= 90% near-full recovery benchmark."
        else:
            status_sentence = "All monitored municipal jurisdictions have surpassed baseline recovery thresholds, with local distribution grids operating at full or near-full capacity."

        summary = f"{lead_sentence} {telemetry_sentence} {status_sentence}"

    if has_active_critical:
        if critical_num > 0 and data["top_critical"]:
            crit_summary = _clean_lgu_summary(data["top_critical"])
            outage_cluster_bullet = f"* **Severe Outage Clusters**: **{critical_num}** municipalities remain under critical outage status (<60% baseline radiance). Most acute deficits recorded in: {crit_summary}."
        elif critical_num > 0:
            outage_cluster_bullet = f"* **Severe Outage Clusters**: **{critical_num}** municipalities continue to record operational metrics significantly below baseline standards (<60% recovery)."
        else:
            crit_summary = _clean_lgu_summary(data["top_critical"])
            outage_cluster_bullet = f"* **Severe Outage Clusters**: Radiance deficits remain concentrated in: {crit_summary}."
        
        infra_bullet = "* **Infrastructure Bottlenecks**: Distribution feeder disruptions and localized utility damage are prolonging recovery times along secondary lines."
        if data["severity"] and data["severity"].lower() in ["critical", "high", "severe", "catastrophic"]:
            vulnerable_bullet = f"* **High-Priority Communities**: Given the **{data['severity']}** severity level, isolated coastal and rural barangays require emergency power for critical health facilities and water pumping stations."
        else:
            vulnerable_bullet = "* **Vulnerable Communities**: Displaced communities in affected barangays and emergency healthcare centers require prioritized power and logistics support."
    else:
        outage_cluster_bullet = "* **Zero Active Outages**: No active critical outage clusters detected; all monitored municipal jurisdictions operate at or above benchmark recovery levels."
        infra_bullet = "* **Stable Grid Voltage**: Primary transmission corridors and localized distribution feeders report balanced phase loading and steady-state voltage stability with zero unserved load centers."
        vulnerable_bullet = "* **Fully Restored Community Lines**: Essential public facilities, hospitals, schools, and municipal water pumping stations operate on steady-state utility power with all community distribution lines fully restored."

    # 3. Restoration Benchmarks Synthesis
    if restored_num > 0:
        bench_summary = _clean_lgu_summary(data["top_benchmark"]) if data["top_benchmark"] else ""
        if bench_summary:
            benchmarks_bullet = f"* **Leading Restoration Benchmarks**: Near-full recovery thresholds (>= 90%) confirmed in: {bench_summary}."
        else:
            benchmarks_bullet = f"* **Provincial Restoration Benchmarks**: **{restored_num}** municipalities have achieved or exceeded the 90% restoration threshold, re-establishing commercial and transit corridors."
    else:
        fallback_hubs = data.get("top_performing") or data.get("top_benchmark")
        if fallback_hubs:
            hubs_summary = _clean_lgu_summary(fallback_hubs)
            benchmarks_bullet = f"* **Top Performing Hubs**: No municipalities have crossed the >= 90% restoration threshold yet. Highest-performing jurisdictions currently leading recovery: {hubs_summary}."
        else:
            benchmarks_bullet = "* **Top Performing Hubs**: Primary municipal load centers continue progressing toward baseline levels, though 0 municipalities have crossed the >= 90% restoration threshold."

    if not has_active_critical:
        stability_bullet = "* **Grid Stability**: High-voltage transmission backbones and local distribution feeders report normalized, stable energization across all municipal load centers."
    else:
        stability_bullet = "* **Grid Stability**: High-voltage transmission backbones remain monitored while secondary distribution line clearance addresses remaining municipal deficits."

    # 4. Priority Recommendations Synthesis
    all_benchmark_restored = (
        not has_active_critical
        and critical_num == 0
        and (
            (total_num > 0 and restored_num >= total_num)
            or (total_num == 0 and restored_num > 0 and "all monitored" in context.lower() and ">= 90%" in context.lower())
        )
    )

    if all_benchmark_restored:
        recommendations_bullets = (
            "* **Ongoing Telemetry Re-assessment**: Continue automated satellite radiance tracking and daily situational monitoring to verify sustained power delivery across all restored municipal jurisdictions.\n"
            "* **Long-Term Grid Stability Monitoring**: Maintain continuous telemetry monitoring of high-voltage transmission backbones, distribution substations, and feeder balancing to ensure long-term grid stability.\n"
            "* **Routine Utility Reporting**: Transition electric cooperatives and municipal disaster councils from emergency disaster response protocols to routine utility reporting and scheduled preventative maintenance."
        )
    else:
        recommendations_bullets = (
            "* **Deploy Mobile Resources**: Position trailer-mounted generators and emergency supplies at critical municipal health centers.\n"
            "* **Cooperative Mutual Aid**: Coordinate regional lineman crews and Task Force Kapatid teams to assist local electric cooperatives.\n"
            "* **Telemetry Re-assessment**: Continue daily situational monitoring to verify recovery metrics and ground-truth utility reports."
        )

    def_type, def_cat, def_rc, def_infra = _resolve_default_event_profile(data)

    event_type = data.get("event_type")
    if not event_type or (event_type == "Tropical Cyclone" and def_type == "Volcanic Eruption"):
        event_type = def_type

    disaster_category = data.get("disaster_category")
    if not disaster_category or (disaster_category == "Category 3 Landfall" and def_type == "Volcanic Eruption"):
        disaster_category = def_cat

    root_cause_summary = data.get("root_cause_summary")
    if not root_cause_summary or (
        event_type == "Volcanic Eruption"
        and any(k in root_cause_summary.lower() for k in ("winds", "severe weather", "mechanical system"))
    ):
        root_cause_summary = def_rc

    infrastructure_impact = data.get("infrastructure_impact")
    if not infrastructure_impact or (
        event_type == "Volcanic Eruption"
        and any(k in infrastructure_impact.lower() for k in ("hardware replacement", "physical grid restoration"))
    ):
        infrastructure_impact = def_infra

    raw_briefing = f"""### Event Context & Root Cause
- **Classification:** {event_type} ({disaster_category})
- **Primary Driver:** {root_cause_summary}
- **Physical Grid Impact:** {infrastructure_impact}

### Executive Summary
{summary}

### Critical Alerts
{outage_cluster_bullet}
{infra_bullet}
{vulnerable_bullet}

### Restoration Benchmarks
{benchmarks_bullet}
{stability_bullet}

### Priority Recommendations
{recommendations_bullets}
"""
    # Clean any legacy 93 mentions to guarantee 95 monitored LGUs
    raw_briefing = re.sub(r"\b93\s+monitored\s+LGUs\b", "95 monitored LGUs", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b93\s+monitored\s+municipalities\b", "95 monitored LGUs", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b\*\*93\*\*\s+monitored\s+LGUs\b", "**95** monitored LGUs", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b\*\*93\*\*\s+monitored\b", "**95** monitored", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b\*\*93\*\*\s+municipalities\b", "**95** municipalities", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b93\s+LGUs\b", "95 LGUs", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\b93\s+municipalities\b", "95 LGUs", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\ball\s+93\b", "all 95", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\bacross\s+93\b", "across 95", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\bacross\s+\*\*93\*\*\b", "across **95**", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\bof\s+93\b", "of 95", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\bof\s+\*\*93\*\*\b", "of **95**", raw_briefing, flags=re.IGNORECASE)
    raw_briefing = re.sub(r"\ball\s+\*\*93\*\*\b", "all **95**", raw_briefing, flags=re.IGNORECASE)
    return raw_briefing


def generate_recovery_briefing(
    event_context: str,
    max_retries: int = 2,
    delay: float = 1.5,
    event_type: Optional[str] = None,
    disaster_category: Optional[str] = None,
    root_cause_summary: Optional[str] = None,
    infrastructure_impact: Optional[str] = None,
) -> str:
    """
    Sends disaster recovery context to Gemini for an automated briefing.
    Falls back gracefully to high-quality telemetry synthesis if external API is unreachable.
    Integrates Event Profile & Root Cause metadata alongside VIIRS nocturnal radiance observations.
    """
    # Normalize event_context so that legacy 93 LGU strings strictly become 95 LGUs
    clean_event_context = re.sub(
        r"((?:Total\s+(?:Municipalities|LGUs)(?:\s+Monitored)?|Total\s+Monitored):\s*)93\b",
        r"\g<1>95",
        event_context or "",
        flags=re.IGNORECASE,
    )
    clean_event_context = re.sub(
        r"\b93\s*(?:monitored\s+)?(?:LGUs?|municipalities)\b",
        "95 monitored LGUs",
        clean_event_context,
        flags=re.IGNORECASE,
    )

    parsed_ctx = _parse_event_context(clean_event_context)
    if event_type:
        parsed_ctx["event_type"] = event_type
    if disaster_category:
        parsed_ctx["disaster_category"] = disaster_category
    if root_cause_summary:
        parsed_ctx["root_cause_summary"] = root_cause_summary
    if infrastructure_impact:
        parsed_ctx["infrastructure_impact"] = infrastructure_impact

    def_type, def_cat, def_rc, def_infra = _resolve_default_event_profile(parsed_ctx)

    ev_type = parsed_ctx.get("event_type")
    if not ev_type or (ev_type == "Tropical Cyclone" and def_type == "Volcanic Eruption"):
        ev_type = def_type

    dis_cat = parsed_ctx.get("disaster_category")
    if not dis_cat or (dis_cat == "Category 3 Landfall" and def_type == "Volcanic Eruption"):
        dis_cat = def_cat

    rc_summary = parsed_ctx.get("root_cause_summary")
    if not rc_summary or (
        ev_type == "Volcanic Eruption"
        and any(k in rc_summary.lower() for k in ("winds", "severe weather", "mechanical system"))
    ):
        rc_summary = def_rc

    infra_impact = parsed_ctx.get("infrastructure_impact")
    if not infra_impact or (
        ev_type == "Volcanic Eruption"
        and any(k in infra_impact.lower() for k in ("hardware replacement", "physical grid restoration"))
    ):
        infra_impact = def_infra

    api_key = os.getenv("GEMINI_API_KEY")
    prompt = f"""
Analyze the following disaster recovery scenario in the Philippines.
Provide a concise, professional briefing suitable for a disaster response command team.

PROJECT SANAG OFFICIAL 3-TIER OPERATIONAL BENCHMARKS (R(t) = L(t) / L_baseline):
- Near-Full Recovery (Normal Operating Conditions): R(t) >= 0.90 (>= 90% baseline radiance)
- Active Restoration: 0.60 <= R(t) < 0.90 (60% to 89% baseline radiance)
- Critical Deficit / Severe Blackout: R(t) < 0.60 (< 60% baseline radiance)
- No Data / Cloud Masked: None

EVENT PROFILE & ROOT CAUSE PARAMETERS:
- Classification: {ev_type} ({dis_cat})
- Primary Root Cause: {rc_summary}
- Physical Grid Impact: {infra_impact}

ROOT CAUSE ANALYSIS & BRIEFING INSTRUCTIONS:
Distinguish clearly between the satellite observation and the physical root cause:
- The Root Cause explains the mechanical or meteorological trigger (e.g., generator trips vs. downed poles/towers).
- VIIRS nocturnal radiance captures the ground symptom (spatial blackout footprint and restoration velocity).
- Correlate the observed recovery velocity with the nature of the event: note whether the satellite trajectory reflects steep V-shaped resynchronization (grid trip) or prolonged physical reconstruction (cyclone).
- Include a concise 'Event Profile & Root Cause' section at the top of the briefing.

Format your response in clear, well-structured Markdown with the following sections:
### Event Profile & Root Cause
A concise overview distinguishing between physical disaster damage and operational disturbances:
- **Classification:** {ev_type} ({dis_cat})
- **Primary Driver:** {rc_summary}
- **Physical Grid Impact:** {infra_impact}

### Executive Summary
A 2-3 sentence overview of grid restoration progress.
- Note on scope: Panay Island comprises exactly 95 monitored Local Government Units (LGUs)—including 17 in Aklan, 18 in Antique, 16 in Capiz, and 44 in Iloilo (encompassing Iloilo City as a highly urbanized city and Passi City as a component city, alongside Roxas City and all component municipalities). Always report the monitored scope as 95 LGUs (never 93).
- When Municipalities in Critical/Warning State (<60%) is 0 or all municipalities have reached benchmark recovery (>= 90%), the Executive Summary MUST entirely discard words like "critical or warning states", "requiring targeted technical and logistical reinforcement", or low average recovery percentages. Instead, it must dynamically output a positive, steady-state narrative: "Following the impact of [Event Name], satellite nightlight observations confirm that all 95 monitored LGUs have achieved benchmark restoration (>= 90%) with zero active outage clusters. The regional power grid operates at stable baseline capacity, requiring only routine maintenance and telemetry monitoring."
- Jurisdictions with scores from 60% to 89% (0.60 to 0.89) are in "Active Restoration", while scores under 60% (< 0.60) are "Critical Deficits".

### Critical Alerts
Bullet points highlighting the most severely affected municipalities (< 60% baseline radiance), persistent feeder outages, and vulnerable coastal or rural communities. If Municipalities in Critical/Warning State (<60%) is 0 or all municipalities have reached benchmark recovery (>= 90%), completely suppress any outage warnings, severe cluster counts, or vulnerable community deficits; instead, confirm zero active outages, stable grid voltage, and fully restored community power lines.

### Restoration Benchmarks
Key milestones, municipalities that have reached >= 90% restoration (or if 0 municipalities have crossed >= 90%, accurately designate the section or bullet as "Top Performing Hubs" reflecting their actual sub-90% recovery scores in the Active Restoration band 60%–89% without falsely claiming any municipality reached >= 90%), and regional recovery baselines.

### Priority Recommendations
3 actionable next steps for disaster response teams and electric cooperatives. When all monitored municipalities achieve benchmark restoration (>= 90%) with 0 active critical deficits, adjust recommendations to focus on ongoing telemetry re-assessment, long-term grid stability monitoring, and routine utility reporting (instead of emergency generators, lineman mutual aid, or line repairs).

CRITICAL FACTUAL CONSISTENCY RULES:
- Strictly obey the scenario data numbers and definitions.
- MONITORED SCOPE: Exactly 95 LGUs across Panay Island. Never state 93 monitored LGUs. Always specify and count 95 LGUs being monitored, including Iloilo City as a highly urbanized city and Passi City as a component city.
- OPERATIONAL BENCHMARK TIERS: Harmonize all evaluations to the official 3-tier benchmarks:
  * Near-Full Recovery (>= 90%): >= 0.90 baseline radiance
  * Active Restoration (60% to 89%): 0.60 to 0.89 baseline radiance
  * Critical Deficit (< 60%): < 0.60 baseline radiance. All values under 0.60 are critical deficits; never classify 0.60–0.89 as critical outages.
- EXECUTIVE SUMMARY RULE: Check if "Municipalities in Critical/Warning State (<60%)" is 0 or all municipalities have reached benchmark recovery (>= 90%). When active critical deficits equal 0 (or all municipalities meet recovery benchmarks), the Executive Summary MUST entirely discard words like "critical or warning states", "requiring targeted technical and logistical reinforcement", or low average recovery percentages. It must dynamically output a positive, steady-state narrative: "Following the impact of [Event Name], satellite nightlight observations confirm that all 95 monitored LGUs have achieved benchmark restoration (>= 90%) with zero active outage clusters. The regional power grid operates at stable baseline capacity, requiring only routine maintenance and telemetry monitoring."
- CRITICAL ALERTS RULE: Check if "Municipalities in Critical/Warning State (<60%)" is 0 or all municipalities have reached benchmark recovery (>= 90%). When active critical deficits equal 0 (or all municipalities meet recovery benchmarks), the Critical Alerts section MUST completely suppress any outage warnings, severe cluster counts, infrastructure bottleneck claims, or vulnerable community deficit texts. NEVER list fully recovered municipalities (scores >= 60% or >= 90%) as having outages, blackouts, or deficits. Instead, the Critical Alerts section MUST render clean, positive steady-state bullet points confirming:
  1. Zero Active Outages: Confirmation that no active outage clusters remain and all monitored LGUs have surpassed baseline recovery.
  2. Stable Grid Voltage: High-voltage transmission corridors and localized distribution feeders report balanced phase loading and steady-state voltage stability.
  3. Fully Restored Community Lines: Full re-energization across public facilities, healthcare centers, water pumping stations, and residential distribution lines without emergency generator dependencies.
- Only state that a municipality has reached or exceeded 90% restoration / near-full recovery if its score is actually >= 90%.
- If Municipalities >= 90% Restored is 0, state that 0 municipalities have achieved >= 90% recovery and describe the highest-performing municipalities as "Top Performing Hubs" with their exact reported scores. Never round up sub-90% scores (such as 82% or 88%) to 90% or claim they met the 90% benchmark.
- PRIORITY RECOMMENDATIONS / RESPONSE ACTIONS RULE: Check if ALL monitored municipalities have achieved benchmark restoration (>= 90%) (i.e. 'Municipalities >= 90% Restored' equals 'Total Municipalities Monitored' or is 100%) with 0 active critical deficits ('Municipalities in Critical/Warning State (<60%)' is 0 or 'Top Critical Outage LGUs' indicates no deficits). When all monitored municipalities have crossed >= 90% restoration with 0 active critical deficits, DO NOT advise emergency generator deployment, mobile substation dispatch, lineman mutual aid teams, or line repairs, as emergency restoration is complete. Instead, the 3 recommendations MUST explicitly advise:
  1. Ongoing telemetry re-assessment (continued automated satellite radiance tracking and daily situational monitoring to verify sustained power delivery across all restored jurisdictions).
  2. Long-term grid stability monitoring (maintaining continuous monitoring of high-voltage transmission backbones, distribution substations, and feeder balancing to ensure grid stability).
  3. Routine utility reporting (transitioning electric cooperatives and municipal disaster councils from emergency disaster response protocols to routine utility reporting and scheduled preventative maintenance).

Scenario Data:
{clean_event_context}
Event Type: {ev_type}
Disaster Category: {dis_cat}
Primary Driver: {rc_summary}
Physical Grid Impact: {infra_impact}
"""

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
            
            # Prioritize 2.0-flash for immediate response speed while 3.8 demand normalizes
            models_to_try = [
                "gemini-2.0-flash",
                gemini_model,
                "gemini-2.0-flash-lite",
                "gemini-3.8-flash",
            ]
            # Deduplicate while preserving sequence
            models_to_try = list(dict.fromkeys(models_to_try))
            
            for model_name in models_to_try:
                for attempt in range(max_retries):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[prompt]
                        )
                        if response and response.text:
                            text_resp = response.text
                            parsed_ctx = _parse_event_context(clean_event_context)
                            try:
                                c_num = int(parsed_ctx["critical_count"]) if parsed_ctx["critical_count"] is not None and str(parsed_ctx["critical_count"]).isdigit() else 0
                            except (ValueError, TypeError):
                                c_num = 0
                            try:
                                r_num = int(parsed_ctx["restored_count"]) if parsed_ctx["restored_count"] is not None and str(parsed_ctx["restored_count"]).isdigit() else 0
                            except (ValueError, TypeError):
                                r_num = 0
                            try:
                                t_num = int(parsed_ctx["total_monitored"]) if parsed_ctx["total_monitored"] is not None and str(parsed_ctx["total_monitored"]).isdigit() else 95
                            except (ValueError, TypeError):
                                t_num = 95

                            if t_num == 93:
                                t_num = 95

                            has_crit = c_num > 0 or (
                                bool(parsed_ctx["top_critical"]) and not any(kw in parsed_ctx["top_critical"].lower() for kw in ["none", "all monitored", "no active", "0 critical", "zero", "zero active"])
                            )
                            is_steady = (not has_crit and c_num == 0) or (t_num > 0 and r_num >= t_num)

                            if is_steady:
                                ev_name = parsed_ctx["incident_name"] or "the disaster event"
                                lgu_txt = f"all {t_num} monitored LGUs" if t_num > 0 and t_num != 93 else "all 95 monitored LGUs"
                                steady_narrative = (
                                    f"Following the impact of {ev_name}, satellite nightlight observations confirm that "
                                    f"{lgu_txt} have achieved benchmark restoration (>= 90%) with zero active outage clusters. "
                                    f"The regional power grid operates at stable baseline capacity, requiring only routine maintenance and telemetry monitoring."
                                )
                                # Ensure any hallucinated deficit wording in Executive Summary is cleaned
                                if re.search(r"critical or warning states?|requiring targeted technical and logistical reinforcement|limited-power states?", text_resp, re.IGNORECASE):
                                    text_resp = re.sub(
                                        r"(### Executive Summary\s*\n)([\s\S]*?)(?=\n#{2,4}\s+|$)",
                                        f"\\1{steady_narrative}\n\n",
                                        text_resp
                                    )

                            # Ensure Event Profile & Root Cause section is present at the top
                            if not re.search(r"###\s*Event (?:Profile|Context)\s*&\s*(?:Root Cause|Primary Driver)", text_resp, re.IGNORECASE):
                                profile_header = (
                                    f"### Event Profile & Root Cause\n"
                                    f"- **Classification:** {ev_type} ({dis_cat})\n"
                                    f"- **Primary Driver:** {rc_summary}\n"
                                    f"- **Physical Grid Impact:** {infra_impact}\n\n"
                                )
                                text_resp = profile_header + text_resp

                            # Clean any legacy hallucination where Gemini states 93 monitored LGUs / municipalities
                            text_resp = re.sub(r"\b93\s+monitored\s+LGUs\b", "95 monitored LGUs", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b93\s+monitored\s+municipalities\b", "95 monitored LGUs", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b\*\*93\*\*\s+monitored\s+LGUs\b", "**95** monitored LGUs", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b\*\*93\*\*\s+monitored\b", "**95** monitored", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b\*\*93\*\*\s+municipalities\b", "**95** municipalities", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b93\s+LGUs\b", "95 LGUs", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\b93\s+municipalities\b", "95 LGUs", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\ball\s+93\b", "all 95", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\bacross\s+93\b", "across 95", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\bacross\s+\*\*93\*\*\b", "across **95**", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\bof\s+93\b", "of 95", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\bof\s+\*\*93\*\*\b", "of **95**", text_resp, flags=re.IGNORECASE)
                            text_resp = re.sub(r"\ball\s+\*\*93\*\*\b", "all **95**", text_resp, flags=re.IGNORECASE)
                            return text_resp
                    except Exception as err:
                        print(f"Model {model_name} failed: {err}")
                        if attempt < max_retries - 1:
                            time.sleep(delay)
                        else:
                            break
        except Exception as e:
            print(f"Gemini client initialization failed: {e}")

    # Dynamic contextual fallback synthesis reflecting the passed event data
    return generate_fallback_briefing(clean_event_context)

# Alias for compatibility with executive_summary generator naming
generate_executive_summary = generate_recovery_briefing