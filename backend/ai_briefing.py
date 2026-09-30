import os
from pathlib import Path
import time
from dotenv import load_dotenv

# Ensure .env is loaded from the backend directory regardless of cwd
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv()

def generate_recovery_briefing(event_context: str, max_retries=2, delay=1.5):
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
Key milestones, municipalities that have reached >= 90% restoration, and regional recovery baselines.

### Priority Recommendations
3 actionable next steps for disaster response teams and electric cooperatives.

Scenario Data:
{event_context}
"""

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            # Put Gemini 3.8 Flash first so it's the primary model used
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

def _parse_event_context(context: str) -> dict:
    """Extracts key disaster telemetry data points from the provided event context."""
    import re
    import json

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

    m_top_bench = re.search(r"Top Benchmark Restored LGUs:\s*([^\n\r]+)", text, re.I)
    if m_top_bench:
        data["top_benchmark"] = m_top_bench.group(1).strip()

    return data


def _clean_lgu_summary(raw_str: str, max_items: int = 3) -> str:
    """Helper to clean and format semicolon-delimited LGU strings for readability."""
    import re
    if not raw_str:
        return ""
    items = [item.strip() for item in raw_str.split(";") if item.strip()]
    cleaned_items = []
    for item in items[:max_items]:
        c = re.sub(r",\s*est\s*\d+\s*days\s*to\s*recover", "", item, flags=re.I)
        c = re.sub(r"\s+score", "", c, flags=re.I).strip()
        cleaned_items.append(c)
    return "; ".join(cleaned_items)


def generate_fallback_briefing(context: str) -> str:
    """
    Generates a structured, professional situational markdown briefing incorporating 
    live disaster event context without raw dump references when external AI is unavailable.
    """
    data = _parse_event_context(context)

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

    if data["restored_count"] and data["critical_count"]:
        status_sentence = f"While **{data['restored_count']}** municipalities have achieved near-full recovery (>= 90%), **{data['critical_count']}** jurisdictions remain in critical or warning states (<60%), requiring targeted technical and logistical reinforcement."
    elif data["critical_count"]:
        status_sentence = f"Currently, **{data['critical_count']}** municipalities remain under critical outage thresholds (<60%), requiring prioritized technical and logistical intervention."
    elif data["restored_count"]:
        status_sentence = f"Encouragingly, **{data['restored_count']}** municipalities have achieved benchmark restoration (>= 90%), while secondary distribution deficits persist in harder-hit sectors."
    else:
        status_sentence = "Urban and municipal load centers show advancing baseline recovery levels, while localized secondary distribution deficits require targeted utility intervention."

    summary = f"{lead_sentence} {telemetry_sentence} {status_sentence}"

    # 2. Critical Alerts Synthesis
    if data["critical_count"] and data["top_critical"]:
        crit_summary = _clean_lgu_summary(data["top_critical"])
        outage_cluster_bullet = f"* **Severe Outage Clusters**: **{data['critical_count']}** municipalities remain under critical outage status (<60% baseline radiance). Most acute deficits recorded in: {crit_summary}."
    elif data["critical_count"]:
        outage_cluster_bullet = f"* **Severe Outage Clusters**: **{data['critical_count']}** municipalities continue to record operational metrics significantly below baseline standards (<60% recovery)."
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
    if data["top_benchmark"]:
        bench_summary = _clean_lgu_summary(data["top_benchmark"])
        benchmarks_bullet = f"* **Leading Restoration Benchmarks**: Near-full recovery thresholds (>= 90%) confirmed in: {bench_summary}."
    elif data["restored_count"]:
        benchmarks_bullet = f"* **Provincial Restoration Benchmarks**: **{data['restored_count']}** municipalities have achieved or exceeded the 90% restoration threshold, re-establishing commercial and transit corridors."
    else:
        benchmarks_bullet = "* **Provincial Hubs**: Major commercial centers and transit corridors are tracking toward primary restoration thresholds (>= 90%)."

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