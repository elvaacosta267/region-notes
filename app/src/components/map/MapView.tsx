// Leaflet 전용 API(react-leaflet, leaflet)를 이 파일에만 국한한다.
// 나중에 카카오맵 등으로 지도 라이브러리를 교체할 때 이 파일만 새로 작성하면 되도록
// 점수 계산·필터링 로직(store, lib)과 지도 렌더링을 분리해서 설계했다.
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { useRankingStore } from "../../store/rankingStore";
import "./MapView.css";

// 인천 부평구 중심 근사 좌표 (파일럿 지역 기본 뷰)
const BUPYEONG_CENTER: [number, number] = [37.5, 126.72];
const DEFAULT_ZOOM = 13;

function scoreToRadius(score: number): number {
  // 0~100 점수를 6~16px 반지름으로 매핑
  return 6 + (score / 100) * 10;
}

function FlyToSelected({ features }: { features: PlanFeature[] }) {
  const map = useMap();
  const selectedId = useRankingStore((s) => s.selectedId);

  useEffect(() => {
    if (!selectedId) return;
    const feature = features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates;
    map.flyTo([lat, lng], 15, { duration: 0.6 });
  }, [selectedId, features, map]);

  return null;
}

export function MapView({ features }: { features: PlanFeature[] }) {
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);

  const scoredById = useMemo(() => {
    const ranked = rankPlans(features, weights);
    return new Map(ranked.map((sp) => [sp.feature.properties.id, sp]));
  }, [features, weights]);

  return (
    <MapContainer
      center={BUPYEONG_CENTER}
      zoom={DEFAULT_ZOOM}
      className="map-view"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <FlyToSelected features={features} />
      {features.map((feature) => {
        const p = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const scored = scoredById.get(p.id);
        const isSelected = p.id === selectedId;
        return (
          <CircleMarker
            key={p.id}
            center={[lat, lng]}
            radius={scoreToRadius(scored?.score ?? 0)}
            pathOptions={{
              color: isSelected ? "#111827" : "#fff",
              weight: isSelected ? 2.5 : 1.5,
              fillColor: p.color,
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => selectPlan(p.id) }}
          >
            <Popup>
              <div className="map-view__popup">
                <div className="map-view__popup-title">{p.사업명}</div>
                <div>{p.사업유형} · {p.현재단계}</div>
                <div>점수 {scored?.score.toFixed(1)} ({scored?.grade})</div>
                <div>{p.대략가격대}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
