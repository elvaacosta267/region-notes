// 카카오맵 JS SDK 전용 코드를 이 파일에만 국한한다. 점수 계산·필터링 로직(store, lib)과
// 지도 렌더링을 분리해서 설계했으니, 나중에 지도 라이브러리를 다시 바꿀 때도 이 파일만
// 새로 작성하면 된다.
import { useEffect, useMemo, useRef } from "react";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { useRankingStore } from "../../store/rankingStore";
import { loadKakaoMaps } from "../../lib/kakaoMapLoader";
import "./MapView.css";

// 인천 부평구 중심 근사 좌표 (파일럿 지역 기본 뷰)
const BUPYEONG_CENTER = { lat: 37.5, lng: 126.72 };
const DEFAULT_LEVEL = 10; // 카카오맵 레벨: 숫자가 작을수록 확대. 정확한 위치보다 "대충 인천 어디쯤"이 목적이라 넓게 잡음
const SELECTED_LEVEL = 3;

function scoreToDiameter(score: number): number {
  // 0~100 점수를 12~32px 지름으로 매핑 (기존 Leaflet 반지름 6~16px과 동일한 비율)
  return 12 + (score / 100) * 20;
}

export function MapView({ features }: { features: PlanFeature[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);

  const scoredById = useMemo(() => {
    const ranked = rankPlans(features, weights);
    return new Map(ranked.map((sp) => [sp.feature.properties.id, sp]));
  }, [features, weights]);

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: new kakao.maps.LatLng(BUPYEONG_CENTER.lat, BUPYEONG_CENTER.lng),
        level: DEFAULT_LEVEL,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = features.map((feature) => {
        const p = feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const scored = scoredById.get(p.id);
        const isSelected = p.id === selectedId;
        const size = scoreToDiameter(scored?.score ?? 0);

        const el = document.createElement("div");
        el.className = "map-view__marker";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.background = p.color;
        el.style.borderColor = isSelected ? "#111827" : "#fff";
        el.style.borderWidth = isSelected ? "2.5px" : "1.5px";
        el.title = p.사업명;
        el.addEventListener("click", () => selectPlan(p.id));

        const overlay = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(lat, lng),
          content: el,
          yAnchor: 0.5,
        });
        overlay.setMap(map);
        return overlay;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [features, scoredById, selectedId, selectPlan]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const feature = features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates;
    const position = new kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(position);
    mapRef.current.setLevel(SELECTED_LEVEL);
  }, [selectedId, features]);

  return <div ref={containerRef} className="map-view" />;
}
