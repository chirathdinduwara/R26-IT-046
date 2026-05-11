from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, List, Tuple


TARGET_DIVISIONS = {
    "Colombo",
    "Dehiwala",
    "Homagama",
    "Kaduwela",
    "Kesbewa",
    "Kolonnawa",
    "Maharagama",
    "Moratuwa",
    "Padukka",
    "Ratmalana",
    "Seethawaka",
    "Sri Jayawardenepura Kotte",
    "Thimbirigasyaya",
}


ALIAS_MAP = {
    "colombo": "Colombo",
    "dehiwala": "Dehiwala",
    "homagama": "Homagama",
    "kaduwela": "Kaduwela",
    "kesbewa": "Kesbewa",
    "kolonnawa": "Kolonnawa",
    "maharagama": "Maharagama",
    "moratuwa": "Moratuwa",
    "padukka": "Padukka",
    "ratmalana": "Ratmalana",
    "seethawaka": "Seethawaka",
    "seethawaka urban": "Seethawaka",
    "sri jayawardenepura kotte": "Sri Jayawardenepura Kotte",
    "thimbirigasyaya": "Thimbirigasyaya",
}


def _normalize_name(text: str) -> str:
    return re.sub(r"\s+", " ", str(text).strip().lower())


def _detect_property_keys(properties: Dict[str, object]) -> Tuple[str | None, str | None]:
    keys = list(properties.keys())
    district_key = None
    division_key = None
    for key in keys:
        lowered = key.lower()
        if district_key is None and lowered in {"name_2", "district", "adm2_name"}:
            district_key = key
        if division_key is None and lowered in {"name_3", "division", "adm3_name"}:
            division_key = key
    if district_key is None and "NAME_2" in properties:
        district_key = "NAME_2"
    if division_key is None and "NAME_3" in properties:
        division_key = "NAME_3"
    return district_key, division_key


def _canonical_division(raw_name: str) -> str | None:
    normalized = _normalize_name(raw_name)
    return ALIAS_MAP.get(normalized)


def build_colombo_divisions_geojson(gadm_geojson_path: Path) -> Dict[str, object]:
    data = json.loads(gadm_geojson_path.read_text(encoding="utf-8"))
    features = data.get("features", [])
    if not features:
        raise ValueError("Input GeoJSON has no features.")

    first_properties = features[0].get("properties", {})
    district_key, division_key = _detect_property_keys(first_properties)
    if district_key is None or division_key is None:
        raise ValueError("Could not detect district/division property keys from GeoJSON.")

    selected_features: List[Dict[str, object]] = []
    seen = set()
    for feature in features:
        properties = feature.get("properties", {})
        district = str(properties.get(district_key, "")).strip()
        if district.lower() != "colombo":
            continue
        raw_division = str(properties.get(division_key, "")).strip()
        canonical_name = _canonical_division(raw_division)
        if canonical_name is None:
            continue
        if canonical_name in seen:
            continue

        new_properties = {"division_name": canonical_name, "source_division_name": raw_division}
        selected_features.append(
            {
                "type": "Feature",
                "properties": new_properties,
                "geometry": feature.get("geometry"),
            }
        )
        seen.add(canonical_name)

    missing = TARGET_DIVISIONS.difference(seen)
    if missing:
        missing_str = ", ".join(sorted(missing))
        raise ValueError(f"Missing expected divisions in GeoJSON filter result: {missing_str}")

    return {"type": "FeatureCollection", "features": selected_features}


def _build_postgis_sql(colombo_geojson: Dict[str, object]) -> str:
    lines = [
        "CREATE EXTENSION IF NOT EXISTS postgis;",
        "CREATE TABLE IF NOT EXISTS division_geometry (",
        "    division_name TEXT PRIMARY KEY,",
        "    geom geometry(MultiPolygon, 4326) NOT NULL",
        ");",
        "DELETE FROM division_geometry;",
    ]

    for feature in colombo_geojson["features"]:
        division_name = feature["properties"]["division_name"].replace("'", "''")
        geometry_json = json.dumps(feature["geometry"], separators=(",", ":")).replace("'", "''")
        lines.append(
            "INSERT INTO division_geometry (division_name, geom) VALUES "
            f"('{division_name}', ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON('{geometry_json}'), 4326)));"
        )
    lines.append("CREATE INDEX IF NOT EXISTS idx_division_geometry_geom ON division_geometry USING GIST (geom);")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Filter GADM Sri Lanka level-3 boundaries for Colombo district divisions.")
    parser.add_argument("--input", required=True, help="Path to GADM Sri Lanka level-3 GeoJSON.")
    parser.add_argument(
        "--output-geojson",
        default=str(Path("backend") / "artifacts" / "colombo_divisions.geojson"),
        help="Output GeoJSON path for 13 Colombo divisions.",
    )
    parser.add_argument(
        "--output-sql",
        default=str(Path("backend") / "artifacts" / "division_geometry.sql"),
        help="Output SQL file for PostGIS inserts.",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    output_geojson = Path(args.output_geojson)
    output_sql = Path(args.output_sql)
    output_geojson.parent.mkdir(parents=True, exist_ok=True)
    output_sql.parent.mkdir(parents=True, exist_ok=True)

    colombo_geojson = build_colombo_divisions_geojson(input_path)
    output_geojson.write_text(json.dumps(colombo_geojson, ensure_ascii=False, indent=2), encoding="utf-8")
    output_sql.write_text(_build_postgis_sql(colombo_geojson), encoding="utf-8")
    print(f"Wrote {len(colombo_geojson['features'])} division polygons to {output_geojson}")
    print(f"Wrote PostGIS SQL to {output_sql}")


if __name__ == "__main__":
    main()
