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

  A_stage_progress: number;
  A_stage_progress_basis: string;
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

// A(확실성)와 F(잔여 개발이익 여력)는 서로 반대 방향으로 움직이는 별개의 축이라 동일
// 가중치를 준다 — "실현가능성"과 "상승여력"을 하나의 순위표 안에서 같이 반영하기 위함
// (진척률이 높을수록 안전하지만 이미 가격에 반영돼 상승여력은 작다는 전제, F_upside_potential
// 은 1 - A_stage_progress 로 계산됨, tools/feasibility.py 참고).
export const DEFAULT_WEIGHTS: FeasibilityWeights = {
  A_stage_progress: 0.2,
  B_pretest: 0.2,
  C_delay: 0.15,
  D_infra: 0.1,
  E_price_attractiveness: 0.15,
  F_upside_potential: 0.2,
};

export type Grade = "상" | "중" | "하";

export interface ScoredPlan {
  feature: PlanFeature;
  score: number;
  grade: Grade;
  investmentHorizon: "장기" | "중기" | "단기";
}
