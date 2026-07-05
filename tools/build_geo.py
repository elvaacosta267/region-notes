#!/usr/bin/env python3
"""
db/plans.csv 를 읽어 geo/plans.geojson 과 geo/plans.kml 을 재생성한다.

사용법:
    python3 tools/build_geo.py

의존성: 표준 라이브러리만 사용 (csv, json, xml). 별도 설치 불필요.
"""
import csv
import json
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "db", "plans.csv")
GEOJSON_PATH = os.path.join(ROOT, "geo", "plans.geojson")
KML_PATH = os.path.join(ROOT, "geo", "plans.kml")

# 카테고리별 색상 (지도/KML 스타일용)
CATEGORY_COLOR = {
    "3기신도시": "#2563eb",   # blue
    "GTX": "#dc2626",         # red
    "1기선도지구": "#059669", # green
    "정비사업": "#d97706",    # amber
    "광역계획": "#7c3aed",    # purple
}
DEFAULT_COLOR = "#6b7280"  # gray


def load_rows():
    if not os.path.exists(CSV_PATH):
        print(f"[오류] {CSV_PATH} 를 찾을 수 없습니다.", file=sys.stderr)
        sys.exit(1)
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows


def to_geojson(rows):
    features = []
    skipped = 0
    for row in rows:
        lat_raw, lon_raw = row.get("lat", "").strip(), row.get("lon", "").strip()
        if not lat_raw or not lon_raw:
            skipped += 1
            continue
        try:
            lat, lon = float(lat_raw), float(lon_raw)
        except ValueError:
            skipped += 1
            continue
        props = {k: v for k, v in row.items() if k not in ("lat", "lon")}
        props["color"] = CATEGORY_COLOR.get(row.get("category", ""), DEFAULT_COLOR)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": props,
        })
    if skipped:
        print(f"[경고] 좌표 누락/오류로 {skipped}건 제외됨")
    return {"type": "FeatureCollection", "features": features}


def to_kml(geojson):
    placemarks = []
    for feat in geojson["features"]:
        p = feat["properties"]
        lon, lat = feat["geometry"]["coordinates"]
        name = escape(p.get("name", p.get("id", "")))
        desc_lines = []
        for key in ("category", "law_basis", "region", "stage_code", "stage_name",
                    "stage_date", "source_url", "last_updated", "note"):
            if p.get(key):
                desc_lines.append(f"{key}: {p.get(key)}")
        description = escape("\n".join(desc_lines))
        placemarks.append(f"""
    <Placemark>
      <name>{name}</name>
      <description>{description}</description>
      <Point><coordinates>{lon},{lat},0</coordinates></Point>
    </Placemark>""")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>수도권 개발계획 추적</name>{''.join(placemarks)}
  </Document>
</kml>
"""


def main():
    rows = load_rows()
    geojson = to_geojson(rows)
    os.makedirs(os.path.dirname(GEOJSON_PATH), exist_ok=True)

    with open(GEOJSON_PATH, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print(f"[완료] {GEOJSON_PATH} ({len(geojson['features'])}건)")

    kml = to_kml(geojson)
    with open(KML_PATH, "w", encoding="utf-8") as f:
        f.write(kml)
    print(f"[완료] {KML_PATH}")


if __name__ == "__main__":
    main()
