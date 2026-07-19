import type { PlanFeature } from "../../lib/types";
import { computeScore, computeGrade, computeInvestmentHorizon } from "../../lib/computeScore";
import { naverSearchUrl } from "../../lib/naverSearchLink";
import { useRankingStore } from "../../store/rankingStore";
import { useBoundaryStore } from "../../store/boundaryStore";
import "./PlanDetailPanel.css";

const FACTOR_ROWS: { key: keyof PlanFeature["properties"]; basisKey: keyof PlanFeature["properties"]; label: string }[] = [
  { key: "A_stage_progress", basisKey: "A_stage_progress_basis", label: "A. 사업단계 진척률" },
  { key: "B_pretest", basisKey: "B_pretest_basis", label: "B. 예타상태" },
  { key: "C_delay", basisKey: "C_delay_basis", label: "C. 지연여부" },
  { key: "D_infra", basisKey: "D_infra_basis", label: "D. 인프라연계" },
  { key: "E_price_attractiveness", basisKey: "E_price_attractiveness_basis", label: "E. 투자금 매력도" },
  { key: "F_upside_potential", basisKey: "F_upside_potential_basis", label: "F. 잔여 개발이익 여력" },
];

export function PlanDetailPanel({ feature }: { feature: PlanFeature | null }) {
  const weights = useRankingStore((s) => s.weights);
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const drawingPlanId = useBoundaryStore((s) => s.drawingPlanId);
  const draftPoints = useBoundaryStore((s) => s.draftPoints);
  const startDrawing = useBoundaryStore((s) => s.startDrawing);
  const undoLastPoint = useBoundaryStore((s) => s.undoLastPoint);
  const finishDrawing = useBoundaryStore((s) => s.finishDrawing);
  const cancelDrawing = useBoundaryStore((s) => s.cancelDrawing);
  const clearBoundary = useBoundaryStore((s) => s.clearBoundary);

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
      <div className="plan-detail__completion">예상완공시기: {p.예상완공시기}</div>

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

      {p.구역면적 && (
        <div className="plan-detail__dev-stats">
          <p className="plan-detail__dev-stats-hint">
            개발이익 참고정보 — 조합원 추정분담금(로그인 전용, 미공개)이 아니라 공개
            사업개요입니다. 초기단계 사업은 세대수·용적률이 아직 미확정일 수 있습니다.
          </p>
          <dl className="plan-detail__fields">
            <dt>구역면적 / 건축면적</dt>
            <dd>{p.구역면적}㎡{p.건축면적 && ` / ${p.건축면적}㎡`}</dd>
            {p.세대수 && (
              <>
                <dt>동수 / 세대수</dt>
                <dd>{p.동수}개동 / {p.세대수}세대</dd>
              </>
            )}
            {p.건폐율 && (
              <>
                <dt>건폐율 / 용적률</dt>
                <dd>{p.건폐율}% / {p.용적률}%</dd>
              </>
            )}
          </dl>
        </div>
      )}

      <div className="plan-detail__boundary">
        {drawingPlanId === p.id ? (
          <>
            <p className="plan-detail__dev-stats-hint">
              지도를 클릭해 구역 경계를 도로를 따라 순서대로 찍어주세요 ({draftPoints.length}개
              점, 완료하려면 3개 이상 필요 — 점 개수 제한 없음, 필요한 만큼 계속 찍으세요).
              지적도가 아니라 눈대중으로 그리는 참고용 경계입니다.
            </p>
            <div className="plan-detail__boundary-actions">
              <button onClick={undoLastPoint} disabled={draftPoints.length === 0}>
                마지막 점 취소
              </button>
              <button onClick={finishDrawing} disabled={draftPoints.length < 3}>
                완료
              </button>
              <button onClick={cancelDrawing}>그리기 취소</button>
            </div>
          </>
        ) : boundaries[p.id] ? (
          <div className="plan-detail__boundary-actions">
            <span>구역 경계: 직접 그린 경계 있음 ({boundaries[p.id].length}개 점)</span>
            <button onClick={() => startDrawing(p.id)}>다시 그리기</button>
            <button onClick={() => clearBoundary(p.id)}>삭제</button>
          </div>
        ) : (
          <div className="plan-detail__boundary-actions">
            <span>구역 경계: 아직 없음(지도에 점만 표시 중)</span>
            <button onClick={() => startDrawing(p.id)}>경계 그리기</button>
          </div>
        )}
      </div>

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
        <a href={naverSearchUrl(p.사업명)} target="_blank" rel="noopener noreferrer">
          네이버에서 검색 ↗
        </a>
      </div>
    </div>
  );
}
