import type { PlanFeature } from "../../lib/types";
import { computeScore, computeGrade, computeInvestmentHorizon } from "../../lib/computeScore";
import { hogangnonoSearchUrl } from "../../lib/hogangnonoLink";
import { naverLandSearchUrl } from "../../lib/naverLandLink";
import { useRankingStore } from "../../store/rankingStore";
import "./PlanDetailPanel.css";

const FACTOR_ROWS: { key: keyof PlanFeature["properties"]; basisKey: keyof PlanFeature["properties"]; label: string }[] = [
  { key: "A_stage_progress", basisKey: "A_stage_progress_basis", label: "A. 사업단계 진척률" },
  { key: "B_pretest", basisKey: "B_pretest_basis", label: "B. 예타상태" },
  { key: "C_delay", basisKey: "C_delay_basis", label: "C. 지연여부" },
  { key: "D_infra", basisKey: "D_infra_basis", label: "D. 인프라연계" },
  { key: "E_price_attractiveness", basisKey: "E_price_attractiveness_basis", label: "E. 투자금 매력도" },
];

export function PlanDetailPanel({ feature }: { feature: PlanFeature | null }) {
  const weights = useRankingStore((s) => s.weights);

  if (!feature) {
    return (
      <div className="plan-detail plan-detail--empty">
        순위표 또는 지도에서 사업을 선택하면 상세 근거가 여기 표시됩니다.
      </div>
    );
  }

  const p = feature.properties;
  const score = computeScore(feature, weights);
  const grade = computeGrade(score);
  const horizon = computeInvestmentHorizon(feature);

  return (
    <div className="plan-detail">
      <h2 className="plan-detail__title">{p.사업명}</h2>
      <div className="plan-detail__meta">
        {p.사업유형} · {p.시도} {p.시군구} {p.읍면동} · 현재단계: {p.현재단계}
      </div>
      <div className="plan-detail__score">
        종합점수 {score.toFixed(1)} <span className="plan-detail__grade">{grade}</span>
        <span className="plan-detail__horizon">{horizon} 투자 후보</span>
      </div>

      <table className="plan-detail__factors">
        <tbody>
          {FACTOR_ROWS.map((row) => (
            <tr key={row.key}>
              <td className="plan-detail__factor-label">{row.label}</td>
              <td className="plan-detail__factor-value">
                {Number(p[row.key]).toFixed(2)}
              </td>
              <td className="plan-detail__factor-basis">{String(p[row.basisKey])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="plan-detail__fields">
        <dt>대략가격대</dt>
        <dd>{p.대략가격대}</dd>
        <dt>단계상세</dt>
        <dd>{p.단계상세}</dd>
        <dt>지연여부</dt>
        <dd>{p.지연여부}</dd>
        <dt>예타상태</dt>
        <dd>{p.예타상태}</dd>
        <dt>상위계획 (정치·정책 맥락, 참고용)</dt>
        <dd>{p.상위계획}</dd>
        <dt>최근확인일</dt>
        <dd>{p.최근확인일}</dd>
        <dt>비고</dt>
        <dd>{p.비고}</dd>
      </dl>

      <div className="plan-detail__links">
        {p.출처URL && (
          <a href={p.출처URL} target="_blank" rel="noopener noreferrer">
            출처 원문 ↗
          </a>
        )}
        <a href={hogangnonoSearchUrl(p.사업명)} target="_blank" rel="noopener noreferrer">
          호갱노노에서 확인 ↗
        </a>
        <a href={naverLandSearchUrl(p.사업명)} target="_blank" rel="noopener noreferrer">
          네이버부동산에서 확인 ↗
        </a>
      </div>
    </div>
  );
}
