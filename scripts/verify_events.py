import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.event_presets import get_presets

presets = get_presets()
print(f"Total event presets: {len(presets)}\n")

print(f"{'Event ID':<32} | {'Name':<35} | {'Type':<15} | {'Coords':<22} | {'RegionKey'}")
print("-" * 115)
for p in presets:
    coords = p.get('coordinates') or ([p.get('latitude'), p.get('longitude')] if p.get('latitude') else None)
    c_str = str(coords) if coords else "None"
    print(f"{p.get('id'):<32} | {p.get('name'):<35} | {p.get('type'):<15} | {c_str:<22} | {p.get('regionKey')}")
