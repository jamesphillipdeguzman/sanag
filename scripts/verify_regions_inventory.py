import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
regions_path = ROOT / 'frontend' / 'public' / 'regions'
geojson_files = sorted(regions_path.glob('*.geojson'))
print(f'Total regional geojson files: {len(geojson_files)}')

results = []
for gf in geojson_files:
    with open(gf, 'r', encoding='utf-8') as f:
        data = json.load(f)
    features = data.get('features', [])
    names = [feat.get('properties', {}).get('name') or feat.get('properties', {}).get('ADM3_EN') for feat in features]
    unique_names = set(names)
    pcodes = [feat.get('properties', {}).get('ADM3_PCODE') or feat.get('properties', {}).get('psgc_code') for feat in features]
    size_kb = gf.stat().st_size / 1024
    results.append({
        'file': gf.name,
        'count': len(features),
        'unique_names': len(unique_names),
        'unique_pcodes': len(set(pcodes)),
        'size_kb': round(size_kb, 1),
        'has_geom': all(feat.get('geometry') and len(feat.get('geometry', {}).get('coordinates', [])) > 0 for feat in features),
        'valid_type': data.get('type') == 'FeatureCollection'
    })

print(f"{'Region File':<35} | {'Features':<8} | {'Unique Names':<12} | {'Unique PCodes':<13} | {'Size KB':<10} | {'Geom Valid':<10}")
print('-' * 105)
for r in results:
    print(f"{r['file']:<35} | {r['count']:8d} | {r['unique_names']:12d} | {r['unique_pcodes']:13d} | {r['size_kb']:10.1f} | {str(r['has_geom']):<10}")

# Also check public root
public_path = ROOT / 'frontend' / 'public'
root_geojson = sorted(public_path.glob('*.geojson'))
print('\nRoot Public GeoJSON files:')
for gf in root_geojson:
    with open(gf, 'r', encoding='utf-8') as f:
        data = json.load(f)
    features = data.get('features', [])
    size_kb = gf.stat().st_size / 1024
    print(f"{gf.name:<35} | {len(features):8d} features | {size_kb:10.1f} KB")
