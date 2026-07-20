#!/usr/bin/env python3
"""app/src/components/filters/BoundaryExport.tsx의 "직접 그린 경계 내보내기" 버튼으로
내보낸 JSON({"planId": [{"lat":.., "lng":..}, ...], ...})을 geo/plan_boundaries.geojson에
병합해 넣는다. 기존에 커밋돼 있던 다른 사업 id는 그대로 두고, 이번 내보내기에 포함된
id만 덮어쓴다(upsert) — 내보내기는 항상 이 PC의 localStorage 전체를 담고 있으므로 이렇게
해도 안전하고, 여러 번 반복 실행해도 항상 최신 상태로 수렴한다.

사용법:
    python3 tools/import_plan_boundaries.py <내보낸 JSON 파일 경로>
    python3 tools/build_geo.py 는 필요 없음(경계는 plans.geojson과 별도 파일) —
    대신 app/에서 npm run sync-data 로 app/public/data/에 반영해야 한다.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT = REPO_ROOT / "geo" / "plan_boundaries.geojson"


def to_feature(plan_id: str, points: list[dict]) -> dict:
    # GeoJSON 폴리곤 스펙(RFC 7946)은 링이 첫 점=마지막 점으로 닫혀 있어야 한다.
    ring = [[p["lng"], p["lat"]] for p in points]
    ring.append(ring[0])
    return {
        "type": "Feature",
        "properties": {"id": plan_id},
        "geometry": {"type": "Polygon", "coordinates": [ring]},
    }


def main() -> None:
    if len(sys.argv) != 2:
        print("사용법: python3 tools/import_plan_boundaries.py <내보낸 JSON 파일 경로>", file=sys.stderr)
        sys.exit(1)

    new_boundaries = json.loads(Path(sys.argv[1]).read_text())

    if OUTPUT.exists():
        existing = json.loads(OUTPUT.read_text())
    else:
        existing = {"type": "FeatureCollection", "features": []}

    features_by_id = {f["properties"]["id"]: f for f in existing["features"]}

    skipped = []
    for plan_id, points in new_boundaries.items():
        if len(points) < 3:
            skipped.append((plan_id, len(points)))
            continue
        features_by_id[plan_id] = to_feature(plan_id, points)

    existing["features"] = list(features_by_id.values())
    OUTPUT.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n")

    print(f"[완료] {len(new_boundaries) - len(skipped)}건 반영 -> {OUTPUT} (전체 {len(existing['features'])}건)")
    for plan_id, n in skipped:
        print(f"[건너뜀] {plan_id}: 점 {n}개뿐 (폴리곤은 3개 이상 필요)", file=sys.stderr)


if __name__ == "__main__":
    main()
