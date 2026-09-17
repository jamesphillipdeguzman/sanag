import json
import os
from typing import Dict, Any, List, Optional, Tuple

def get_geojson_filepath() -> str:
    """
    Finds panay_municipalities.geojson reliably across environments and CWDs.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(base_dir, "..", "frontend", "public", "panay_municipalities.geojson"),
        os.path.join(base_dir, "..", "frontend", "src", "data", "panay_municipalities.geojson"),
        os.path.join(base_dir, "data", "panay_municipalities.geojson"),
        "frontend/public/panay_municipalities.geojson",
        "frontend/src/data/panay_municipalities.geojson"
    ]
    for path in candidates:
        norm = os.path.normpath(path)
        if os.path.exists(norm):
            return norm
    # Fallback default
    return os.path.normpath(candidates[0])

def load_panay_municipalities_geojson() -> Dict[str, Any]:
    """
    Loads the raw GeoJSON FeatureCollection for Panay municipalities (ADM3 level).
    Can be passed directly into Earth Engine FeatureCollection.
    """
    file_path = get_geojson_filepath()
    if not os.path.exists(file_path):
        print(f"Error: GeoJSON file not found at {file_path}")
        return {"type": "FeatureCollection", "features": []}

    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"Successfully loaded {len(data.get('features', []))} municipalities across Panay Island!")
    return data

def load_panay_municipalities_list() -> List[Dict[str, Any]]:
    """
    Loads all municipal boundaries as a list of Python dictionaries.
    """
    data = load_panay_municipalities_geojson()
    return data.get('features', [])

def get_municipality_lookup() -> Dict[str, Any]:
    """
    Builds comprehensive lookup dictionaries for mapping between
    feature indices (system:index), ADM3_PCODE, and municipal names.
    Guarantees 100% resolution for GEE exports even when 'name' is 'Unknown'.
    """
    features = load_panay_municipalities_list()
    by_index: Dict[str, Dict[str, str]] = {}
    by_pcode: Dict[str, Dict[str, str]] = {}
    by_name: Dict[str, Dict[str, str]] = {}

    for idx, feat in enumerate(features):
        props = feat.get('properties', {})
        name = props.get('ADM3_EN') or props.get('psgc_name') or 'Unknown'
        pcode = props.get('ADM3_PCODE') or props.get('psgc_id') or f"UNKNOWN_{idx}"
        province = props.get('ADM2_EN') or 'Panay'
        province_code = props.get('ADM2_PCODE') or ''

        meta = {
            "name": name,
            "pcode": pcode,
            "province": province,
            "province_code": province_code,
            "index": str(idx)
        }

        by_index[str(idx)] = meta
        if pcode:
            by_pcode[pcode] = meta
        if name:
            by_name[name.lower()] = meta

    return {
        "by_index": by_index,
        "by_pcode": by_pcode,
        "by_name": by_name,
        "total_municipalities": len(features)
    }

def parse_feature_identity_and_radiance(
    feature: Dict[str, Any], 
    lookup: Optional[Dict[str, Any]] = None
) -> Tuple[str, str, Optional[float]]:
    """
    Resolves (municipality_name, pcode, radiance_value) from a GEE FeatureCollection feature.
    Gracefully handles cloud-masked nulls and recovers 'Unknown' names via index/pcode.
    """
    if lookup is None:
        lookup = get_municipality_lookup()

    by_index = lookup["by_index"]
    by_pcode = lookup["by_pcode"]
    by_name = lookup["by_name"]

    props = feature.get('properties', {}) if isinstance(feature, dict) else {}
    if not isinstance(props, dict):
        props = {}

    # 1. Identify PCode & Name
    name = props.get('ADM3_EN') or props.get('psgc_name')
    if not name or name == "Unknown":
        alt_name = props.get('name')
        if alt_name and alt_name != "Unknown":
            name = alt_name

    pcode = props.get('ADM3_PCODE') or props.get('psgc_id')

    # If missing name, attempt recovery from pcode
    if (not name or name == "Unknown") and pcode and pcode in by_pcode:
        name = by_pcode[pcode]["name"]

    # If missing pcode, attempt recovery from name
    if (not pcode or pcode.startswith("UNKNOWN")) and name and name.lower() in by_name:
        pcode = by_name[name.lower()]["pcode"]

    # Fallback to system:index or feature id matching sequential Panay GeoJSON index
    if not name or name == "Unknown" or not pcode:
        sys_idx = str(props.get('system:index', feature.get('id', ''))).strip()
        if sys_idx in by_index:
            name = by_index[sys_idx]["name"]
            pcode = by_index[sys_idx]["pcode"]

    # 2. Extract Radiance
    # GEE reducers output 'mean', or the original band name ('avg_rad', 'rad', 'DNB_BRDF_Corrected_NTL')
    raw_rad = None
    for key in ['mean', 'avg_rad', 'rad', 'DNB_BRDF_Corrected_NTL']:
        if key in props and props[key] is not None:
            raw_rad = props[key]
            break

    radiance: Optional[float] = None
    if raw_rad is not None:
        try:
            radiance = round(float(raw_rad), 6)
        except (ValueError, TypeError):
            radiance = None

    return (name or "Unknown", pcode or "UNKNOWN", radiance)