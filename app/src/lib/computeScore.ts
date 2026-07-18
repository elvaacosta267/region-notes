import type { FeasibilityWeights, Grade, PlanFeature, ScoredPlan } from "./types";

// score = 100 × (wA×A + wB×B + wC×C + wD×D + wE×E + wF×F) / (wA+wB+wC+wD+wE+wF)
// 분모로 정규화해서, 슬라이더로 가중치를 자유롭게 조절해도(합이 1이 아니어도)
// 점수가 항상 0~100 범위를 유지하도록 한다. 가중치는 UI(WeightPanel)에서 언제든
// 바뀔 수 있으므로, 원본 데이터(raw factor)는 절대 수정하지 않고 이 함수에서
// 그때그때 재계산한다.
export function computeScore(feature: PlanFeature, weights: FeasibilityWeights): number {
  const p = feature.properties;
  const weightSum =
    weights.A_stage_progress +
    weights.B_pretest +
    weights.C_delay +
    weights.D_infra +
    weights.E_price_attractiveness +
    weights.F_upside_potential;
  if (weightSum <= 0) return 0;
  const raw =
    p.A_stage_progress * weights.A_stage_progress +
    p.B_pretest * weights.B_pretest +
    p.C_delay * weights.C_delay +
    p.D_infra * weights.D_infra +
    p.E_price_attractiveness * weights.E_price_attractiveness +
    p.F_upside_potential * weights.F_upside_potential;
  return Math.round((raw / weightSum) * 100 * 10) / 10;
}

export function computeGrade(score: number): Grade {
  if (score >= 80) return "상";
  if (score >= 50) return "중";
  return "하";
}

// 사업단계 진척률(A)에서 파생 — 낮으면 호재가 아직 시장에 덜 반영된 장기 후보,
// 높으면 이미 반영됐을 가능성이 큰 단기(매도 타이밍 판단 필요) 후보.
export function computeInvestmentHorizon(feature: PlanFeature): "장기" | "중기" | "단기" {
  const a = feature.properties.A_stage_progress;
  if (a < 0.3) return "장기";
  if (a < 0.7) return "중기";
  return "단기";
}

export function scorePlan(feature: PlanFeature, weights: FeasibilityWeights): ScoredPlan {
  const score = computeScore(feature, weights);
  return {
    feature,
    score,
    grade: computeGrade(score),
    investmentHorizon: computeInvestmentHorizon(feature),
  };
}

export function rankPlans(features: PlanFeature[], weights: FeasibilityWeights): ScoredPlan[] {
  return features
    .map((f) => scorePlan(f, weights))
    .sort((a, b) => b.score - a.score);
}
