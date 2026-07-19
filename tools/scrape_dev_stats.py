"""
인천시 추정분담금 정보시스템의 "사업개요" 팝업(공개, 조합원 로그인 불필요)에서
구역면적/건축면적/동수/세대수/건폐율/용적률과 추진과정(단계별 실제 이력 날짜)을
가져와 db/plans.csv에 채운다. 추진과정의 착공일로부터 예상완공시기를 추정한다.

주의: 이 시스템은 실제 "추정분담금"(조합원별 분담금 액수)은 조합원 전용
로그인 뒤에서만 제공한다 — 그건 개인 조합원 권리정보라 이 스크립트로도,
어떤 방법으로도 공개 스크래핑 대상이 아니다. 여기서 가져오는 건 그와
무관한 사업 개요(면적·세대수·용적률·단계별 이력일자 등 공개 정보)뿐이다.

원문 시스템은 "예상 준공일"을 아예 제공하지 않는다 — 준공 전 사업은 준공란이
`[0000-00-00] 시기 미도래`로만 표시된다(실측 이력만 기록, 미래 예측 없음).
그래서 예상완공시기는 이 스크립트가 "착공일 + 평균 공사기간" 휴리스틱으로
직접 추정한 것이지 원문 데이터가 아니다 — CONSTRUCTION_MONTHS 참고.

정기적으로 재실행해야 최신 상태를 반영한다("수시 업데이트"는 자동화된 배경
작업이 아니라, 이 스크립트를 다시 돌리는 것 자체를 의미한다).

사용법:
    python3 tools/scrape_dev_stats.py

의존성: 표준 라이브러리만 사용.
"""
import csv
import datetime
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
STAGE_DATE_RE = re.compile(
    r'<div class="process">([^<]+)</div>.*?<td>\[(\d{4}-\d{2}-\d{2})\]</td>', re.S
)

# 재개발/재건축 대단지 착공~준공 평균 공사기간(개월). 국내 통상 30~36개월로
# 알려진 값 중 보수적으로 짧은 쪽을 취함 — 실제로는 개별 현장마다 크게 다르므로
# "예상완공시기" 값에는 항상 이 가정을 basis에 명시한다.
CONSTRUCTION_MONTHS = 30

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


def fetch_page(ara_id: str) -> str:
    req = urllib.request.Request(
        POPUP_URL.format(ara_id), headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=10, context=_SSL_CONTEXT) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_stats(html: str) -> dict[str, str]:
    stats = {}
    for label, value in ROW_RE.findall(html):
        label = label.strip()
        if label in FIELD_MAP:
            stats[FIELD_MAP[label]] = value.strip()
    return clean_stats(stats)


def parse_construction_date(html: str) -> str | None:
    for stage, date in STAGE_DATE_RE.findall(html):
        if stage.strip() == "착공" and date != "0000-00-00":
            return date
    return None


def estimate_completion(construction_date: str | None) -> str:
    if not construction_date:
        # 현재단계가 착공 이전이라 아직 안 정해졌을 수도, 착공 이후인데
        # 이 페이지의 추진과정 이력에 날짜가 비어있을 수도 있다 — 원인을
        # 단정하지 않는다.
        return "확인필요(착공일 정보 없음)"
    started = datetime.date.fromisoformat(construction_date)
    # 개월 단위 덧셈: 표준 라이브러리에 relativedelta가 없어 직접 계산
    month = started.month - 1 + CONSTRUCTION_MONTHS
    year = started.year + month // 12
    month = month % 12 + 1
    return f"{year}년 {month}월경(착공일 {construction_date} + {CONSTRUCTION_MONTHS}개월 추정)"


def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
        fieldnames = list(rows[0].keys())

    new_cols = list(FIELD_MAP.values()) + ["예상완공시기"]
    for col in new_cols:
        if col not in fieldnames:
            fieldnames.append(col)

    updated = 0
    for row in rows:
        for col in new_cols:
            row[col] = ""  # 재실행 시 이전 값이 남지 않도록 매번 초기화
        pid = row["id"]
        row["예상완공시기"] = "확인필요(원문 사업개요 없음)"
        if pid in NO_OVERVIEW:
            print(f"[정보없음] {pid} {row['사업명']}: 원문 사이트에 사업개요 미등록")
            continue
        ara_id = ARA_ID_BY_PLAN_ID.get(pid)
        if not ara_id:
            continue
        try:
            html = fetch_page(ara_id)
        except Exception as e:
            print(f"[오류] {pid} {row['사업명']}: {e}")
            continue
        time.sleep(0.15)

        if row["현재단계"] == "준공":
            row["예상완공시기"] = "준공됨"
        else:
            row["예상완공시기"] = estimate_completion(parse_construction_date(html))

        stats = parse_stats(html)
        if not stats:
            print(f"[정보없음] {pid} {row['사업명']}: 사업개요 필드 없음(초기단계 정비구역후보지 등)")
        else:
            for col, val in stats.items():
                row[col] = val
            print(f"[갱신] {pid} {row['사업명']}: {stats}")
        print(f"  예상완공시기: {row['예상완공시기']}")
        updated += 1

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n완료: {updated}건 갱신")


if __name__ == "__main__":
    main()
