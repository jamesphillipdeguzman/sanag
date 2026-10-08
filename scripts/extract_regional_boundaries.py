"""
Script to extract and standardize authentic municipal administrative boundaries
for South Mindanao (Region XI - Davao Region & Region XII - SOCCSKSARGEN / Sarangani)
from the GADM Level 2 / PSA administrative boundary dataset.

Generates frontend/public/regions/mindanao_south.geojson with true multi-vertex polygon rings.
"""

import json
import os
import re
import urllib.request

# Authentic GADM 4.1 Level 2 Philippine Administrative Dataset
GADM_PHL_L2_URL = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_PHL_2.json"
OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "frontend", "public", "regions", "mindanao_south.geojson"
)

# Explicit display name overrides for municipalities/cities
MUNICIPALITY_NAME_MAP = {
    "BraulioE.Dujali": "Braulio E. Dujali",
    "DavaoCity": "Davao City",
    "DigosCity": "Digos City",
    "DonMarcelino": "Don Marcelino",
    "GeneralSantosCity": "General Santos City",
    "GovernorGeneroso": "Governor Generoso",
    "IslandGardenCityofSamal": "Island Garden City of Samal",
    "JoseAbadSantos": "Jose Abad Santos",
    "KidapawanCity": "Kidapawan City",
    "KoronadalCity": "Koronadal City",
    "LakeSebu": "Lake Sebu",
    "M'Lang": "M'lang",
    "MatiCity": "Mati City",
    "NewBataan": "New Bataan",
    "NewCorella": "New Corella",
    "PanaboCity": "Panabo City",
    "Pigkawayan": "Pigcawayan",
    "PresidentQuirino": "President Quirino",
    "PresidentRoxas": "President Roxas",
    "SamalCity": "Island Garden City of Samal",
    "SanIsidro": "San Isidro",
    "SantaCruz": "Santa Cruz",
    "SantaMaria": "Santa Maria",
    "SantoNino": "Santo Niño",
    "SantoTomas": "Santo Tomas",
    "Sen.NinoyAquino": "Senator Ninoy Aquino",
    "T'Boli": "T'Boli",
    "TacurongCity": "Tacurong City",
    "TagumCity": "Tagum City",
}

# Municipalities belonging to Davao Occidental (created from Davao del Sur in 2013)
DAVAO_OCCIDENTAL_MUNIS = {
    "DonMarcelino", "JoseAbadSantos", "Malita", "SantaMaria", "Sarangani"
}

TARGET_GADM_PROVINCES = [
    "CompostelaValley",
    "DavaoOriental",
    "DavaodelNorte",
    "DavaodelSur",
    "NorthCotabato",
    "Sarangani",
    "SouthCotabato",
    "SultanKudarat",
]

def format_muni_name(raw_name: str) -> str:
    if raw_name in MUNICIPALITY_NAME_MAP:
        return MUNICIPALITY_NAME_MAP[raw_name]
    # Fallback to regex splitting camelCase if not mapped
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", raw_name)
    return spaced

def round_coords(coords):
    if not coords:
        return coords
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], 5), round(coords[1], 5)]
    return [round_coords(c) for c in coords]

def extract_south_mindanao():
    print(f"Downloading authentic Philippine administrative boundaries from {GADM_PHL_L2_URL}...")
    req = urllib.request.Request(GADM_PHL_L2_URL, headers={"User-Agent": "Mozilla/5.0 (SANAG-Extract)"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        gadm_data = json.load(resp)

    features = gadm_data.get("features", [])
    print(f"Loaded {len(features)} total features from GADM Level 2 dataset.")

    extracted_features = []
    for feat in features:
        props = feat.get("properties", {})
        prov_gadm = props.get("NAME_1", "")
        if prov_gadm not in TARGET_GADM_PROVINCES:
            continue

        eng_type = props.get("ENGTYPE_2", "")
        if eng_type not in ("Municipality", "City"):
            continue

        muni_gadm = props.get("NAME_2", "")
        cc_2 = props.get("CC_2", "")
        adm3_name = format_muni_name(muni_gadm)

        # Standardize Province, Region, and PCODEs
        if prov_gadm == "DavaodelSur":
            if muni_gadm in DAVAO_OCCIDENTAL_MUNIS:
                province = "Davao Occidental"
                prov_pcode = "PH1186"
                prov_key = "davao_occidental"
            else:
                province = "Davao del Sur"
                prov_pcode = "PH1124"
                prov_key = "davao_del_sur"
            region = "Region XI (Davao Region)"
            region_pcode = "PH11"
        elif prov_gadm == "DavaodelNorte":
            province = "Davao del Norte"
            prov_pcode = "PH1123"
            prov_key = "davao_del_norte"
            region = "Region XI (Davao Region)"
            region_pcode = "PH11"
        elif prov_gadm == "CompostelaValley":
            province = "Davao de Oro"
            prov_pcode = "PH1182"
            prov_key = "davao_de_oro"
            region = "Region XI (Davao Region)"
            region_pcode = "PH11"
        elif prov_gadm == "DavaoOriental":
            province = "Davao Oriental"
            prov_pcode = "PH1125"
            prov_key = "davao_oriental"
            region = "Region XI (Davao Region)"
            region_pcode = "PH11"
        elif prov_gadm == "Sarangani":
            province = "Sarangani"
            prov_pcode = "PH1280"
            prov_key = "sarangani"
            region = "Region XII (SOCCSKSARGEN)"
            region_pcode = "PH12"
        elif prov_gadm == "SouthCotabato":
            province = "South Cotabato"
            prov_pcode = "PH1263"
            prov_key = "south_cotabato"
            region = "Region XII (SOCCSKSARGEN)"
            region_pcode = "PH12"
        elif prov_gadm == "SultanKudarat":
            province = "Sultan Kudarat"
            prov_pcode = "PH1265"
            prov_key = "sultan_kudarat"
            region = "Region XII (SOCCSKSARGEN)"
            region_pcode = "PH12"
        elif prov_gadm == "NorthCotabato":
            province = "Cotabato"
            prov_pcode = "PH1247"
            prov_key = "cotabato"
            region = "Region XII (SOCCSKSARGEN)"
            region_pcode = "PH12"
        else:
            continue

        pcode = f"PH{cc_2}000" if cc_2 and cc_2 != "NA" else f"{prov_pcode}{len(extracted_features):03d}"
        psgc = f"{cc_2}000" if cc_2 and cc_2 != "NA" else pcode

        # Standard properties matching Project SANAG contract
        new_props = {
            "ADM3_EN": adm3_name,
            "name": adm3_name,
            "ADM3_PCODE": pcode,
            "psgc_code": psgc,
            "ADM2_EN": province,
            "ADM2_PCODE": prov_pcode,
            "ADM1_EN": region,
            "ADM1_PCODE": region_pcode,
            "ADM0_EN": "Philippines (the)",
            "ADM0_PCODE": "PH",
            "region_key": "mindanao_south",
            "province_key": prov_key,
            "type": eng_type,
        }

        # Optimize geometry coordinate precision
        geom = feat.get("geometry", {})
        rounded_geom = {
            "type": geom.get("type"),
            "coordinates": round_coords(geom.get("coordinates", []))
        }

        extracted_features.append({
            "type": "Feature",
            "geometry": rounded_geom,
            "properties": new_props
        })

    print(f"Extracted {len(extracted_features)} authentic municipal boundary features for South Mindanao.")

    feature_collection = {
        "type": "FeatureCollection",
        "name": "mindanao_south_municipalities",
        "crs": {
            "type": "name",
            "properties": {
                "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
            }
        },
        "features": extracted_features
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(feature_collection, f, separators=(",", ":"), ensure_ascii=False)

    file_size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Successfully wrote {OUTPUT_PATH} ({file_size_kb:.2f} KB).")

if __name__ == "__main__":
    extract_south_mindanao()
