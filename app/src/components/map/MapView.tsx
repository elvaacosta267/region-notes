// 카카오맵 JS SDK 전용 코드를 이 파일에만 국한한다. 점수 계산·필터링 로직(store, lib)과
// 지도 렌더링을 분리해서 설계했으니, 나중에 지도 라이브러리를 다시 바꿀 때도 이 파일만
// 새로 작성하면 된다.
import { useEffect, useMemo, useRef } from "react";
import type { PlanFeature } from "../../lib/types";
import { rankPlans } from "../../lib/computeScore";
import { useRankingStore } from "../../store/rankingStore";
import { useBoundaryStore } from "../../store/boundaryStore";
import { loadKakaoMaps } from "../../lib/kakaoMapLoader";
import "./MapView.css";

// 인천 부평구 중심 근사 좌표 (파일럿 지역 기본 뷰)
const BUPYEONG_CENTER = { lat: 37.5, lng: 126.72 };
const DEFAULT_LEVEL = 10; // 카카오맵 레벨: 숫자가 작을수록 확대. 정확한 위치보다 "대충 인천 어디쯤"이 목적이라 넓게 잡음
const SELECTED_LEVEL = 3;
const DRAWING_LEVEL = 1; // 경계를 도로 따라 한땀한땀 찍으려면 필지/도로가 구분되는 최대 확대가 필요

function scoreToDiameter(score: number): number {
  // 0~100 점수를 12~32px 지름으로 매핑 (기존 Leaflet 반지름 6~16px과 동일한 비율)
  return 12 + (score / 100) * 20;
}

export function MapView({ features }: { features: PlanFeature[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const boundaryPolygonsRef = useRef<KakaoPolygon[]>([]);
  const draftPolygonRef = useRef<KakaoPolygon | null>(null);
  const draftVertexMarkersRef = useRef<KakaoMarker[]>([]);
  const drawStartedForRef = useRef<string | null>(null);
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const drawingPlanId = useBoundaryStore((s) => s.drawingPlanId);
  const draftPoints = useBoundaryStore((s) => s.draftPoints);
  const addDraftPoint = useBoundaryStore((s) => s.addDraftPoint);
  const updateDraftPoint = useBoundaryStore((s) => s.updateDraftPoint);

  const scoredById = useMemo(() => {
    const ranked = rankPlans(features, weights);
    return new Map(ranked.map((sp) => [sp.feature.properties.id, sp]));
  }, [features, weights]);

  const colorById = useMemo(
    () => new Map(features.map((f) => [f.properties.id, f.properties.color])),
    [features]
  );

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

  // 사업 마커 — 직접 그린 경계가 있는 사업은 폴리곤이 위치를 대신 표시하므로
  // 원형 마커를 중복으로 띄우지 않는다(폴리곤 자체가 클릭 대상이 됨).
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = features
        .filter(
          (feature) =>
            feature.properties.id !== drawingPlanId && !boundaries[feature.properties.id]
        )
        .map((feature) => {
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
  }, [features, scoredById, selectedId, selectPlan, boundaries, drawingPlanId]);

  // 사용자가 직접 그린 구역 경계(폴리곤) — 카카오 지도 API가 지적도를 안 줘서
  // 대신 이 앱 안에서 손으로 그린 경계를 씀 (CLAUDE.md, store/boundaryStore.ts 참고).
  // 이 경계가 있는 사업은 원형 마커 대신 이 폴리곤이 클릭 대상이 된다.
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      boundaryPolygonsRef.current.forEach((poly) => poly.setMap(null));
      boundaryPolygonsRef.current = Object.entries(boundaries)
        .filter(([planId]) => planId !== drawingPlanId) // 그리는 중인 건 draft로 따로 렌더
        .map(([planId, points]) => {
          const color = colorById.get(planId) ?? "#6b7280";
          const isSelected = planId === selectedId;
          const polygon = new kakao.maps.Polygon({
            path: points.map((pt) => new kakao.maps.LatLng(pt.lat, pt.lng)),
            strokeWeight: isSelected ? 4 : 2,
            strokeColor: color,
            strokeOpacity: 0.9,
            fillColor: color,
            fillOpacity: 0.25,
          });
          polygon.setMap(map);
          kakao.maps.event.addListener(polygon, "click", () => selectPlan(planId));
          return polygon;
        });
    });
    return () => {
      cancelled = true;
    };
  }, [boundaries, colorById, drawingPlanId, selectedId, selectPlan]);

  // 그리는 중인 경계 미리보기
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      draftPolygonRef.current?.setMap(null);
      draftPolygonRef.current = null;
      if (!drawingPlanId || draftPoints.length === 0) return;
      const color = colorById.get(drawingPlanId) ?? "#2563eb";
      const polygon = new kakao.maps.Polygon({
        path: draftPoints.map((pt) => new kakao.maps.LatLng(pt.lat, pt.lng)),
        strokeWeight: 2,
        strokeColor: color,
        strokeOpacity: 1,
        fillColor: color,
        fillOpacity: 0.35,
      });
      polygon.setMap(mapRef.current);
      draftPolygonRef.current = polygon;
    });
    return () => {
      cancelled = true;
    };
  }, [drawingPlanId, draftPoints, colorById]);

  // 그리는 중인 점마다 드래그 가능한 마커를 얹어 특정 점만 위치 수정 가능하게 함
  // (전체를 다시 그릴 필요 없이 잘못 찍은 점 하나만 옮길 수 있음)
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      draftVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
      draftVertexMarkersRef.current = [];
      if (!drawingPlanId) return;
      draftVertexMarkersRef.current = draftPoints.map((pt, index) => {
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(pt.lat, pt.lng),
          draggable: true,
        });
        marker.setMap(mapRef.current);
        kakao.maps.event.addListener(marker, "dragend", () => {
          const pos = marker.getPosition();
          updateDraftPoint(index, { lat: pos.getLat(), lng: pos.getLng() });
        });
        return marker;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [drawingPlanId, draftPoints, updateDraftPoint]);

  // 그리기 시작 시점에만(다시 그리기 포함) 해당 사업 위치로 바짝 확대 —
  // 도로/필지 경계를 보고 정밀하게 점을 찍을 수 있어야 함. 그리는 도중
  // features가 갱신돼도 다시 확대/이동하면 사용자가 둘러본 화면이 튐.
  useEffect(() => {
    if (drawingPlanId && drawingPlanId !== drawStartedForRef.current && mapRef.current) {
      const feature = features.find((f) => f.properties.id === drawingPlanId);
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        mapRef.current.panTo(new kakao.maps.LatLng(lat, lng));
        mapRef.current.setLevel(DRAWING_LEVEL);
      }
    }
    drawStartedForRef.current = drawingPlanId;
  }, [drawingPlanId, features]);

  // 그리기 모드일 때 지도 클릭 -> 점 추가
  useEffect(() => {
    if (!drawingPlanId) return;
    let cancelled = false;
    let handler: ((e: KakaoMouseEvent) => void) | null = null;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      handler = (e) => addDraftPoint({ lat: e.latLng.getLat(), lng: e.latLng.getLng() });
      kakao.maps.event.addListener(mapRef.current, "click", handler);
    });
    return () => {
      cancelled = true;
      if (handler && mapRef.current) {
        kakao.maps.event.removeListener(mapRef.current, "click", handler);
      }
    };
  }, [drawingPlanId, addDraftPoint]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || drawingPlanId) return;
    const feature = features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates;
    const position = new kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(position);
    mapRef.current.setLevel(SELECTED_LEVEL);
  }, [selectedId, features, drawingPlanId]);

  return (
    <div
      ref={containerRef}
      className={`map-view ${drawingPlanId ? "map-view--drawing" : ""}`}
    />
  );
}
