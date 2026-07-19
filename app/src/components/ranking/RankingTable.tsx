import { useMemo } from "react";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { naverSearchUrl } from "../../lib/naverSearchLink";
import { useRankingStore } from "../../store/rankingStore";
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

  const ranked = useMemo(() => rankPlans(features, weights), [features, weights]);

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
            return (
              <tr
                key={p.id}
                className={isSelected ? "ranking-table__row--selected" : ""}
                onClick={() => selectPlan(p.id)}
              >
                <td>{i + 1}</td>
                <td className="ranking-table__name">
                  <span className="ranking-table__dot" style={{ background: p.color }} />
                  {p.사업명}
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
                    href={naverSearchUrl(p.사업명)}
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
