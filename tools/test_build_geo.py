#!/usr/bin/env python3
"""
build_geo.py 스모크 테스트. db/plans.csv 의 모든 행이 좌표 누락 없이
GeoJSON으로 변환되는지, 실현가능성 raw factor(A~F)가 채워지는지 확인한다.

사용법:
    python3 tools/test_build_geo.py

의존성: 표준 라이브러리(unittest)만 사용.
"""
import csv
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_geo import CSV_PATH, load_update_log, to_geojson  # noqa: E402


class BuildGeoSmokeTest(unittest.TestCase):
    def setUp(self):
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            self.rows = list(csv.DictReader(f))
        self.geojson = to_geojson(self.rows)

    def test_no_rows_skipped(self):
        csv_ids = {r["id"] for r in self.rows if r.get("lat", "").strip() and r.get("lng", "").strip()}
        feature_ids = {f["properties"]["id"] for f in self.geojson["features"]}
        missing = csv_ids - feature_ids
        self.assertEqual(missing, set(), f"좌표가 있는데 GeoJSON에서 빠진 id: {missing}")

    def test_every_feature_has_valid_color(self):
        for feat in self.geojson["features"]:
            color = feat["properties"].get("color")
            self.assertTrue(color and color.startswith("#"), f"{feat['properties'].get('id')} 색상 누락: {color}")

    def test_every_feature_has_feasibility_factors(self):
        required = [
            "A_stage_progress", "B_pretest", "C_delay", "D_infra",
            "E_price_attractiveness", "F_upside_potential",
        ]
        for feat in self.geojson["features"]:
            props = feat["properties"]
            for key in required:
                self.assertIn(key, props, f"{props.get('id')} 에 {key} 없음")
                self.assertIn(f"{key}_basis", props, f"{props.get('id')} 에 {key}_basis 없음")
                self.assertIsInstance(props[key], float, f"{props.get('id')} 의 {key} 값이 float 아님: {props[key]!r}")

    def test_feasibility_values_in_range(self):
        required = [
            "A_stage_progress", "B_pretest", "C_delay", "D_infra",
            "E_price_attractiveness", "F_upside_potential",
        ]
        for feat in self.geojson["features"]:
            props = feat["properties"]
            for key in required:
                v = props[key]
                self.assertGreaterEqual(v, 0.0)
                self.assertLessEqual(v, 1.0)

    def test_bupyeong_sample_present(self):
        feature_ids = {f["properties"]["id"] for f in self.geojson["features"]}
        self.assertIn("P333", feature_ids, "부평구 갈산1구역(P333)이 GeoJSON에 없음")

    def test_every_feature_has_update_fields(self):
        for feat in self.geojson["features"]:
            props = feat["properties"]
            for key in ("최신업데이트일", "최신업데이트요약", "최신업데이트출처URL"):
                self.assertIn(key, props, f"{props.get('id')} 에 {key} 없음")

    def test_every_feature_has_stage_index_and_total(self):
        for feat in self.geojson["features"]:
            props = feat["properties"]
            self.assertIn("A_stage_index", props, f"{props.get('id')} 에 A_stage_index 없음")
            self.assertIn("A_stage_total", props, f"{props.get('id')} 에 A_stage_total 없음")
            idx, total = props["A_stage_index"], props["A_stage_total"]
            self.assertGreaterEqual(idx, 1, f"{props.get('id')} A_stage_index < 1: {idx}")
            self.assertLessEqual(idx, total, f"{props.get('id')} A_stage_index > A_stage_total: {idx}/{total}")


class UpdateLogParsingTest(unittest.TestCase):
    """updates/YYYY-MM-DD.md 파싱 로직(updates/README.md 템플릿 형식) 검증."""

    def test_parses_latest_entry_per_id_across_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            with open(os.path.join(tmp, "2026-07-01.md"), "w", encoding="utf-8") as f:
                f.write(
                    "# 2026-07-01 업데이트\n\n"
                    "## 변경 사항\n"
                    "- [id: P306] 청천4구역 — 추진위승인\n"
                    "  - 출처: https://example.go.kr/notice/1\n"
                )
            with open(os.path.join(tmp, "2026-07-15.md"), "w", encoding="utf-8") as f:
                f.write(
                    "# 2026-07-15 업데이트\n\n"
                    "## 변경 사항\n"
                    "- [id: P306] 청천4구역 — 조합설립인가 취득\n"
                    "  - 출처: https://example.go.kr/notice/2\n"
                )
            result = load_update_log(updates_dir=tmp)
            self.assertEqual(result["P306"]["date"], "2026-07-15")
            self.assertEqual(result["P306"]["source_url"], "https://example.go.kr/notice/2")
            self.assertIn("조합설립인가", result["P306"]["summary"])

    def test_missing_updates_dir_returns_empty(self):
        result = load_update_log(updates_dir="/nonexistent/path/xyz")
        self.assertEqual(result, {})


if __name__ == "__main__":
    unittest.main()
