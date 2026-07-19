import { useMemo } from "react";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { naverSearchUrl } from "../../lib/naverSearchLink";
import { officialZoneLabel } from "../../lib/officialZoneLabel";
import { planDisplayName } from "../../lib/planDisplayName";
import { isRecentUpdate } from "../../lib/recentUpdate";
import { useRankingStore } from "../../store/rankingStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
import "./RankingTable.css";

const GRADE_CLASS: Record<string, string> = {
  상: "grade--high",
  중: "grade--mid",
  하: "grade--low",
};

export function RankingTable({ features }: { features: PlanFeature[] }) {
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);
  const nameOverrides = usePlanOverrideStore((s) => s.nameOverrides);

  const ranked = useMemo(() => rankPlans(features, weights), [features, weights]);

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
            <th>예상완공시기</th>
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
                <td>{i + 1}</td>
                <td className="ranking-table__name">
                  <span className="ranking-table__name-row">
                    <span className="ranking-table__dot" style={{ background: p.color }} />
                    {name}
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
                <td>{p.대략가격대}</td>
                <td className="ranking-table__completion">{p.예상완공시기}</td>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
