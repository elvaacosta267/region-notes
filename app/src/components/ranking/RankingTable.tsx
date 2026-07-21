import { useMemo, useState } from "react";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { naverSearchUrl, naverLandMapUrl } from "../../lib/naverSearchLink";
import { officialZoneLabel } from "../../lib/officialZoneLabel";
import { commitNameOverride, planDisplayName, planShortDisplayName } from "../../lib/planDisplayName";
import { priceShortLabel } from "../../lib/priceShortLabel";
import { isRecentUpdate } from "../../lib/recentUpdate";
import { useRankingStore } from "../../store/rankingStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
import { useViewOnlyMode } from "../../hooks/useViewOnlyMode";
import "./RankingTable.css";

const GRADE_CLASS: Record<string, string> = {
  상: "grade--high",
  중: "grade--mid",
  하: "grade--low",
};

// "예상완공시기"는 원문에 준공 예정일 자체가 없어 대부분 "확인필요"만 뜨는 컬럼이었다 —
// 대신 사업유형별 전체 단계 수(A_stage_total) 만큼 타일을 그리고 현재 단계(A_stage_index)
// 까지 채워서 "완공까지 얼마나 남았는지"가 아니라 "전체 절차 중 어디쯤인지"를 보여준다.
function StageProgressTiles({
  index,
  total,
  color,
}: {
  index: number;
  total: number;
  color: string;
}) {
  return (
    <div className="ranking-table__stage-tiles" title={`${index}/${total}단계`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="ranking-table__stage-tile"
          style={{
            borderColor: color,
            background: i < index ? color : "transparent",
          }}
        />
      ))}
    </div>
  );
}

export function RankingTable({ features }: { features: PlanFeature[] }) {
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);
  const nameOverrides = usePlanOverrideStore((s) => s.nameOverrides);
  const setNameOverride = usePlanOverrideStore((s) => s.setNameOverride);
  const clearNameOverride = usePlanOverrideStore((s) => s.clearNameOverride);
  const { readOnly } = useViewOnlyMode();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const commitEdit = (planId: string, officialName: string) => {
    commitNameOverride(planId, officialName, nameDraft, setNameOverride, clearNameOverride);
    setEditingId(null);
  };

  const ranked = useMemo(() => rankPlans(features, weights), [features, weights]);

  // 점수가 같으면 같은 순위(공동 순위)로 표기한다 — 표준 경쟁 순위 방식이라
  // 동점자 다음 순위는 동점자 수만큼 건너뛴다(예: 공동 1위가 7건이면 다음은 8위).
  // ranked는 이미 점수 내림차순 정렬돼 있으므로, 바로 앞 항목과 점수가 같으면
  // 순위를 그대로 이어받고 다르면 "지금까지 몇 건 지났는지"(i+1)로 갱신한다.
  const displayRanks = useMemo(() => {
    const ranks: number[] = [];
    ranked.forEach((sp, i) => {
      ranks.push(i > 0 && sp.score === ranked[i - 1].score ? ranks[i - 1] : i + 1);
    });
    return ranks;
  }, [ranked]);

  // 같은 지정표기(대표지번 기반)를 쓰는 사업이 2건 이상이면 동일지번 중복등재
  // 후보로 보고 표시한다 — 예: 갈산동64-12 / 갈산동 64-12번지 일원.
  const zoneLabelCounts = useMemo(() => {
    const counts = new Map<string, number>();
    ranked.forEach((sp) => {
      const label = officialZoneLabel(sp.feature.properties.비고);
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    });
    return counts;
  }, [ranked]);

  return (
    <div className="ranking-table__wrap">
      <div className="ranking-table__count">
        전체 {ranked.length}건 (점수순 정렬, 상위 일부만 자르지 않고 전체 표시)
      </div>
      <table className="ranking-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>사업명</th>
            <th>동</th>
            <th>사업유형</th>
            <th>현재단계</th>
            <th>점수</th>
            <th>등급</th>
            <th>기간</th>
            <th>대략가격대</th>
            <th>진척도</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((sp, i) => {
            const p = sp.feature.properties;
            const isSelected = p.id === selectedId;
            const zoneLabel = officialZoneLabel(p.비고);
            const isDuplicateZone = zoneLabel ? (zoneLabelCounts.get(zoneLabel) ?? 0) > 1 : false;
            const name = planDisplayName(p.id, p.사업명, nameOverrides);
            const hasRecentUpdate = isRecentUpdate(p.최신업데이트일);
            return (
              <tr
                key={p.id}
                className={isSelected ? "ranking-table__row--selected" : ""}
                onClick={() => selectPlan(p.id)}
              >
                <td>{displayRanks[i]}</td>
                <td className="ranking-table__name">
                  <span className="ranking-table__name-row">
                    <span className="ranking-table__dot" style={{ background: p.color }} />
                    {editingId === p.id && !readOnly ? (
                      <input
                        className="ranking-table__name-input"
                        value={nameDraft}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(p.id, p.사업명);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => commitEdit(p.id, p.사업명)}
                      />
                    ) : (
                      <>
                        <span title={name}>{planShortDisplayName(name)}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            className="ranking-table__name-edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNameDraft(name);
                              setEditingId(p.id);
                            }}
                            title="이름 수정"
                            aria-label="이름 수정"
                          >
                            ✏️
                          </button>
                        )}
                      </>
                    )}
                    {hasRecentUpdate && (
                      <a
                        className="ranking-table__update-badge"
                        href={p.최신업데이트출처URL || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title={`${p.최신업데이트일} 업데이트: ${p.최신업데이트요약}`}
                      >
                        🆕 업데이트
                      </a>
                    )}
                  </span>
                  {zoneLabel && (
                    <div
                      className={
                        isDuplicateZone
                          ? "ranking-table__zone-label ranking-table__zone-label--duplicate"
                          : "ranking-table__zone-label"
                      }
                      title={isDuplicateZone ? "다른 사업과 지정표기가 동일 — 동일지번 중복등재 의심" : undefined}
                    >
                      {zoneLabel}
                      {isDuplicateZone && " ⚠️"}
                    </div>
                  )}
                </td>
                <td>{p.읍면동 || p.시군구}</td>
                <td>{p.사업유형}</td>
                <td>{p.현재단계}</td>
                <td className="ranking-table__score">{sp.score.toFixed(1)}</td>
                <td>
                  <span className={`ranking-table__grade ${GRADE_CLASS[sp.grade]}`}>
                    {sp.grade}
                  </span>
                </td>
                <td>{sp.investmentHorizon}</td>
                <td className="ranking-table__price" title={p.대략가격대}>
                  {priceShortLabel(p.대략가격대)}
                </td>
                <td>
                  <StageProgressTiles index={p.A_stage_index} total={p.A_stage_total} color={p.color} />
                </td>
                <td className="ranking-table__links">
                  <a
                    href={naverSearchUrl(name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ranking-table__link"
                  >
                    네이버 검색 ↗
                  </a>
                  <a
                    href={naverLandMapUrl(
                      sp.feature.geometry.coordinates[1],
                      sp.feature.geometry.coordinates[0]
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ranking-table__link"
                  >
                    네이버 매물지도 ↗
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
