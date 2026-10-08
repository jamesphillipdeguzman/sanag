"""
Utility script to slice the authentic Philippine Level 3 (City/Municipality)
administrative boundary dataset into discrete regional GeoJSON chunks for Project SANAG.

Outputs 13 regional chunks directly to frontend/public/regions/ with standardized properties.
"""

import json
import os
import re
import urllib.request

GADM_PHL_L2_URL = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_PHL_2.json"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REGIONS_DIR = os.path.join(BASE_DIR, "frontend", "public", "regions")
DIST_REGIONS_DIR = os.path.join(BASE_DIR, "frontend", "dist", "regions")
SRC_DATA_REGIONS_DIR = os.path.join(BASE_DIR, "frontend", "src", "data", "regions")
MANIFEST_PATH = os.path.join(REGIONS_DIR, "manifest.json")

# Regional definitions with province groupings and official metadata
REGION_CONFIGS = {
    "ncr": {
        "label": "National Capital Region (Metro Manila)",
        "file": "ncr.geojson",
        "region_code": "PH13",
        "region_name": "National Capital Region (NCR)",
        "provinces": ["MetropolitanManila"],
    },
    "car": {
        "label": "Cordillera Administrative Region (CAR)",
        "file": "car.geojson",
        "region_code": "PH14",
        "region_name": "Cordillera Administrative Region (CAR)",
        "provinces": ["Abra", "Apayao", "Benguet", "Ifugao", "Kalinga", "MountainProvince"],
    },
    "ilocos_cagayan": {
        "label": "Ilocos & Cagayan Valley (Regions I & II)",
        "file": "ilocos_cagayan.geojson",
        "region_code": "PH01",
        "region_name": "Northern Luzon (Regions I & II)",
        "provinces": [
            "IlocosNorte", "IlocosSur", "LaUnion", "Pangasinan",
            "Batanes", "Cagayan", "Isabela", "NuevaVizcaya", "Quirino"
        ],
    },
    "central_luzon": {
        "label": "Central Luzon (Region III)",
        "file": "central_luzon.geojson",
        "region_code": "PH03",
        "region_name": "Region III (Central Luzon)",
        "provinces": ["Aurora", "Bataan", "Bulacan", "NuevaEcija", "Pampanga", "Tarlac", "Zambales"],
    },
    "calabarzon_mimaropa": {
        "label": "CALABARZON & MIMAROPA (Regions IV-A & IV-B)",
        "file": "calabarzon_mimaropa.geojson",
        "region_code": "PH04",
        "region_name": "Southern Tagalog & MIMAROPA",
        "provinces": [
            "Batangas", "Cavite", "Laguna", "Quezon", "Rizal",
            "Marinduque", "OccidentalMindoro", "OrientalMindoro", "Palawan", "Romblon"
        ],
    },
    "bicol": {
        "label": "Bicol Region (Region V)",
        "file": "bicol.geojson",
        "region_code": "PH05",
        "region_name": "Region V (Bicol Region)",
        "provinces": ["Albay", "CamarinesNorte", "CamarinesSur", "Catanduanes", "Masbate", "Sorsogon"],
    },
    "panay_guimaras": {
        "label": "Western Visayas (Panay & Negros)",
        "file": "panay_guimaras.geojson",
        "region_code": "PH06",
        "region_name": "Region VI (Western Visayas)",
        "provinces": ["Aklan", "Antique", "Capiz", "Guimaras", "Iloilo", "NegrosOccidental"],
    },
    "central_visayas": {
        "label": "Central Visayas (Region VII - Cebu, Bohol)",
        "file": "central_visayas.geojson",
        "region_code": "PH07",
        "region_name": "Region VII (Central Visayas)",
        "provinces": ["Bohol", "Cebu", "NegrosOriental", "Siquijor"],
    },
    "eastern_visayas": {
        "label": "Eastern Visayas (Region VIII - Leyte, Samar)",
        "file": "eastern_visayas.geojson",
        "region_code": "PH08",
        "region_name": "Region VIII (Eastern Visayas)",
        "provinces": ["Biliran", "EasternSamar", "Leyte", "NorthernSamar", "Samar", "SouthernLeyte"],
    },
    "zamboanga_peninsula": {
        "label": "Zamboanga Peninsula (Region IX)",
        "file": "zamboanga_peninsula.geojson",
        "region_code": "PH09",
        "region_name": "Region IX (Zamboanga Peninsula)",
        "provinces": ["ZamboangadelNorte", "ZamboangadelSur", "ZamboangaSibugay"],
    },
    "northern_mindanao_caraga": {
        "label": "Northern Mindanao & Caraga (Regions X & XIII)",
        "file": "northern_mindanao_caraga.geojson",
        "region_code": "PH10",
        "region_name": "Northern Mindanao & Caraga",
        "provinces": [
            "Bukidnon", "Camiguin", "LanaodelNorte", "MisamisOccidental", "MisamisOriental",
            "AgusandelNorte", "AgusandelSur", "DinagatIslands", "SurigaodelNorte", "SurigaodelSur"
        ],
    },
    "mindanao_south": {
        "label": "South Mindanao (Davao & SOCCSKSARGEN / Sarangani)",
        "file": "mindanao_south.geojson",
        "region_code": "PH11",
        "region_name": "Regions XI & XII (Davao & SOCCSKSARGEN)",
        "provinces": [
            "CompostelaValley", "DavaoOriental", "DavaodelNorte", "DavaodelSur",
            "NorthCotabato", "Sarangani", "SouthCotabato", "SultanKudarat"
        ],
    },
    "barmm": {
        "label": "Bangsamoro (BARMM)",
        "file": "barmm.geojson",
        "region_code": "PH15",
        "region_name": "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)",
        "provinces": ["Basilan", "LanaodelSur", "Maguindanao", "Sulu", "Tawi-Tawi"],
    },
}

PROVINCE_DISPLAY_NAMES = {
    "MetropolitanManila": "Metro Manila",
    "MountainProvince": "Mountain Province",
    "IlocosNorte": "Ilocos Norte",
    "IlocosSur": "Ilocos Sur",
    "LaUnion": "La Union",
    "NuevaVizcaya": "Nueva Vizcaya",
    "NuevaEcija": "Nueva Ecija",
    "OccidentalMindoro": "Occidental Mindoro",
    "OrientalMindoro": "Oriental Mindoro",
    "CamarinesNorte": "Camarines Norte",
    "CamarinesSur": "Camarines Sur",
    "NegrosOccidental": "Negros Occidental",
    "NegrosOriental": "Negros Oriental",
    "EasternSamar": "Eastern Samar",
    "NorthernSamar": "Northern Samar",
    "SouthernLeyte": "Southern Leyte",
    "ZamboangadelNorte": "Zamboanga del Norte",
    "ZamboangadelSur": "Zamboanga del Sur",
    "ZamboangaSibugay": "Zamboanga Sibugay",
    "MisamisOccidental": "Misamis Occidental",
    "MisamisOriental": "Misamis Oriental",
    "LanaodelNorte": "Lanao del Norte",
    "LanaodelSur": "Lanao del Sur",
    "AgusandelNorte": "Agusan del Norte",
    "AgusandelSur": "Agusan del Sur",
    "DinagatIslands": "Dinagat Islands",
    "SurigaodelNorte": "Surigao del Norte",
    "SurigaodelSur": "Surigao del Sur",
    "CompostelaValley": "Davao de Oro",
    "DavaoOriental": "Davao Oriental",
    "DavaodelNorte": "Davao del Norte",
    "DavaodelSur": "Davao del Sur",
    "NorthCotabato": "Cotabato",
    "SouthCotabato": "South Cotabato",
    "SultanKudarat": "Sultan Kudarat",
}

DAVAO_OCCIDENTAL_MUNIS = {
    "DonMarcelino", "JoseAbadSantos", "Malita", "SantaMaria", "Sarangani"
}

def format_muni_name(raw: str) -> str:
    overrides = {
        "DavaoCity": "Davao City",
        "GeneralSantosCity": "General Santos City",
        "CebuCity": "Cebu City",
        "ZamboangaCity": "Zamboanga City",
        "BaguioCity": "Baguio City",
        "IloiloCity": "Iloilo City",
        "CagayandeOroCity": "Cagayan de Oro City",
        "QuezonCity": "Quezon City",
        "CityofManila": "City of Manila",
        "TagumCity": "Tagum City",
        "DigosCity": "Digos City",
        "PanaboCity": "Panabo City",
        "SamalCity": "Island Garden City of Samal",
        "KidapawanCity": "Kidapawan City",
        "KoronadalCity": "Koronadal City",
        "TacurongCity": "Tacurong City",
        "MatiCity": "Mati City",
        "ButuanCity": "Butuan City",
        "SurigaoCity": "Surigao City",
        "CotabatoCity": "Cotabato City",
        "MarawiCity": "Marawi City",
        "SanFernandoCity": "San Fernando City",
        "BatangasCity": "Batangas City",
        "LipaCity": "Lipa City",
        "LucenaCity": "Lucena City",
        "CalambaCity": "Calamba City",
        "AntipoloCity": "Antipolo City",
        "PuertoPrincesaCity": "Puerto Princesa City",
        "LegazpiCity": "Legazpi City",
        "NagaCity": "Naga City",
        "TaclobanCity": "Tacloban City",
        "OrmocCity": "Ormoc City",
        "DumagueteCity": "Dumaguete City",
        "TagbilaranCity": "Tagbilaran City",
        "Lapu-LapuCity": "Lapu-Lapu City",
        "MandaueCity": "Mandaue City",
        "BacolodCity": "Bacolod City",
        "RoxasCity": "Roxas City",
        "Glan": "Glan",
        "Alabel": "Alabel",
        "Kiamba": "Kiamba",
        "Maasim": "Maasim",
        "Maitum": "Maitum",
        "Malapatan": "Malapatan",
        "Malungon": "Malungon",
        "LakeSebu": "Lake Sebu",
        "T'Boli": "T'Boli",
        "M'Lang": "M'lang",
        "BraulioE.Dujali": "Braulio E. Dujali",
        "DonMarcelino": "Don Marcelino",
        "JoseAbadSantos": "Jose Abad Santos",
        "SantaCruz": "Santa Cruz",
        "SantaMaria": "Santa Maria",
        "SantoNino": "Santo Niño",
        "SantoTomas": "Santo Tomas",
        "SanIsidro": "San Isidro",
        "NewBataan": "New Bataan",
        "NewCorella": "New Corella",
        "GovernorGeneroso": "Governor Generoso",
        "PresidentRoxas": "President Roxas",
        "PresidentQuirino": "President Quirino",
        "Sen.NinoyAquino": "Senator Ninoy Aquino",
    }
    if raw in overrides:
        return overrides[raw]
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw)
    return spaced

def round_coords(coords):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 5), round(coords[1], 5)]
    return [round_coords(c) for c in coords]

def calculate_bounds(features):
    lats, lngs = [], []
    for f in features:
        g = f.get("geometry", {})
        def collect(c):
            if isinstance(c[0], (int, float)):
                lngs.append(c[0])
                lats.append(c[1])
            else:
                for sub in c:
                    collect(sub)
        collect(g.get("coordinates", []))
    if not lats or not lngs:
        return 0, 0, 0, 0
    return round(min(lats), 2), round(max(lats), 2), round(min(lngs), 2), round(max(lngs), 2)

def main():
    print(f"Downloading authentic Philippine administrative boundaries from {GADM_PHL_L2_URL}...")
    req = urllib.request.Request(GADM_PHL_L2_URL, headers={"User-Agent": "Mozilla/5.0 (SANAG-Slicer)"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        gadm_data = json.load(resp)

    all_features = gadm_data.get("features", [])
    print(f"Loaded {len(all_features)} Level 2 features.")

    os.makedirs(REGIONS_DIR, exist_ok=True)
    if os.path.exists(os.path.dirname(DIST_REGIONS_DIR)):
        os.makedirs(DIST_REGIONS_DIR, exist_ok=True)
    if os.path.exists(os.path.dirname(SRC_DATA_REGIONS_DIR)):
        os.makedirs(SRC_DATA_REGIONS_DIR, exist_ok=True)

    manifest_entries = {}
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as mf:
                manifest_entries = json.load(mf)
        except Exception:
            manifest_entries = {}

    summary_bounds = {}

    for region_key, cfg in REGION_CONFIGS.items():
        prov_set = set(cfg["provinces"])
        extracted = []

        for feat in all_features:
            props = feat.get("properties", {})
            prov_gadm = props.get("NAME_1", "")
            if prov_gadm not in prov_set:
                continue

            eng_type = props.get("ENGTYPE_2", "")
            if eng_type not in ("Municipality", "City"):
                continue

            muni_gadm = props.get("NAME_2", "")
            cc_2 = props.get("CC_2", "")
            muni_name = format_muni_name(muni_gadm)

            # Determine official province name
            if prov_gadm == "DavaodelSur" and muni_gadm in DAVAO_OCCIDENTAL_MUNIS:
                province = "Davao Occidental"
                prov_pcode = "PH1186"
                prov_key = "davao_occidental"
            else:
                province = PROVINCE_DISPLAY_NAMES.get(prov_gadm, prov_gadm)
                prov_pcode = f"PH{cc_2[:4]}" if cc_2 and cc_2 != "NA" and len(cc_2) >= 4 else "PH00"
                prov_key = re.sub(r"[^a-z0-9]", "_", province.lower()).strip("_")

            pcode = f"PH{cc_2}000" if cc_2 and cc_2 != "NA" else f"{prov_pcode}{len(extracted):03d}"
            psgc = f"{cc_2}000" if cc_2 and cc_2 != "NA" else pcode

            new_props = {
                "ADM3_EN": muni_name,
                "name": muni_name,
                "ADM3_PCODE": pcode,
                "psgc_code": psgc,
                "ADM2_EN": province,
                "ADM2_PCODE": prov_pcode,
                "ADM1_EN": cfg["region_name"],
                "ADM1_PCODE": cfg["region_code"],
                "ADM0_EN": "Philippines (the)",
                "ADM0_PCODE": "PH",
                "region_key": region_key,
                "province_key": prov_key,
                "type": eng_type,
            }

            rounded_geom = {
                "type": feat.get("geometry", {}).get("type"),
                "coordinates": round_coords(feat.get("geometry", {}).get("coordinates", []))
            }

            extracted.append({
                "type": "Feature",
                "geometry": rounded_geom,
                "properties": new_props
            })

        fc = {
            "type": "FeatureCollection",
            "name": f"{region_key}_municipalities",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": extracted
        }

        out_path = os.path.join(REGIONS_DIR, cfg["file"])
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(fc, f, separators=(",", ":"), ensure_ascii=False)

        sz_kb = round(os.path.getsize(out_path) / 1024, 1)

        # Sync to dist and src/data if they exist
        if os.path.exists(DIST_REGIONS_DIR):
            dist_path = os.path.join(DIST_REGIONS_DIR, cfg["file"])
            with open(dist_path, "w", encoding="utf-8") as f:
                json.dump(fc, f, separators=(",", ":"), ensure_ascii=False)

        if os.path.exists(SRC_DATA_REGIONS_DIR):
            src_path = os.path.join(SRC_DATA_REGIONS_DIR, cfg["file"])
            with open(src_path, "w", encoding="utf-8") as f:
                json.dump(fc, f, separators=(",", ":"), ensure_ascii=False)

        min_lat, max_lat, min_lng, max_lng = calculate_bounds(extracted)
        summary_bounds[region_key] = {
            "minLat": min_lat,
            "maxLat": max_lat,
            "minLng": min_lng,
            "maxLng": max_lng,
        }

        manifest_entries[region_key] = {
            "file": f"/regions/{cfg['file']}",
            "count": len(extracted),
            "size_kb": sz_kb,
            "label": cfg["label"],
            "bounds": summary_bounds[region_key]
        }

        print(f"[{region_key}] Wrote {len(extracted)} LGUs -> {cfg['file']} ({sz_kb} KB) Bounds: [{min_lat}, {max_lat}, {min_lng}, {max_lng}]")

    # If panay.geojson already exists in public/regions/, ensure it is synced in manifest
    panay_path = os.path.join(REGIONS_DIR, "panay.geojson")
    if os.path.exists(panay_path):
        sz_kb = round(os.path.getsize(panay_path) / 1024, 1)
        manifest_entries["panay"] = {
            "file": "/regions/panay.geojson",
            "count": 98,
            "size_kb": sz_kb,
            "label": "Panay Island (Western Visayas)",
            "bounds": {"minLat": 10.3, "maxLat": 12.1, "minLng": 121.8, "maxLng": 123.4}
        }

    # Also register aliases for central_visayas / ncr_calabarzon
    if "central_visayas" in manifest_entries:
        manifest_entries["cebu_bohol"] = manifest_entries["central_visayas"]
    if "calabarzon_mimaropa" in manifest_entries:
        manifest_entries["ncr_southern_tagalog"] = manifest_entries["calabarzon_mimaropa"]

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest_entries, f, indent=2, ensure_ascii=False)

    print("\nManifest updated at", MANIFEST_PATH)
    print("Summary Bounds for regionLookup.ts:")
    for k, b in summary_bounds.items():
        print(f"  {k}: minLat: {b['minLat']}, maxLat: {b['maxLat']}, minLng: {b['minLng']}, maxLng: {b['maxLng']}")

if __name__ == "__main__":
    main()
