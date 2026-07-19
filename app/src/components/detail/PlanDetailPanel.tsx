import { useEffect, useState } from "react";
import type { PlanFeature } from "../../lib/types";
import { computeScore, computeGrade, computeInvestmentHorizon } from "../../lib/computeScore";
import { naverSearchUrl } from "../../lib/naverSearchLink";
import { officialZoneLabel } from "../../lib/officialZoneLabel";
import { planDisplayName } from "../../lib/planDisplayName";
import { useRankingStore } from "../../store/rankingStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
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
  const nameOverrides = usePlanOverrideStore((s) => s.nameOverrides);
  const setNameOverride = usePlanOverrideStore((s) => s.setNameOverride);
  const clearNameOverride = usePlanOverrideStore((s) => s.clearNameOverride);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  // 다른 사업을 선택하면 편집 중이던 상태가 새 사업에 남아있으면 안 됨
  useEffect(() => {
    setEditingName(false);
  }, [feature?.properties.id]);

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
  const zoneLabel = officialZoneLabel(p.비고);
  const name = planDisplayName(p.id, p.사업명, nameOverrides);

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === p.사업명) {
      clearNameOverride(p.id);
    } else {
      setNameOverride(p.id, trimmed);
    }
    setEditingName(false);
  };

  return (
    <div className="plan-detail">
      <h2 className="plan-detail__title">
        {editingName ? (
          <input
            className="plan-detail__title-input"
            value={nameDraft}
            autoFocus
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") setEditingName(false);
            }}
            onBlur={commitName}
          />
        ) : (
          <>
            {name}
            <button
              type="button"
              className="plan-detail__title-edit"
              onClick={() => {
                setNameDraft(name);
                setEditingName(true);
              }}
              title="이름 수정"
              aria-label="이름 수정"
            >
              ✏️
            </button>
          </>
        )}
      </h2>
      {nameOverrides[p.id] && !editingName && (
        <div className="plan-detail__name-original">
          원래 표기: {p.사업명}{" "}
          <button
            type="button"
            className="plan-detail__name-reset"
            onClick={() => clearNameOverride(p.id)}
          >
            되돌리기
          </button>
        </div>
      )}
      <div className="plan-detail__meta">
        {p.사업유형} · {p.시도} {p.시군구} {p.읍면동} · 현재단계: {p.현재단계}
      </div>
      {zoneLabel && (
        <div className="plan-detail__zone-label">
          {zoneLabel}
          <span className="plan-detail__zone-label-hint">
            (지자체 지정 고시 관용 표기 — 같은 표기가 다른 사업에도 있으면 동일지번 중복등재 의심)
          </span>
        </div>
      )}
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
        <a href={naverSearchUrl(name)} target="_blank" rel="noopener noreferrer">
          네이버에서 검색 ↗
        </a>
      </div>
    </div>
  );
}
