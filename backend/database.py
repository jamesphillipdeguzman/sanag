"""
Database Schema & Migration Layer for Project SANAG.
Manages SQLite connections, schema versioning, contextual event metadata columns,
and standardized historical event profile seeding.
"""
import os
import sqlite3
from typing import Optional, Dict, Any, List

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db", "sanag.db")

HISTORICAL_EVENT_PROFILES: Dict[str, Dict[str, str]] = {
    "typhoon-kalmaegi-2025": {
        "event_type": "Tropical Cyclone",
        "disaster_category": "Category 3 Landfall",
        "root_cause_summary": "High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal and northern corridors.",
        "infrastructure_impact": "Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve over multiple observation cycles.",
    },
    "panay-grid-collapse-2024": {
        "event_type": "Grid Disturbance / Frequency Trip",
        "disaster_category": "Cascading System Separation",
        "root_cause_summary": "Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.",
        "infrastructure_impact": "Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate.",
    },
    "panay-blackout-2024": {
        "event_type": "Grid Disturbance / Frequency Trip",
        "disaster_category": "Cascading System Separation",
        "root_cause_summary": "Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.",
        "infrastructure_impact": "Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate.",
    },
    "typhoon-odette-2021": {
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Landfall",
        "root_cause_summary": "Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.",
        "infrastructure_impact": "Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit.",
    },
    "typhoon-rai-2021": {
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Landfall",
        "root_cause_summary": "Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.",
        "infrastructure_impact": "Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit.",
    },
    "sts-trami-2024": {
        "event_type": "Severe Tropical Storm",
        "disaster_category": "High-Volume Monsoon Inundation",
        "root_cause_summary": "Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides across river basins.",
        "infrastructure_impact": "Substation water-logging and precautionary sectional feeder isolations; rapid recovery as floodwaters recede followed by equipment drying.",
    },
    "habagat-carina-2024": {
        "event_type": "Southwest Monsoon / Tropical Cyclone",
        "disaster_category": "Monsoon Flooding & Landslide",
        "root_cause_summary": "Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.",
        "infrastructure_impact": "Localized feeder trips and pole destabilization in saturated soils; moderate recovery timeline.",
    },
    "sts-nalgae-2022": {
        "event_type": "Severe Tropical Storm",
        "disaster_category": "Flash Flooding & Mudslides",
        "root_cause_summary": "Stationary rainbands causing riverine surges, washed out bridge distribution conduits, and mudslide damage to transmission towers.",
        "infrastructure_impact": "Physical feeder breaks and severed bridge crossings requiring line re-routing and bypass installation.",
    },
    "ts-megi-2022": {
        "event_type": "Tropical Storm",
        "disaster_category": "Prolonged Lowland Inundation",
        "root_cause_summary": "Slow-moving tropical depression causing persistent torrential rain, flash landslides, and submerged municipal load centers across Capiz.",
        "infrastructure_impact": "Waterlogged pad-mounted distribution transformers and mud deposit clearance across rural distribution lines.",
    },
    "typhoon-molave-2020": {
        "event_type": "Typhoon",
        "disaster_category": "Category 1 Landfall",
        "root_cause_summary": "High wind gusts causing vegetation contact and fallen distribution lines along coastal highways.",
        "infrastructure_impact": "Moderate distribution pole snapping; quick line-clearing and re-stringing restores power within 48 to 72 hours.",
    },
    "typhoon-phanfone-2019": {
        "event_type": "Typhoon",
        "disaster_category": "Category 2 Landfall",
        "root_cause_summary": "Violent holiday eye-wall transit across Northern Panay causing widespread snapped concrete distribution poles and downed conductor cables.",
        "infrastructure_impact": "Extensive physical grid destruction across Aklan and Northern Capiz requiring heavy inter-cooperative lineman assistance.",
    },
    "typhoon-hagupit-2014": {
        "event_type": "Typhoon",
        "disaster_category": "Category 3 Landfall",
        "root_cause_summary": "Gale-force wind gusts and storm surges damaging coastal substations and distribution backbones.",
        "infrastructure_impact": "Structural distribution pole damage and salt spray insulator flashovers along coastal feeder corridors.",
    },
    "typhoon-haiyan-2013": {
        "event_type": "Super Typhoon",
        "disaster_category": "Category 5 Super Typhoon",
        "root_cause_summary": "Unprecedented 315 km/h sustained winds and catastrophic storm surge destroying entire transmission line backbones across Eastern and Western Visayas.",
        "infrastructure_impact": "Total collapse of high-voltage transmission lines and distribution networks; multi-month physical reconstruction required.",
    },
    "volcanic-eruption": {
        "event_type": "Volcanic Eruption",
        "disaster_category": "Volcanic Eruption",
        "root_cause_summary": "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
        "infrastructure_impact": "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.",
    },
    "eruption-taal": {
        "event_type": "Volcanic Eruption",
        "disaster_category": "Volcanic Eruption",
        "root_cause_summary": "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
        "infrastructure_impact": "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.",
    },
    "taal-volcano-eruption": {
        "event_type": "Volcanic Eruption",
        "disaster_category": "Volcanic Eruption",
        "root_cause_summary": "Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.",
        "infrastructure_impact": "De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.",
    },
}

CONTEXTUAL_COLUMNS = [
    ("event_type", "TEXT"),
    ("disaster_category", "TEXT"),
    ("root_cause_summary", "TEXT"),
    ("infrastructure_impact", "TEXT"),
]


def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    """Returns a SQLite connection configured with Row factory."""
    path = db_path or DB_PATH
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_events_schema(conn: sqlite3.Connection):
    """
    Ensures the events table exists and has the contextual metadata columns:
    event_type, disaster_category, root_cause_summary, infrastructure_impact.
    """
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(events)")
    cols = {col[1]: col for col in cursor.fetchall()}

    if not cols:
        cursor.execute("""
            CREATE TABLE events (
                id TEXT PRIMARY KEY,
                municipality_code TEXT,
                name TEXT NOT NULL,
                description TEXT,
                date TEXT NOT NULL,
                category TEXT NOT NULL,
                image_url TEXT,
                start_date TEXT,
                end_date TEXT,
                type TEXT,
                resource_url TEXT,
                event_type TEXT,
                disaster_category TEXT,
                root_cause_summary TEXT,
                infrastructure_impact TEXT
            )
        """)
    else:
        for col_name, col_type in CONTEXTUAL_COLUMNS:
            if col_name not in cols:
                cursor.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")

    conn.commit()


def seed_historical_event_profiles(conn: sqlite3.Connection):
    """
    Populates seeded events with standardized root-cause narratives and metadata.
    Also ensures key historical aliases (e.g. panay-grid-collapse-2024 and typhoon-odette-2021)
    are present in the database.
    """
    ensure_events_schema(conn)
    cursor = conn.cursor()

    # 1. Update existing event rows that match profile keys
    for event_id, profile in HISTORICAL_EVENT_PROFILES.items():
        cursor.execute(
            """
            UPDATE events
            SET event_type = ?,
                disaster_category = ?,
                root_cause_summary = ?,
                infrastructure_impact = ?
            WHERE id = ?
            """,
            (
                profile["event_type"],
                profile["disaster_category"],
                profile["root_cause_summary"],
                profile["infrastructure_impact"],
                event_id,
            ),
        )

    # 2. Ensure dated duplicate is removed and canonical entry has clean title:
    cursor.execute("DELETE FROM events WHERE id = 'panay-grid-collapse-2024' OR name LIKE '%(January 2024)%'")
    cursor.execute("UPDATE events SET name = 'Panay Island Grid Collapse' WHERE id = 'panay-blackout-2024'")

    # typhoon-odette-2021 <-> typhoon-rai-2021
    cursor.execute("SELECT * FROM events WHERE id = 'typhoon-rai-2021'")
    rai_row = cursor.fetchone()
    cursor.execute("SELECT * FROM events WHERE id = 'typhoon-odette-2021'")
    odette_row = cursor.fetchone()

    odette_profile = HISTORICAL_EVENT_PROFILES["typhoon-odette-2021"]
    if rai_row and not odette_row:
        cursor.execute(
            """
            INSERT OR REPLACE INTO events (
                id, municipality_code, name, description, date, category, image_url,
                start_date, end_date, type, resource_url,
                event_type, disaster_category, root_cause_summary, infrastructure_impact
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "typhoon-odette-2021",
                rai_row["municipality_code"] or "PANAY_ALL",
                "Typhoon Odette (Rai)",
                rai_row["description"],
                rai_row["date"],
                rai_row["category"],
                rai_row["image_url"],
                rai_row["start_date"],
                rai_row["end_date"],
                "typhoon",
                rai_row["resource_url"],
                odette_profile["event_type"],
                odette_profile["disaster_category"],
                odette_profile["root_cause_summary"],
                odette_profile["infrastructure_impact"],
            ),
        )

    # 3. Ensure typhoon-kalmaegi-2025 has the full profile
    kalmaegi_profile = HISTORICAL_EVENT_PROFILES["typhoon-kalmaegi-2025"]
    cursor.execute(
        """
        UPDATE events
        SET event_type = ?,
            disaster_category = ?,
            root_cause_summary = ?,
            infrastructure_impact = ?
        WHERE id = 'typhoon-kalmaegi-2025'
        """,
        (
            kalmaegi_profile["event_type"],
            kalmaegi_profile["disaster_category"],
            kalmaegi_profile["root_cause_summary"],
            kalmaegi_profile["infrastructure_impact"],
        ),
    )

    conn.commit()


def get_event_profile(event_id: str) -> Optional[Dict[str, str]]:
    """Returns the standardized root-cause profile for a given event ID or alias."""
    clean_id = (event_id or "").strip()
    if clean_id in HISTORICAL_EVENT_PROFILES:
        return HISTORICAL_EVENT_PROFILES[clean_id]
    
    # Check aliases
    alias_map = {
        "panay-blackout-2024": "panay-grid-collapse-2024",
        "panay-grid-collapse-2024": "panay-blackout-2024",
        "typhoon-odette-2021": "typhoon-rai-2021",
        "typhoon-rai-2021": "typhoon-odette-2021",
    }
    alt_id = alias_map.get(clean_id)
    if alt_id and alt_id in HISTORICAL_EVENT_PROFILES:
        return HISTORICAL_EVENT_PROFILES[alt_id]
    
    # Generic fallback based on id keywords
    lower = clean_id.lower()
    if "volcan" in lower or "eruption" in lower or "taal" in lower or "mayon" in lower or "kanlaon" in lower or "bulusan" in lower or lower == "vo":
        return HISTORICAL_EVENT_PROFILES["volcanic-eruption"]
    if "grid" in lower or "blackout" in lower or "trip" in lower:
        return HISTORICAL_EVENT_PROFILES.get("panay-blackout-2024") or HISTORICAL_EVENT_PROFILES.get("panay-grid-collapse-2024")
    if "odette" in lower or "rai" in lower:
        return HISTORICAL_EVENT_PROFILES["typhoon-odette-2021"]
    if "kalmaegi" in lower or "tino" in lower or "typhoon" in lower or "cyclone" in lower:
        return HISTORICAL_EVENT_PROFILES["typhoon-kalmaegi-2025"]
    if "flood" in lower or "monsoon" in lower or "trami" in lower or "carina" in lower:
        return HISTORICAL_EVENT_PROFILES["sts-trami-2024"]

    return None
