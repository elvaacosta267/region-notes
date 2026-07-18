"""
db/plans.csv의 인천 부평구 행(현재 동 단위 근사좌표 공유)을 카카오 로컬 API로
필지 단위(지번) 좌표로 재계산해 lat/lng을 덮어쓴다.

사용법:
    export $(cat .env | xargs)   # KAKAO_REST_API_KEY 로드
    python3 tools/geocode_kakao.py

같은 동 안 여러 사업이 좌표를 공유해 지도에서 겹쳐 보이는 문제(예: 산곡동 5개
재개발구역)를 해결하기 위한 1회성 배치 스크립트다. 비고란의 "대표지번: ..."
텍스트를 파싱해 검색 주소를 만든다. 카카오가 매칭 못 하는 주소는 기존 좌표를
그대로 두고 경고만 출력한다(허위 좌표를 만들지 않기 위함).
"""

import csv
import os
import re
import ssl
import sys
import time
import urllib.request
import urllib.parse
import json

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "db", "plans.csv")
API_URL = "https://dapi.kakao.com/v2/local/search/address.json"

# 이 저장소를 다루는 샌드박스 macOS 환경에서 Python이 시스템 CA 번들을 못 찾아
# urlopen이 SSL 인증서 체인 검증에 실패하는 경우가 있다(curl은 시스템 키체인을
# 참조해 정상 동작). 존재하면 시스템 번들을 명시적으로 사용한다.
_SYSTEM_CA_BUNDLE = "/etc/ssl/cert.pem"
_SSL_CONTEXT = (
    ssl.create_default_context(cafile=_SYSTEM_CA_BUNDLE)
    if os.path.exists(_SYSTEM_CA_BUNDLE)
    else ssl.create_default_context()
)

ADDR_PATTERN = re.compile(r"대표지번:\s*([^.(]+)")
FILLER_SUFFIXES = ["번지 일원", "일원", "번지"]


def extract_address(remark: str) -> str | None:
    m = ADDR_PATTERN.search(remark)
    if not m:
        return None
    addr = m.group(1).strip()
    for suffix in FILLER_SUFFIXES:
        if addr.endswith(suffix):
            addr = addr[: -len(suffix)].strip()
            break
    return addr


def geocode(api_key: str, query: str) -> tuple[float, float] | None:
    url = API_URL + "?" + urllib.parse.urlencode({"query": query})
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {api_key}"})
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CONTEXT) as resp:
            data = json.load(resp)
    except Exception as e:
        print(f"  [오류] API 호출 실패: {e}")
        return None
    docs = data.get("documents", [])
    if not docs:
        return None
    doc = docs[0]
    return float(doc["y"]), float(doc["x"])  # lat, lng


def main():
    api_key = os.environ.get("KAKAO_REST_API_KEY")
    if not api_key:
        print("KAKAO_REST_API_KEY 환경변수가 없습니다. `.env`를 export 했는지 확인하세요.")
        sys.exit(1)

    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = rows[0].keys() if rows else []

    updated = 0
    skipped = 0
    for row in rows:
        if row["시군구"] != "부평구":
            continue
        addr = extract_address(row["비고"])
        if not addr:
            print(f"[건너뜀] {row['id']} {row['사업명']}: 비고에서 대표지번을 못 찾음")
            skipped += 1
            continue
        query = f"인천 부평구 {addr}"
        result = geocode(api_key, query)
        time.sleep(0.15)
        if result is None:
            print(f"[미매칭] {row['id']} {row['사업명']}: '{query}' 검색결과 없음 (기존 좌표 유지)")
            skipped += 1
            continue
        lat, lng = result
        print(f"[갱신] {row['id']} {row['사업명']}: ({row['lat']},{row['lng']}) -> ({lat},{lng})")
        row["lat"] = f"{lat:.6f}"
        row["lng"] = f"{lng:.6f}"
        updated += 1

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n완료: {updated}건 갱신, {skipped}건 건너뜀")


if __name__ == "__main__":
    main()
