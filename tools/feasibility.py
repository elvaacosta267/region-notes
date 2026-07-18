#!/usr/bin/env python3
"""
db/plans.csv 각 행에 대해 실현가능성 판별 4요소(A~D) + 투자금 매력도(E)를
개별 {value, basis} 쌍으로 산출한다. 가중치는 여기서 곱하지 않는다 —
가중치가 바뀌어도 이 원자료를 다시 만들 필요가 없도록, 가중합 계산은
app/src/lib/computeScore.ts(프론트)가 담당한다.

사용법:
    from tools.feasibility import compute_all
    scores = compute_all(rows)  # rows: csv.DictReader가 만든 dict 리스트

의존성: 표준 라이브러리만 사용.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE_SEQ_PATH = os.path.join(ROOT, "db", "stage_sequences.json")

# 예타상태 → 0~1 매핑. "해당없음"은 구조적으로 예타 비대상(공공주택특별법 지구지정,
# 도시정비법 조합사업 등)인 경우가 대부분이라 감점 사유로 보지 않고 중립값을 준다.
PRETEST_MAP = [
    ("통과", 1.0),
    ("면제", 0.9),
    ("조사중", 0.5),
    ("미실시", 0.2),
    ("해당없음", 0.6),
]

# 대략가격대 구간 → 0~1 매핑(낮을수록 소액투자에 유리 = 높은 점수).
# "(추정)" 접미사가 붙어도 startswith 매칭되도록 접두어만 비교한다.
PRICE_TIER_MAP = [
    ("1천만원대~5천만원대", 1.0),
    ("5천만원대~1억", 0.85),
    ("1억~2억", 0.65),
    ("2억~3억", 0.4),
    ("3억+", 0.15),
]


def load_stage_sequences():
    with open(STAGE_SEQ_PATH, encoding="utf-8") as f:
        data = json.load(f)
    data.pop("_comment", None)
    return data


def compute_stage_progress(사업유형, 현재단계, stage_sequences):
    seq = stage_sequences.get(사업유형)
    if not seq:
        return 0.5, f"사업유형 '{사업유형}'에 대한 단계 시퀀스 없음 → 0.5 기본값"
    if 현재단계 not in seq:
        return 0.5, f"현재단계 '{현재단계}'가 '{사업유형}' 시퀀스에 없음 → 0.5 기본값"
    idx = seq.index(현재단계)
    denom = len(seq) - 1
    value = idx / denom if denom > 0 else 1.0
    return round(value, 3), f"현재단계={현재단계}, 전체 {len(seq)}단계 중 {idx + 1}번째 → {value:.2f}"


def compute_pretest(예타상태):
    s = (예타상태 or "").strip()
    for prefix, val in PRETEST_MAP:
        if s.startswith(prefix):
            note = "구조적으로 예타 비대상, 감점 아님" if prefix == "해당없음" else ""
            basis = f"예타상태={s} → {val}" + (f" ({note})" if note else "")
            return val, basis
    return 0.5, f"예타상태 값 인식 불가({s}) → 0.5 기본값"


def compute_delay(지연여부):
    s = (지연여부 or "").strip()
    if s.startswith("Y"):
        return 0.3, f"지연여부={s} → 0.3"
    label = s if s else "N(정보없음)"
    return 1.0, f"지연여부={label} → 1.0 (지연 없음 또는 미확인, 미확인은 지연 없음으로 간주)"


def compute_price_attractiveness(대략가격대):
    s = (대략가격대 or "").strip()
    if s.startswith("해당없음"):
        return 0.5, f"대략가격대={s} → 매매시장 아님(분양/인프라사업), 중립값 0.5"
    if s.startswith("확인필요"):
        return 0.5, f"대략가격대={s} → 미조사, 중립값 0.5"
    for prefix, val in PRICE_TIER_MAP:
        if s.startswith(prefix):
            return val, f"대략가격대={s} → {val} (가격 낮을수록 소액투자 매력도 높음)"
    return 0.5, f"대략가격대 값 인식 불가({s}) → 0.5 기본값"


def compute_infra(인프라연계id, abc_by_id):
    ids = [x.strip() for x in (인프라연계id or "").split(";") if x.strip()]
    if not ids:
        return 0.7, "인프라연계id 없음 → 데이터 미비를 벌점화하지 않기 위해 중립값 0.7"
    linked_scores = []
    for pid in ids:
        if pid in abc_by_id:
            a, b, c = abc_by_id[pid]
            linked_scores.append((a + b + c) / 3)
    if not linked_scores:
        return 0.7, f"인프라연계id={인프라연계id} 이지만 대상 사업을 찾을 수 없음 → 중립값 0.7"
    value = sum(linked_scores) / len(linked_scores)
    return round(value, 3), f"연계사업 {ids} 의 (진척률+예타+지연) 평균 → {value:.2f}"


def compute_all(rows):
    """rows: db/plans.csv를 csv.DictReader로 읽은 dict 리스트.
    반환: {id: {"A_stage_progress": {...}, "B_pretest": {...}, "C_delay": {...},
               "D_infra": {...}, "E_price_attractiveness": {...}}}
    """
    stage_sequences = load_stage_sequences()

    # 1차 패스: D(인프라연계)가 참조할 A/B/C를 먼저 전부 계산
    abc_by_id = {}
    partial = {}
    for row in rows:
        pid = row.get("id", "").strip()
        if not pid:
            continue
        a_val, a_basis = compute_stage_progress(row.get("사업유형", ""), row.get("현재단계", ""), stage_sequences)
        b_val, b_basis = compute_pretest(row.get("예타상태", ""))
        c_val, c_basis = compute_delay(row.get("지연여부", ""))
        abc_by_id[pid] = (a_val, b_val, c_val)
        partial[pid] = {
            "A_stage_progress": {"value": a_val, "basis": a_basis},
            "B_pretest": {"value": b_val, "basis": b_basis},
            "C_delay": {"value": c_val, "basis": c_basis},
        }

    # 2차 패스: D, E 계산
    result = {}
    for row in rows:
        pid = row.get("id", "").strip()
        if not pid:
            continue
        d_val, d_basis = compute_infra(row.get("인프라연계id", ""), abc_by_id)
        e_val, e_basis = compute_price_attractiveness(row.get("대략가격대", ""))
        result[pid] = dict(partial[pid])
        result[pid]["D_infra"] = {"value": d_val, "basis": d_basis}
        result[pid]["E_price_attractiveness"] = {"value": e_val, "basis": e_basis}

    return result
