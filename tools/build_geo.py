#!/usr/bin/env python3
"""
db/plans.csv 를 읽어 geo/plans.geojson 과 geo/plans.kml 을 재생성한다.
tools/feasibility.py 의 실현가능성 raw factor(A~F)도 함께 GeoJSON properties에 병합한다.

사용법:
    python3 tools/build_geo.py

의존성: 표준 라이브러리만 사용 (csv, json, xml). 별도 설치 불필요.
"""
import csv
import json
import os
import re
import sys
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from feasibility import compute_all  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "db", "plans.csv")
GEOJSON_PATH = os.path.join(ROOT, "geo", "plans.geojson")
KML_PATH = os.path.join(ROOT, "geo", "plans.kml")
UPDATES_DIR = os.path.join(ROOT, "updates")

# updates/YYYY-MM-DD.md 안의 "- [id: P306] 요약" + 바로 아래 "  - 출처: URL" 줄을 파싱한다
# (형식은 updates/README.md 템플릿과 반드시 일치해야 함).
UPDATE_FILENAME_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")
UPDATE_ID_BULLET_RE = re.compile(r"^-\s*\[id:\s*([^\]]+)\]\s*(.+)$")
UPDATE_SOURCE_RE = re.compile(r"^\s*-\s*출처:\s*(\S+)")

# 사업유형별 색상 (지도/KML 스타일용) — db/schema.md 의 사업유형 값과 1:1 대응
CATEGORY_COLOR = {
    "신도시(공공주택지구)": "#2563eb",   # blue
    "택지개발": "#2563eb",              # blue (신도시와 동일 계열)
    "광역교통": "#dc2626",              # red
    "재건축(노후계획도시)": "#059669",   # green
    "재개발": "#d97706",                # amber
    "재건축(도시정비법)": "#ea580c",     # orange
    "주거환경개선": "#0891b2",           # cyan
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


def load_update_log(updates_dir=UPDATES_DIR):
    """updates/YYYY-MM-DD.md 파일들을 파싱해 plan id별 가장 최근 업데이트 항목을 만든다.
    파일명 날짜 오름차순으로 훑으면서 같은 id가 다시 나오면 더 최신 파일 쪽으로 덮어쓴다."""
    latest = {}
    if not os.path.isdir(updates_dir):
        return latest
    filenames = sorted(f for f in os.listdir(updates_dir) if UPDATE_FILENAME_RE.match(f))
    for filename in filenames:
        date = UPDATE_FILENAME_RE.match(filename).group(1)
        with open(os.path.join(updates_dir, filename), encoding="utf-8") as f:
            lines = f.readlines()
        pending = None  # (id, summary), 출처 줄을 기다리는 중
        for line in lines:
            id_match = UPDATE_ID_BULLET_RE.match(line.strip())
            if id_match:
                pending = (id_match.group(1).strip(), id_match.group(2).strip())
                continue
            source_match = UPDATE_SOURCE_RE.match(line)
            if source_match and pending:
                pid, summary = pending
                latest[pid] = {
                    "date": date,
                    "summary": summary,
                    "source_url": source_match.group(1),
                }
                pending = None
    return latest


def to_geojson(rows):
    scores = compute_all(rows)
    update_log = load_update_log()
    features = []
    skipped = 0
    for row in rows:
        lat_raw, lng_raw = row.get("lat", "").strip(), row.get("lng", "").strip()
        if not lat_raw or not lng_raw:
            skipped += 1
            continue
        try:
            lat, lng = float(lat_raw), float(lng_raw)
        except ValueError:
            skipped += 1
            continue
        props = {k: v for k, v in row.items() if k not in ("lat", "lng")}
        props["color"] = CATEGORY_COLOR.get(row.get("사업유형", ""), DEFAULT_COLOR)

        pid = row.get("id", "").strip()
        factors = scores.get(pid, {})
        for key, factor in factors.items():
            # A_stage_index/A_stage_total처럼 {value, basis} 쌍이 아니라 순수 값 하나만
            # 담긴 항목(진척도 타일 렌더링용)은 그대로 복사한다.
            if isinstance(factor, dict) and "value" in factor:
                props[key] = factor["value"]
                props[f"{key}_basis"] = factor["basis"]
            else:
                props[key] = factor

        update = update_log.get(pid, {})
        props["최신업데이트일"] = update.get("date", "")
        props["최신업데이트요약"] = update.get("summary", "")
        props["최신업데이트출처URL"] = update.get("source_url", "")

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
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
        name = escape(p.get("사업명", p.get("id", "")))
        desc_lines = []
        for key in ("사업유형", "근거법", "시도", "시군구", "읍면동", "현재단계",
                    "단계상세", "지연여부", "예타상태", "대략가격대",
                    "출처URL", "최근확인일", "비고"):
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
    <name>국토개발계획 투자포인트 추적</name>{''.join(placemarks)}
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
