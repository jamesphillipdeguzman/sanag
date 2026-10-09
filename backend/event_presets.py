import json
import os
from typing import List, Dict, Any, Optional

PRESETS_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "event_presets.json")

PANAY_EVENT_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "typhoon-kalmaegi-2025",
        "name": "Typhoon Kalmaegi (Tino)",
        "startDate": "2025-11-03",
        "endDate": "2025-12-03",
        "type": "typhoon",
        "severity": "High",
        "affected_population": 1220000,
        "description": "Late-season typhoon causing gale-force wind damage and flash floods across coastal Antique and Aklan.",
        "category": "Typhoon",
        "event_type": "Tropical Cyclone",
        "disaster_category": "Category 3 Landfall",
        "root_cause_summary": "High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal and northern corridors.",
        "infrastructure_impact": "Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve over multiple observation cycles."
    },
    {
        "id": "sts-trami-2024",
        "name": "Severe Tropical Storm Trami (Kristine)",
        "startDate": "2024-10-22",
        "endDate": "2024-11-22",
        "type": "monsoon_flood",
        "severity": "High",
        "affected_population": 1350000,
        "description": "Broad circulation severe tropical storm bringing unprecedented continuous precipitation and submerged transmission substations.",
        "category": "Flood",
        "event_type": "Severe Tropical Storm",
        "disaster_category": "High-Volume Monsoon Inundation",
        "root_cause_summary": "Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides across river basins.",
        "infrastructure_impact": "Substation water-logging and precautionary sectional feeder isolations; rapid recovery as floodwaters recede followed by equipment drying."
    },
    {
        "id": "habagat-carina-2024",
        "name": "Southwest Monsoon / Gaemi Floods",
        "startDate": "2024-07-24",
        "endDate": "2024-08-24",
        "type": "monsoon_flood",
        "severity": "Moderate",
        "affected_population": 980000,
        "description": "Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.",
        "category": "Flood",
        "event_type": "Southwest Monsoon / Tropical Cyclone",
        "disaster_category": "Monsoon Flooding & Landslide",
        "root_cause_summary": "Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.",
        "infrastructure_impact": "Localized feeder trips and pole destabilization in saturated soils; moderate recovery timeline."
    },
    {
        "id": "panay-grid-collapse-2024",
        "name": "Panay Island Grid Collapse",
        "startDate": "2024-01-02",
        "endDate": "2024-02-01",
        "type": "grid_failure",
        "severity": "Severe",
        "affected_population": 4500000,
        "description": "Cascading power plant shutdowns and transmission line trips leading to a total island-wide blackout across all Panay and Guimaras LGUs.",
        "category": "Power Disruption",
        "event_type": "Grid Disturbance / Frequency Trip",
        "disaster_category": "Cascading System Separation",
        "root_cause_summary": "Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.",
        "infrastructure_impact": "Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate."
    },
    {
        "id": "panay-blackout-2024",
        "name": "Panay Island Grid Collapse (January 2024)",
        "startDate": "2024-01-02",
        "endDate": "2024-02-01",
        "type": "grid_failure",
        "severity": "Severe",
        "affected_population": 4500000,
        "description": "Cascading power plant shutdowns and transmission line trips leading to a total island-wide blackout across all Panay and Guimaras LGUs.",
        "category": "Power Disruption",
        "event_type": "Grid Disturbance / Frequency Trip",
        "disaster_category": "Cascading System Separation",
        "root_cause_summary": "Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.",
        "infrastructure_impact": "Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate."
    },
    {
        "id": "sts-nalgae-2022",
        "name": "Severe Tropical Storm Nalgae (Paeng)",
        "startDate": "2022-10-28",
        "endDate": "2022-11-28",
        "type": "monsoon_flood",
        "severity": "High",
        "affected_population": 1580000,
        "description": "Severe Tropical Storm Nalgae brought immense rainbands causing widespread riverine flooding and bridge washouts across Western Visayas.",
        "category": "Flood",
        "event_type": "Severe Tropical Storm",
        "disaster_category": "Flash Flooding & Mudslides",
        "root_cause_summary": "Stationary rainbands causing riverine surges, washed out bridge distribution conduits, and mudslide damage to transmission towers.",
        "infrastructure_impact": "Physical feeder breaks and severed bridge crossings requiring line re-routing and bypass installation."
    },
    {
        "id": "ts-megi-2022",
        "name": "Tropical Storm Megi (Agaton)",
        "startDate": "2022-04-10",
        "endDate": "2022-05-10",
        "type": "monsoon_flood",
        "severity": "High",
        "affected_population": 1120000,
        "description": "Stationary tropical storm inducing continuous heavy rains, catastrophic landslides, and severe lowland inundation across Capiz and Iloilo.",
        "category": "Flood",
        "event_type": "Tropical Storm",
        "disaster_category": "Prolonged Lowland Inundation",
        "root_cause_summary": "Slow-moving tropical depression causing persistent torrential rain, flash landslides, and submerged municipal load centers across Capiz.",
        "infrastructure_impact": "Waterlogged pad-mounted distribution transformers and mud deposit clearance across rural distribution lines."
    },
    {
        "id": "typhoon-odette-2021",
        "name": "Super Typhoon Odette (Rai)",
        "startDate": "2021-12-16",
        "endDate": "2022-01-16",
        "type": "typhoon",
        "severity": "Severe",
        "affected_population": 2450000,
        "description": "Super Typhoon Rai (Odette) devastated the Visayas corridor, inflicting major transmission line destruction and month-long restoration.",
        "category": "Typhoon",
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Landfall",
        "root_cause_summary": "Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.",
        "infrastructure_impact": "Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit."
    },
    {
        "id": "typhoon-rai-2021",
        "name": "Typhoon Rai (Odette)",
        "startDate": "2021-12-16",
        "endDate": "2022-01-16",
        "type": "typhoon",
        "severity": "Severe",
        "affected_population": 2450000,
        "description": "Super Typhoon Rai (Odette) devastated the Visayas corridor, inflicting major transmission line destruction and month-long restoration.",
        "category": "Typhoon",
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Landfall",
        "root_cause_summary": "Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.",
        "infrastructure_impact": "Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit."
    },
    {
        "id": "typhoon-molave-2020",
        "name": "Typhoon Molave (Quinta)",
        "startDate": "2020-10-25",
        "endDate": "2020-11-25",
        "type": "typhoon",
        "severity": "Moderate",
        "affected_population": 890000,
        "description": "Fast-moving typhoon triggering coastal storm surges, widespread agricultural flooding, and localized power disruptions.",
        "category": "Typhoon",
        "event_type": "Typhoon",
        "disaster_category": "Category 1 Landfall",
        "root_cause_summary": "High wind gusts causing vegetation contact and fallen distribution lines along coastal highways.",
        "infrastructure_impact": "Moderate distribution pole snapping; quick line-clearing and re-stringing restores power within 48 to 72 hours."
    },
    {
        "id": "typhoon-phanfone-2019",
        "name": "Typhoon Phanfone (Ursula)",
        "startDate": "2019-12-25",
        "endDate": "2020-01-25",
        "type": "typhoon",
        "severity": "High",
        "affected_population": 1680000,
        "description": "Holiday typhoon causing widespread destructive winds, power pole collapses, and prolonged blackouts across Northern Panay.",
        "category": "Typhoon",
        "event_type": "Typhoon",
        "disaster_category": "Category 2 Landfall",
        "root_cause_summary": "Violent holiday eye-wall transit across Northern Panay causing widespread snapped concrete distribution poles and downed conductor cables.",
        "infrastructure_impact": "Extensive physical grid destruction across Aklan and Northern Capiz requiring heavy inter-cooperative lineman assistance."
    },
    {
        "id": "typhoon-hagupit-2014",
        "name": "Typhoon Hagupit (Ruby)",
        "startDate": "2014-12-06",
        "endDate": "2015-01-05",
        "type": "typhoon",
        "severity": "High",
        "affected_population": 1450000,
        "description": "Powerful typhoon bringing torrential rainfall, high winds, and severe power outages across Panay and Eastern Visayas.",
        "category": "Typhoon",
        "event_type": "Typhoon",
        "disaster_category": "Category 3 Landfall",
        "root_cause_summary": "Gale-force wind gusts and storm surges damaging coastal substations and distribution backbones.",
        "infrastructure_impact": "Structural distribution pole damage and salt spray insulator flashovers along coastal feeder corridors."
    },
    {
        "id": "typhoon-haiyan-2013",
        "name": "Super Typhoon Haiyan (Yolanda)",
        "startDate": "2013-11-08",
        "endDate": "2013-12-08",
        "type": "typhoon",
        "severity": "Severe",
        "affected_population": 4200000,
        "description": "Catastrophic Category 5 super typhoon crossing the Visayas region with unprecedented storm surge and widespread grid destruction.",
        "category": "Typhoon",
        "latitude": 11.1000,
        "longitude": 125.3000,
        "coordinates": [11.1000, 125.3000],
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Super Typhoon",
        "root_cause_summary": "Unprecedented 315 km/h sustained winds and catastrophic storm surge destroying entire transmission line backbones across Eastern and Western Visayas.",
        "infrastructure_impact": "Total collapse of high-voltage transmission lines and distribution networks; multi-month physical reconstruction required."
    },
    {
        "id": "taal-volcano-eruption-2020",
        "name": "Taal Volcano Eruption",
        "startDate": "2020-01-12",
        "endDate": "2020-02-12",
        "type": "volcano",
        "severity": "Severe",
        "affected_population": 540000,
        "description": "Phreatomagmatic eruption of Taal Volcano sending ash plumes over Calabarzon and Southern Tagalog, impacting regional distribution lines and transmission substations.",
        "category": "Volcanic Eruption",
        "event_type": "Volcanic Eruption",
        "disaster_category": "Volcanic Eruption",
        "root_cause_summary": "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
        "infrastructure_impact": "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization."
    }
]

def resolve_event_profile(
    event_id: Optional[str] = None,
    disaster_type: Optional[str] = None,
    name: Optional[str] = None,
    category: Optional[str] = None,
) -> Dict[str, str]:
    """
    Standardized event profile and classification resolver.
    Explicitly supports GDACS hazard code 'VO' and category 'volcano' / 'volcanic eruption'.
    Avoids defaulting unmapped types strictly to 'Tropical Cyclone'.
    """
    combined = f"{event_id or ''} {disaster_type or ''} {name or ''} {category or ''}".lower()
    d_type = (disaster_type or "").upper()

    if (
        d_type == "VO"
        or "eruption" in combined
        or "volcan" in combined
        or "taal" in combined
        or "mayon" in combined
        or "kanlaon" in combined
        or "bulusan" in combined
    ):
        return {
            "event_type": "Volcanic Eruption",
            "disaster_category": "Volcanic Eruption",
            "root_cause_summary": "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
            "infrastructure_impact": "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.",
        }

    if d_type == "EQ" or "earthquake" in combined or "quake" in combined or "seismic" in combined:
        return {
            "event_type": "Earthquake",
            "disaster_category": "Seismic Ground Shaking",
            "root_cause_summary": "High-magnitude ground motion causing transformer foundation displacement, substation busbar shearing, and transmission tower tilt.",
            "infrastructure_impact": "Substation civil re-alignment and structural testing before staged line re-energization.",
        }

    if d_type in ("POW", "GRID") or "grid" in combined or "blackout" in combined or "trip" in combined:
        return {
            "event_type": "Grid Disturbance / Frequency Trip",
            "disaster_category": "Cascading System Separation",
            "root_cause_summary": "Unplanned, rapid tripping of multiple base-load generation units leading to island-wide under-frequency cascade tripping.",
            "infrastructure_impact": "Zero structural physical damage to distribution poles or substations; rapid V-shaped recovery curve observed.",
        }

    if d_type == "FL" or "flood" in combined or "inundation" in combined:
        return {
            "event_type": "Severe Tropical Storm / Monsoon Flooding",
            "disaster_category": "High-Volume Monsoon Inundation",
            "root_cause_summary": "Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides.",
            "infrastructure_impact": "Substation water-logging and precautionary sectional feeder isolations; equipment drying required.",
        }

    if d_type == "TC" or "typhoon" in combined or "cyclone" in combined or "storm" in combined:
        return {
            "event_type": "Tropical Cyclone",
            "disaster_category": "Category 3 Landfall",
            "root_cause_summary": "High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal corridors.",
            "infrastructure_impact": "Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve.",
        }

    # Fallback to Geological / Natural Hazard or category if present
    cat_clean = (category or "").strip()
    ev_type = cat_clean if cat_clean and cat_clean.lower() not in ["hazard", "disaster", "hazard event"] else "Geological / Natural Hazard"
    dis_cat = cat_clean if cat_clean else "Natural Hazard"
    return {
        "event_type": ev_type,
        "disaster_category": dis_cat,
        "root_cause_summary": "Natural hazard event triggering localized infrastructure isolation and electrical distribution deficits.",
        "infrastructure_impact": "Physical distribution grid damage requiring damage inspection and systematic line clearance.",
    }


def get_presets() -> List[Dict[str, Any]]:
    """Returns the verified Panay disaster event presets sorted in reverse chronological order (newest first)."""
    presets = PANAY_EVENT_PRESETS
    if os.path.exists(PRESETS_JSON_PATH):
        try:
            with open(PRESETS_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    presets = data
        except Exception:
            pass
    return sorted(presets, key=lambda p: str(p.get("startDate") or p.get("date") or ""), reverse=True)
