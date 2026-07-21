import { useMemo, useState } from "react";
import { usePlansData } from "./hooks/usePlansData";
import { useBupyeongBoundary } from "./hooks/useBupyeongBoundary";
import { usePlanBoundaries } from "./hooks/usePlanBoundaries";
import { useFirestoreSync } from "./hooks/useFirestoreSync";
import { useViewOnlyMode } from "./hooks/useViewOnlyMode";
import { useRankingStore } from "./store/rankingStore";
import { RankingTable } from "./components/ranking/RankingTable";
import { MapView } from "./components/map/MapView";
import { MapBoundaryControl } from "./components/map/MapBoundaryControl";
import { PlanDetailPanel } from "./components/detail/PlanDetailPanel";
import { WeightPanel } from "./components/filters/WeightPanel";
import { SyncSetup } from "./components/filters/SyncSetup";
import { PartyStatus } from "./components/filters/PartyStatus";
import "./App.css";

function App() {
  const { data, isLoading, error } = usePlansData();
  const { data: adminBoundary } = useBupyeongBoundary();
  const { data: committedBoundaries } = usePlanBoundaries();
  const selectedId = useRankingStore((s) => s.selectedId);
  const [mapExpanded, setMapExpanded] = useState(false);
  const { readOnly } = useViewOnlyMode();
  useFirestoreSync();

  const features = useMemo(
    () =>
      (data?.features ?? []).filter(
        (f) =>
          f.properties.시군구 === "부평구" &&
          !f.properties.대략가격대.startsWith("해당없음")
      ),
    [data]
  );
  const selectedFeature = useMemo(
    () => features.find((f) => f.properties.id === selectedId) ?? null,
    [features, selectedId]
  );

  if (isLoading) {
    return <div className="app__status">불러오는 중…</div>;
  }
  if (error) {
    return (
      <div className="app__status app__status--error">
        데이터를 불러오지 못했습니다: {(error as Error).message}
        <br />
        (npm run sync-data 로 geo/plans.geojson 을 먼저 동기화했는지 확인하세요)
      </div>
    );
  }

  return (
    <div className={`app ${mapExpanded ? "app--map-expanded" : ""}`}>
      <header className="app__header">
        <div className="app__header-row">
          <h1>인천 부평구 정비사업 투자매력도 순위표</h1>
          <div className="app__header-controls">
            <PartyStatus />
            <WeightPanel />
            <SyncSetup />
          </div>
        </div>
        <p className="app__subtitle">
          1982년~현재 국토종합계획·수도권정비계획 위계 속에서 부평구 정비사업의 투자
          매력도(쌀수록, 기대이익이 클수록, 실현이 빠를수록 높은 점수)를 A~F 6요소로
          스코어링합니다. 실거래가·갭투자 분석은{" "}
          <a href="https://hogangnono.com" target="_blank" rel="noopener noreferrer">
            호갱노노
          </a>
          를 함께 활용하세요.
        </p>
      </header>
      <div className="app__body">
        <div className="app__left">
          <RankingTable features={features} />
        </div>
        <div className="app__right">
          <div className="app__map">
            <MapView
              features={features}
              adminBoundary={adminBoundary}
              committedBoundaries={committedBoundaries}
            />
            {!readOnly && <MapBoundaryControl />}
            <button
              type="button"
              className="app__map-expand-toggle"
              onClick={() => setMapExpanded((v) => !v)}
            >
              {mapExpanded ? "지도 원래 크기로 ⤡" : "지도 크게 보기 ⤢"}
            </button>
          </div>
          <div className="app__detail">
            <PlanDetailPanel feature={selectedFeature} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
