// geo/plans.geojson 의 실제 properties 구조와 1:1 대응한다.
// tools/build_geo.py / tools/feasibility.py 의 출력 필드가 바뀌면 여기도 같이 바꿔야
// 컴파일 타임에 스키마 불일치를 잡을 수 있다 (db/plans.csv의 lat/lng 컬럼명 버그 재발 방지).

export interface PlanProperties {
  id: string;
  사업유형: string;
  사업명: string;
  근거법: string;
  상위계획: string;
  지정주체: string;
  시도: string;
  시군구: string;
  읍면동: string;
  최초계획연도: string;
  현재단계: string;
  단계상세: string;
  지연여부: string;
  예타상태: string;
  최근확인일: string;
  출처URL: string;
  비고: string;
  인프라연계id: string;
  대략가격대: string;
  color: string;

  // 개발이익 참고용 규모 정보 — 부평구 재개발/재건축에만 있고 나머지는 빈 문자열.
  // 실제 조합원 추정분담금이 아니라 공개 사업개요(면적·세대수·용적률)일 뿐이다.
  // tools/scrape_dev_stats.py, db/schema.md 참고.
  구역면적: string; // 단위 ㎡
  건축면적: string; // 단위 ㎡
  동수: string;
  세대수: string;
  건폐율: string;
  용적률: string;
  // 착공일 + 공사기간 가정(30개월)으로 추정한 값 — 원문에 예상 준공일 자체가 없어
  // 이 저장소가 직접 계산한 추정치다. 착공일 미확인 사업은 "확인필요(...)" 문자열.
  예상완공시기: string;

  // updates/YYYY-MM-DD.md(업데이트 루프 로그, 수동 또는 예약 에이전트가 작성)를
  // build_geo.py가 파싱해서 채우는 필드 — 값이 있으면 실제 뉴스/고시 기반 변경이 있었다는
  // 뜻이고, 없으면(빈 문자열) 아직 이 사업에 대한 로그 항목이 없다는 뜻이다.
  최신업데이트일: string;
  최신업데이트요약: string;
  최신업데이트출처URL: string;

  A_stage_progress: number;
  A_stage_progress_basis: string;
  // 순위표 "진척도" 열(단계 타일)이 쓰는 값 — 사업유형별 전체 단계 수 중 현재 몇 번째인지.
  A_stage_index: number;
  A_stage_total: number;
  B_pretest: number;
  B_pretest_basis: string;
  C_delay: number;
  C_delay_basis: string;
  D_infra: number;
  D_infra_basis: string;
  E_price_attractiveness: number;
  E_price_attractiveness_basis: string;
  F_upside_potential: number;
  F_upside_potential_basis: string;
}

export interface PlanFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: PlanProperties;
}

export interface PlansGeoJSON {
  type: "FeatureCollection";
  features: PlanFeature[];
}

export const FEASIBILITY_FACTOR_KEYS = [
  "A_stage_progress",
  "B_pretest",
  "C_delay",
  "D_infra",
  "E_price_attractiveness",
  "F_upside_potential",
] as const;

export type FeasibilityFactorKey = (typeof FEASIBILITY_FACTOR_KEYS)[number];

export interface FeasibilityWeights {
  A_stage_progress: number;
  B_pretest: number;
  C_delay: number;
  D_infra: number;
  E_price_attractiveness: number;
  F_upside_potential: number;
}

// 이 앱의 목적은 "실현가능성 자체"가 아니라 "투자 매력도"다 — 매력도는
// (1) 쌀수록 좋고(E) (2) 싼 것 중에서도 기대이익(잔여 상승여력)이 높을수록
// 좋고(F) (3) 그 중에서도 실현이 빠를수록 좋다(A)는 우선순위를 가진다.
// B/C/D(예타·지연·인프라)는 매력도를 끌어올리는 요소가 아니라 "이 사업이
// 무산되지 않을까"를 거르는 리스크 필터라서 가중치를 낮게 둔다 — A를 B/C/D와
// 동급으로 취급하면 다시 "확실성이 곧 매력도"로 되돌아가 버리므로 주의.
export const DEFAULT_WEIGHTS: FeasibilityWeights = {
  A_stage_progress: 0.15,
  B_pretest: 0.15,
  C_delay: 0.1,
  D_infra: 0.05,
  E_price_attractiveness: 0.3,
  F_upside_potential: 0.25,
};

export type Grade = "상" | "중" | "하";

export interface ScoredPlan {
  feature: PlanFeature;
  score: number;
  grade: Grade;
  investmentHorizon: "장기" | "중기" | "단기";
}
