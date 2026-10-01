import json
import os
from typing import List, Dict, Any, Optional

PRESETS_JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "event_presets.json")

PANAY_EVENT_PRESETS: List[Dict[str, Any]] = [
    {
        "id": "typhoon-haiyan-2013",
        "name": "Super Typhoon Haiyan (Yolanda)",
        "startDate": "2013-11-08",
        "endDate": "2013-12-08",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=d_k8wD2R21w",
        "severity": "Severe",
        "affected_population": 4200000,
        "description": "Catastrophic Category 5 super typhoon crossing the Visayas region with unprecedented storm surge and widespread grid destruction.",
        "category": "Typhoon"
    },
    {
        "id": "typhoon-hagupit-2014",
        "name": "Typhoon Hagupit (Ruby)",
        "startDate": "2014-12-06",
        "endDate": "2015-01-05",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=kYQeW38L_9g",
        "severity": "High",
        "affected_population": 1450000,
        "description": "Powerful typhoon bringing torrential rainfall, high winds, and severe power outages across Panay and Eastern Visayas.",
        "category": "Typhoon"
    },
    {
        "id": "typhoon-phanfone-2019",
        "name": "Typhoon Phanfone (Ursula)",
        "startDate": "2019-12-25",
        "endDate": "2020-01-25",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=1F2l44L83i0",
        "severity": "High",
        "affected_population": 1680000,
        "description": "Holiday typhoon causing widespread destructive winds, power pole collapses, and prolonged blackouts across Northern Panay.",
        "category": "Typhoon"
    },
    {
        "id": "typhoon-molave-2020",
        "name": "Typhoon Molave (Quinta)",
        "startDate": "2020-10-25",
        "endDate": "2020-11-25",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=p4vW7hR4F8s",
        "severity": "Moderate",
        "affected_population": 890000,
        "description": "Fast-moving typhoon triggering coastal storm surges, widespread agricultural flooding, and localized power disruptions.",
        "category": "Typhoon"
    },
    {
        "id": "typhoon-rai-2021",
        "name": "Typhoon Rai (Odette)",
        "startDate": "2021-12-16",
        "endDate": "2022-01-16",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=R9tD38-h_u4",
        "severity": "Severe",
        "affected_population": 2450000,
        "description": "Super Typhoon Rai (Odette) devastated the Visayas corridor, inflicting major transmission line destruction and month-long restoration.",
        "category": "Typhoon"
    },
    {
        "id": "ts-megi-2022",
        "name": "Tropical Storm Megi (Agaton)",
        "startDate": "2022-04-10",
        "endDate": "2022-05-10",
        "type": "monsoon_flood",
        "resource_url": "https://www.youtube.com/watch?v=wX-y4iC_a-s",
        "severity": "High",
        "affected_population": 1120000,
        "description": "Stationary tropical storm inducing continuous heavy rains, catastrophic landslides, and severe lowland inundation across Capiz and Iloilo.",
        "category": "Flood"
    },
    {
        "id": "sts-nalgae-2022",
        "name": "Severe Tropical Storm Nalgae (Paeng)",
        "startDate": "2022-10-28",
        "endDate": "2022-11-28",
        "type": "monsoon_flood",
        "resource_url": "https://www.youtube.com/watch?v=NXVwDAwMUhk",
        "severity": "High",
        "affected_population": 1580000,
        "description": "Severe Tropical Storm Nalgae brought immense rainbands causing widespread riverine flooding and bridge washouts across Western Visayas.",
        "category": "Flood"
    },
    {
        "id": "panay-blackout-2024",
        "name": "Panay Island Grid Collapse",
        "startDate": "2024-01-02",
        "endDate": "2024-02-01",
        "type": "grid_failure",
        "resource_url": "https://www.youtube.com/watch?v=fXvQk_K0yT0",
        "severity": "Severe",
        "affected_population": 4500000,
        "description": "Cascading power plant shutdowns and transmission line trips leading to a total island-wide blackout across all Panay and Guimaras LGUs.",
        "category": "Power Disruption"
    },
    {
        "id": "habagat-carina-2024",
        "name": "Southwest Monsoon / Gaemi Floods",
        "startDate": "2024-07-24",
        "endDate": "2024-08-24",
        "type": "monsoon_flood",
        "resource_url": "https://www.youtube.com/watch?v=uK8E2jX7X6s",
        "severity": "Moderate",
        "affected_population": 980000,
        "description": "Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.",
        "category": "Flood"
    },
    {
        "id": "sts-trami-2024",
        "name": "Severe Tropical Storm Trami (Kristine)",
        "startDate": "2024-10-22",
        "endDate": "2024-11-22",
        "type": "monsoon_flood",
        "resource_url": "https://www.youtube.com/watch?v=M5QjN3qf5g4",
        "severity": "High",
        "affected_population": 1350000,
        "description": "Broad circulation severe tropical storm bringing unprecedented continuous precipitation and submerged transmission substations.",
        "category": "Flood"
    },
    {
        "id": "typhoon-kalmaegi-2025",
        "name": "Typhoon Kalmaegi (Tino)",
        "startDate": "2025-11-03",
        "endDate": "2025-12-03",
        "type": "typhoon",
        "resource_url": "https://www.youtube.com/watch?v=O1eP9j2nN7s",
        "severity": "High",
        "affected_population": 1220000,
        "description": "Late-season typhoon causing gale-force wind damage and flash floods across coastal Antique and Aklan.",
        "category": "Typhoon"
    }
]

def get_presets() -> List[Dict[str, Any]]:
    """Returns the verified Panay disaster event presets."""
    if os.path.exists(PRESETS_JSON_PATH):
        try:
            with open(PRESETS_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass
    return PANAY_EVENT_PRESETS
