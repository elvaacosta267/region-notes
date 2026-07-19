#!/usr/bin/env python3
"""
인천 부평구 행정동 경계(22개 동)를 vuski/admdongkor 저장소(통계청 SGIS 공공누리
제1유형 원자료를 가공, CC BY 4.0)에서 내려받아 db/plans.csv의 부평구 사업들과
같은 지역만 추려 geo/bupyeong_boundary.geojson 으로 저장한다.

이 프로젝트는 "구역 경계는 실제 좌표가 없으면 만들지 않는다"는 원칙(CLAUDE.md,
카카오맵이 지적도 폴리곤을 안 줘서 사용자가 손으로 그리는 것도 같은 이유)을 따른다 —
부평구 전체의 행정구역 경계는 임의로 근사하지 않고, 이렇게 실제 공개 데이터를 받아온다.

사용법:
    python3 tools/fetch_bupyeong_boundary.py
    python3 tools/build_geo.py   # app이 읽는 위치로 동기화하려면 npm run sync-data도 실행

출처(재배포 시 유지해야 함, LICENSE-DATA 참고):
"본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서
 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor,
 https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다."

의존성: 표준 라이브러리만 사용.
"""
import json
import os
import ssl
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(ROOT, "geo", "bupyeong_boundary.geojson")

# admdongkor는 버전(날짜)별 디렉터리를 쓴다 — 최신본으로 갱신하려면 이 URL만 바꾸면 됨.
SOURCE_URL = (
    "https://raw.githubusercontent.com/vuski/admdongkor/master/"
    "ver20260701/HangJeongDong_ver20260701.geojson"
)
TARGET_SIDO = "인천광역시"
TARGET_SGG = "부평구"

# urlopen이 SSL 인증서 체인 검증에 실패하는 경우가 있다(curl은 시스템 키체인을
# 쓰는데 파이썬은 자체 인증서 목록을 써서 생기는 macOS 환경 문제) — geocode_kakao.py와
# 동일하게 시스템 CA 번들이 있으면 그걸 우선 사용한다.
_SYSTEM_CA_BUNDLE = "/etc/ssl/cert.pem"
_SSL_CONTEXT = (
    ssl.create_default_context(cafile=_SYSTEM_CA_BUNDLE)
    if os.path.exists(_SYSTEM_CA_BUNDLE)
    else ssl.create_default_context()
)


def main():
    print(f"[다운로드] {SOURCE_URL}")
    req = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "region-notes/1.0"})
    with urllib.request.urlopen(req, timeout=120, context=_SSL_CONTEXT) as resp:
        data = json.load(resp)

    features = [
        f
        for f in data["features"]
        if f["properties"].get("sidonm") == TARGET_SIDO
        and f["properties"].get("sggnm") == TARGET_SGG
    ]
    if not features:
        print(f"[오류] {TARGET_SIDO} {TARGET_SGG} 행정동을 찾지 못함", file=sys.stderr)
        sys.exit(1)

    out = {
        "type": "FeatureCollection",
        "name": "bupyeong_boundary",
        "attribution": (
            "통계청 SGIS(공공누리 1유형) 원자료를 vuski/admdongkor가 가공, CC BY 4.0. "
            "https://github.com/vuski/admdongkor"
        ),
        "features": features,
    }
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"[완료] {OUTPUT_PATH} ({len(features)}개 행정동)")


if __name__ == "__main__":
    main()
