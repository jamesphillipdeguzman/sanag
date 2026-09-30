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
from typing import List, Dict, Any, Optional
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


def _parse_event_context(context: str) -> dict:
    """Extracts key disaster telemetry data points from the provided event context."""
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
    }
    if not context or not isinstance(context, str):
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
                data["total_monitored"] = parsed.get("total_monitored") or parsed.get("total_municipalities")
                data["avg_recovery"] = parsed.get("avg_recovery") or parsed.get("avg_score")
                data["restored_count"] = parsed.get("restored_count") or parsed.get("restored")
                data["critical_count"] = parsed.get("critical_count") or parsed.get("critical")
                data["top_critical"] = parsed.get("top_critical")
                data["top_benchmark"] = parsed.get("top_benchmark")
                data["top_performing"] = parsed.get("top_performing")
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

    m_tot = re.search(r"(?:Total Municipalities Monitored|Total Monitored|Total Municipalities):\s*(\d+)", text, re.I)
    if m_tot:
        data["total_monitored"] = m_tot.group(1).strip()

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

    return data


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

    # 1. Executive Summary Synthesis
    if data["incident_name"]:
        incident_desc = f"**{data['incident_name']}**"
        if data["severity"]:
            incident_desc += f" (classified as **{data['severity']}** severity)"
        if data["incident_date"]:
            incident_desc += f" on {data['incident_date']}"
        lead_sentence = f"Following the impact of {incident_desc},"
    else:
        lead_sentence = "Following active disaster event conditions across the region,"

    if data["avg_recovery"]:
        if data["total_monitored"]:
            telemetry_sentence = f"satellite nightlight observations report an island-wide average recovery score of **{data['avg_recovery']}** across **{data['total_monitored']}** monitored LGUs."
        else:
            telemetry_sentence = f"satellite nightlight observations report an island-wide average recovery score of **{data['avg_recovery']}** across affected jurisdictions."
    else:
        telemetry_sentence = "satellite nightlight telemetry indicates evolving recovery trajectories across monitored municipal jurisdictions."

    if restored_num > 0 and critical_num > 0:
        status_sentence = f"While **{restored_num}** municipalities have achieved near-full recovery (>= 90%), **{critical_num}** jurisdictions remain in critical or warning states (<60%), requiring targeted technical and logistical reinforcement."
    elif restored_num > 0:
        status_sentence = f"Encouragingly, **{restored_num}** municipalities have achieved benchmark restoration (>= 90%), while secondary distribution deficits persist in harder-hit sectors."
    elif critical_num > 0:
        status_sentence = f"Currently, **{critical_num}** municipalities remain under critical outage thresholds (<60%), with 0 municipalities having crossed the >= 90% near-full recovery benchmark."
    else:
        status_sentence = "Urban and municipal load centers show advancing baseline recovery levels, though 0 municipalities have crossed the >= 90% near-full recovery benchmark yet."

    summary = f"{lead_sentence} {telemetry_sentence} {status_sentence}"

    # 2. Critical Alerts Synthesis
    if critical_num > 0 and data["top_critical"]:
        crit_summary = _clean_lgu_summary(data["top_critical"])
        outage_cluster_bullet = f"* **Severe Outage Clusters**: **{critical_num}** municipalities remain under critical outage status (<60% baseline radiance). Most acute deficits recorded in: {crit_summary}."
    elif critical_num > 0:
        outage_cluster_bullet = f"* **Severe Outage Clusters**: **{critical_num}** municipalities continue to record operational metrics significantly below baseline standards (<60% recovery)."
    elif data["top_critical"]:
        crit_summary = _clean_lgu_summary(data["top_critical"])
        outage_cluster_bullet = f"* **Severe Outage Clusters**: Radiance deficits remain concentrated in: {crit_summary}."
    else:
        outage_cluster_bullet = "* **Severe Outage Clusters**: Specific municipalities continue to record operational metrics significantly below baseline standards based on active incident data."

    if data["severity"] and data["severity"].lower() in ["critical", "high", "severe", "catastrophic"]:
        vulnerable_bullet = f"* **High-Priority Communities**: Given the **{data['severity']}** severity level, isolated coastal and rural barangays require emergency power for critical health facilities and water pumping stations."
    else:
        vulnerable_bullet = "* **Vulnerable Communities**: Displaced communities in affected barangays and emergency healthcare centers require prioritized power and logistics support."

    # 3. Restoration Benchmarks Synthesis
    # Strict threshold check: only report >= 90% if restored_num > 0
    if restored_num > 0:
        bench_summary = _clean_lgu_summary(data["top_benchmark"]) if data["top_benchmark"] else ""
        if bench_summary:
            benchmarks_bullet = f"* **Leading Restoration Benchmarks**: Near-full recovery thresholds (>= 90%) confirmed in: {bench_summary}."
        else:
            benchmarks_bullet = f"* **Provincial Restoration Benchmarks**: **{restored_num}** municipalities have achieved or exceeded the 90% restoration threshold, re-establishing commercial and transit corridors."
    else:
        # Dynamic fallback when no municipalities have crossed >= 90%
        fallback_hubs = data.get("top_performing") or data.get("top_benchmark")
        if fallback_hubs:
            hubs_summary = _clean_lgu_summary(fallback_hubs)
            benchmarks_bullet = f"* **Top Performing Hubs**: No municipalities have crossed the >= 90% restoration threshold yet. Highest-performing jurisdictions currently leading recovery: {hubs_summary}."
        else:
            benchmarks_bullet = "* **Top Performing Hubs**: Primary municipal load centers continue progressing toward baseline levels, though 0 municipalities have crossed the >= 90% restoration threshold."

    return f"""### Executive Summary
{summary}

### Critical Alerts
{outage_cluster_bullet}
* **Infrastructure Bottlenecks**: Distribution feeder disruptions and localized utility damage are prolonging recovery times along secondary lines.
{vulnerable_bullet}

### Restoration Benchmarks
{benchmarks_bullet}
* **Grid Stability**: High-voltage transmission backbones remain monitored while secondary distribution line clearance addresses remaining municipal deficits.

### Priority Recommendations
* **Deploy Mobile Resources**: Position trailer-mounted generators and emergency supplies at critical municipal health centers.
* **Cooperative Mutual Aid**: Coordinate regional lineman crews and Task Force Kapatid teams to assist local electric cooperatives.
* **Telemetry Re-assessment**: Continue daily situational monitoring to verify recovery metrics and ground-truth utility reports.
"""


def generate_recovery_briefing(event_context: str, max_retries=2, delay=1.5) -> str:
    """
    Sends disaster recovery context to Gemini for an automated briefing.
    Falls back gracefully to high-quality telemetry synthesis if external API is unreachable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    prompt = f"""
Analyze the following disaster recovery scenario in the Philippines.
Provide a concise, professional briefing suitable for a disaster response command team.

Format your response in clear, well-structured Markdown with the following sections:
### Executive Summary
A 2-3 sentence overview of grid restoration progress, average recovery percentages, affected populations, and general trajectory based on the scenario data.

### Critical Alerts
Bullet points highlighting the most severely affected municipalities, persistent feeder outages, and vulnerable coastal or rural communities.

### Restoration Benchmarks
Key milestones, municipalities that have reached >= 90% restoration (or if 0 municipalities have crossed >= 90%, accurately designate the section or bullet as "Top Performing Hubs" reflecting their actual sub-90% recovery scores without falsely claiming any municipality reached >= 90%), and regional recovery baselines.

### Priority Recommendations
3 actionable next steps for disaster response teams and electric cooperatives.

CRITICAL FACTUAL CONSISTENCY RULES:
- Strictly obey the scenario data numbers and definitions.
- Only state that a municipality has reached or exceeded 90% restoration / near-full recovery if its score is actually >= 90%.
- If Municipalities >= 90% Restored is 0, state that 0 municipalities have achieved >= 90% recovery and describe the highest-performing municipalities as "Top Performing Hubs" with their exact reported scores. Never round up sub-90% scores (such as 82% or 88%) to 90% or claim they met the 90% benchmark.

Scenario Data:
{event_context}
"""

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            models_to_try = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash']
            
            for model_name in models_to_try:
                for attempt in range(max_retries):
                    try:
                        response = client.models.generate_content(
                            model=model_name,
                            contents=[prompt]
                        )
                        if response and response.text:
                            return response.text
                    except Exception as err:
                        print(f"Model {model_name} failed: {err}")
                        if attempt < max_retries - 1:
                            time.sleep(delay)
                        else:
                            break
        except Exception as e:
            print(f"Gemini client initialization failed: {e}")

    # Dynamic contextual fallback synthesis reflecting the passed event data
    return generate_fallback_briefing(event_context)


# Alias for compatibility with executive_summary generator naming
generate_executive_summary = generate_recovery_briefing
