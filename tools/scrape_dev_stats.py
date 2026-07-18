"""
인천시 추정분담금 정보시스템의 "사업개요" 팝업(공개, 조합원 로그인 불필요)에서
구역면적/건축면적/동수/세대수/건폐율/용적률을 가져와 db/plans.csv에 채운다.

주의: 이 시스템은 실제 "추정분담금"(조합원별 분담금 액수)은 조합원 전용
로그인 뒤에서만 제공한다 — 그건 개인 조합원 권리정보라 이 스크립트로도,
어떤 방법으로도 공개 스크래핑 대상이 아니다. 여기서 가져오는 건 그와
무관한 사업 개요(면적·세대수·용적률 등 공개 정보)뿐이다.

사용법:
    python3 tools/scrape_dev_stats.py

의존성: 표준 라이브러리만 사용.
"""
import csv
import os
import re
import ssl
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "db", "plans.csv")
POPUP_URL = "https://renewal.incheon.go.kr/html/pop/pop_overview.do?busi_ara_id={}"

# db/plans.csv의 id -> 인천시 시스템 내부 busi_ara_id.
# renewal.incheon.go.kr 정비사업 검색(지역=부평구, 사업유형=전체)의 각 행 "보기"
# 버튼 onclick(openPopup_schMap)에서 사업명으로 매칭해 수작업으로 채집(2026-07-19).
ARA_ID_BY_PLAN_ID = {
    "P301": "BARA_0000000000519", "P302": "BARA_0000000000521",
    "P303": "BARA_0000000000491", "P304": "BARA_0000000000465",
    "P305": "BARA_0000000000135", "P306": "BARA_0000000000461",
    "P307": "BARA_0000000000542", "P308": "BARA_0000000000518",
    "P309": "BARA_0000000000464", "P310": "BARA_0000000000114",
    "P311": "BARA_0000000000310", "P312": "BARA_0000000000112",
    "P313": "BARA_0000000000121", "P314": "BARA_0000000000132",
    "P315": "BARA_0000000000131", "P316": "BARA_0000000000119",
    "P317": "BARA_0000000000128", "P318": "BARA_0000000000127",
    "P319": "BARA_0000000000110", "P320": "BARA_0000000000109",
    "P321": "BARA_0000000000462", "P322": "BARA_0000000000528",
    "P323": "BARA_0000000000105", "P324": "BARA_0000000000104",
    "P325": "BARA_0000000000460", "P326": "BARA_0000000000123",
    "P327": "BARA_0000000000122", "P328": "BARA_0000000000457",
    "P329": "BARA_0000000000459", "P330": "BARA_0000000000458",
    "P331": "BARA_0000000000552", "P332": "BARA_0000000000547",
    "P333": "BARA_0000000000099",
}

# 검색 목록의 "보기" 버튼 onclick(openPopup_schMap)에 두 번째 인자(사업개요 id)가
# 비어있던 사업 — 사이트 자체가 "작성된 사업개요가 없습니다"라며 팝업을 안 띄운다.
# fetch를 시도하면 서버가 500을 반환하므로 아예 건너뛴다.
NO_OVERVIEW = {"P301", "P307", "P308", "P331", "P332"}

FIELD_MAP = {
    "구역면적(m²)": "구역면적",  # 단위(㎡)는 컬럼명이 아니라 db/schema.md에 문서화
    "건축면적(㎡)": "건축면적",  # (㎡가 TypeScript 식별자에 못 쓰이는 문자라 컬럼명에서 뺌)
    "동수": "동수",
    "세대수": "세대수",
    "건폐율(%)": "건폐율",
    "용적율(%)": "용적률",  # 원문 사이트 표기가 "용적율"(률이 아님)
}

_SYSTEM_CA_BUNDLE = "/etc/ssl/cert.pem"
_SSL_CONTEXT = (
    ssl.create_default_context(cafile=_SYSTEM_CA_BUNDLE)
    if os.path.exists(_SYSTEM_CA_BUNDLE)
    else ssl.create_default_context()
)

ROW_RE = re.compile(r"<th>([^<]+)</th>\s*<td[^>]*>([^<]*)</td>")

# 사업개요 페이지 자체가 아직 설계가 안 나온 초기단계(정비구역후보지 등) 사업에
# 빈 값 대신 "0"/"1" 같은 자리표시자를 그대로 내보낸다(예: 세대수=1, 동수=0,
# 건폐율=0 인데 구역면적만 진짜 숫자). 이런 자리표시자를 실측치처럼 저장하지
# 않기 위해 걸러낸다.
def _num(s: str) -> float:
    try:
        return float(s.replace(",", ""))
    except (TypeError, ValueError):
        return 0.0


def clean_stats(stats: dict[str, str]) -> dict[str, str]:
    area = _num(stats.get("구역면적", ""))
    if area < 100:
        # 구역면적 자체가 비현실적으로 작음(예: "2") -> 페이지 전체가 미기재 상태
        return {}
    building_fields = ["건축면적", "동수", "세대수", "건폐율", "용적률"]
    if (
        _num(stats.get("세대수", "")) <= 1
        and _num(stats.get("동수", "")) == 0
        and _num(stats.get("건축면적", "")) == 0
        and _num(stats.get("건폐율", "")) == 0
    ):
        # 설계 미확정 자리표시자(세대수 0/1, 동수·건축면적·건폐율 0) -> 구역면적만 남기고 제거
        return {k: v for k, v in stats.items() if k not in building_fields}
    return stats


def fetch_stats(ara_id: str) -> dict[str, str]:
    req = urllib.request.Request(
        POPUP_URL.format(ara_id), headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=10, context=_SSL_CONTEXT) as resp:
        html = resp.read().decode("utf-8", errors="replace")
    stats = {}
    for label, value in ROW_RE.findall(html):
        label = label.strip()
        if label in FIELD_MAP:
            stats[FIELD_MAP[label]] = value.strip()
    return clean_stats(stats)


def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys())

    new_cols = list(FIELD_MAP.values())
    for col in new_cols:
        if col not in fieldnames:
            fieldnames.append(col)

    updated = 0
    for row in rows:
        for col in new_cols:
            row[col] = ""  # 재실행 시 이전 값이 남지 않도록 매번 초기화
        pid = row["id"]
        if pid in NO_OVERVIEW:
            print(f"[정보없음] {pid} {row['사업명']}: 원문 사이트에 사업개요 미등록")
            continue
        ara_id = ARA_ID_BY_PLAN_ID.get(pid)
        if not ara_id:
            continue
        try:
            stats = fetch_stats(ara_id)
        except Exception as e:
            print(f"[오류] {pid} {row['사업명']}: {e}")
            continue
        time.sleep(0.15)
        if not stats:
            print(f"[정보없음] {pid} {row['사업명']}: 사업개요 필드 없음(초기단계 정비구역후보지 등)")
            continue
        for col, val in stats.items():
            row[col] = val
        print(f"[갱신] {pid} {row['사업명']}: {stats}")
        updated += 1

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n완료: {updated}건 갱신")


if __name__ == "__main__":
    main()
