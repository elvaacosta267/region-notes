// 카카오맵 JS SDK 전용 코드를 이 파일에만 국한한다. 점수 계산·필터링 로직(store, lib)과
// 지도 렌더링을 분리해서 설계했으니, 나중에 지도 라이브러리를 다시 바꿀 때도 이 파일만
// 새로 작성하면 된다.
import { useEffect, useMemo, useRef } from "react";
import type { LatLng } from "../../store/boundaryStore";
import type { PlanFeature } from "../../lib/types";
import type { AdminBoundaryGeoJSON } from "../../hooks/useBupyeongBoundary";
import { rankPlans } from "../../lib/computeScore";
import { planDisplayName } from "../../lib/planDisplayName";
import { useRankingStore } from "../../store/rankingStore";
import { useBoundaryStore } from "../../store/boundaryStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
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

// 라벨을 어디에 띄울지 정하는 용도라 정확한 폴리곤 중심(centroid)일 필요는 없음 — 꼭짓점 평균이면 충분
function averageCenter(points: LatLng[]): LatLng {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

export function MapView({
  features,
  adminBoundary,
}: {
  features: PlanFeature[];
  adminBoundary: AdminBoundaryGeoJSON | null | undefined; // undefined = 아직 로딩 중
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const boundaryPolygonsRef = useRef<KakaoPolygon[]>([]);
  const boundaryLabelsRef = useRef<KakaoCustomOverlay[]>([]);
  const adminBoundaryPolygonsRef = useRef<KakaoPolygon[]>([]);
  const draftPolygonRef = useRef<KakaoPolygon | null>(null);
  const draftVertexMarkersRef = useRef<KakaoMarker[]>([]);
  const drawStartedForRef = useRef<string | null>(null);
  const hasFitInitialBoundsRef = useRef(false);
  const weights = useRankingStore((s) => s.weights);
  const selectedId = useRankingStore((s) => s.selectedId);
  const selectPlan = useRankingStore((s) => s.selectPlan);
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const drawingPlanId = useBoundaryStore((s) => s.drawingPlanId);
  const draftPoints = useBoundaryStore((s) => s.draftPoints);
  const addDraftPoint = useBoundaryStore((s) => s.addDraftPoint);
  const updateDraftPoint = useBoundaryStore((s) => s.updateDraftPoint);
  const nameOverrides = usePlanOverrideStore((s) => s.nameOverrides);

  const scoredById = useMemo(() => {
    const ranked = rankPlans(features, weights);
    return new Map(ranked.map((sp) => [sp.feature.properties.id, sp]));
  }, [features, weights]);

  const colorById = useMemo(
    () => new Map(features.map((f) => [f.properties.id, f.properties.color])),
    [features]
  );

  const nameById = useMemo(
    () =>
      new Map(
        features.map((f) => [
          f.properties.id,
          planDisplayName(f.properties.id, f.properties.사업명, nameOverrides),
        ])
      ),
    [features, nameOverrides]
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

  // 부평구 실제 행정동 경계(통계청 SGIS 원자료, tools/fetch_bupyeong_boundary.py로
  // 받음) — 임의로 근사한 도형이 아니라 실제 공개 데이터다. 개별 사업 경계와 구분되는
  // 옅은 회색 점선으로, 클릭 상호작용 없이 배경 맥락으로만 깐다.
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current || !adminBoundary) return;
      const map = mapRef.current;
      adminBoundaryPolygonsRef.current.forEach((poly) => poly.setMap(null));
      adminBoundaryPolygonsRef.current = adminBoundary.features.flatMap((feature) =>
        feature.geometry.coordinates.map((polygon) => {
          const path = polygon[0].map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
          const poly = new kakao.maps.Polygon({
            path,
            strokeWeight: 1.5,
            strokeColor: "#6b7280",
            strokeOpacity: 0.8,
            strokeStyle: "shortdash",
            fillOpacity: 0,
          });
          poly.setMap(map);
          return poly;
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [adminBoundary]);

  // 처음 화면을 열었을 때(아직 아무 사업도 선택 안 함)는 고정된 대략적 중심좌표 대신
  // 부평구 전체가 한 화면에 다 들어오도록 맞춘다 — 개별 마커는 작게 보여도 "전체
  // 개발현황을 한눈에" 보는 게 우선. 행정동 경계가 로딩되면 그 실제 경계 범위를
  // 쓰고(사업 좌표보다 부평구 전체를 더 정확히 대표함), 아직이거나 못 받아왔으면
  // 사업 좌표들로라도 맞춘다. 한 번 맞추고 나면(사용자가 뭔가 선택하면 아래
  // "선택된 사업으로 이동" 효과가 대신 담당) 다시 전체로 되돌리지 않는다.
  useEffect(() => {
    if (hasFitInitialBoundsRef.current) return;
    if (adminBoundary === undefined) return; // 아직 로딩 중 — 있으면 그걸 우선 쓰려고 기다림
    if (!adminBoundary && features.length === 0) return;
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current || hasFitInitialBoundsRef.current) return;
      const bounds = new kakao.maps.LatLngBounds();
      if (adminBoundary) {
        adminBoundary.features.forEach((feature) => {
          feature.geometry.coordinates.forEach((polygon) => {
            polygon[0].forEach(([lng, lat]) => bounds.extend(new kakao.maps.LatLng(lat, lng)));
          });
        });
      } else {
        features.forEach((f) => {
          const [lng, lat] = f.geometry.coordinates;
          bounds.extend(new kakao.maps.LatLng(lat, lng));
        });
      }
      mapRef.current.setBounds(bounds);
      // 부평구 실제 면적은 컨테이너보다 세로로 더 좁은 비율이라 setBounds만 쓰면
      // (가로를 맞추려고) 인천 시청·부천까지 보일 만큼 과하게 축소된다 — 추적 중인
      // 사업 좌표가 전부 화면에 들어오는 선에서 레벨을 한 번 더 조여준다.
      mapRef.current.setLevel(Math.min(mapRef.current.getLevel(), 8));
      hasFitInitialBoundsRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [features, adminBoundary]);

  // "지도 크게 보기" 토글 등으로 컨테이너 크기가 CSS로만 바뀌면 카카오맵은 이를
  // 자동 감지하지 못해 기존 캔버스 크기로 굳어버린다(빈 공간이 생김) — ResizeObserver로
  // 컨테이너 크기 변화를 감지해 매번 relayout()을 호출해야 지도가 새 크기를 채운다.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.relayout();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
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
          el.title = nameById.get(p.id) ?? p.사업명;
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
  }, [features, scoredById, selectedId, selectPlan, boundaries, drawingPlanId, nameById]);

  // 사용자가 직접 그린 구역 경계(폴리곤) — 카카오 지도 API가 지적도를 안 줘서
  // 대신 이 앱 안에서 손으로 그린 경계를 씀 (CLAUDE.md, store/boundaryStore.ts 참고).
  // 이 경계가 있는 사업은 원형 마커 대신 이 폴리곤이 클릭 대상이 된다. 선택된 구역만
  // 굵은 색 테두리로 강조하고 나머지는 회색으로 눌러줘야 "여러 구역이 같이 겹쳐
  // 보인다"는 혼란이 안 생긴다 — fill은 그대로 카테고리 색으로 남겨 구분은 유지.
  // 중심에는 사업명 라벨을 얹어 폴리곤만 봐도 어떤 구역인지 바로 알 수 있게 한다.
  useEffect(() => {
    let cancelled = false;
    loadKakaoMaps().then(() => {
      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      boundaryPolygonsRef.current.forEach((poly) => poly.setMap(null));
      boundaryLabelsRef.current.forEach((label) => label.setMap(null));

      const entries = Object.entries(boundaries).filter(
        ([planId]) => planId !== drawingPlanId // 그리는 중인 건 draft로 따로 렌더
      );

      boundaryPolygonsRef.current = entries.map(([planId, points]) => {
        const color = colorById.get(planId) ?? "#6b7280";
        const isSelected = planId === selectedId;
        const polygon = new kakao.maps.Polygon({
          path: points.map((pt) => new kakao.maps.LatLng(pt.lat, pt.lng)),
          strokeWeight: isSelected ? 3 : 1,
          strokeColor: isSelected ? color : "#9ca3af",
          strokeOpacity: isSelected ? 0.95 : 0.5,
          fillColor: color,
          fillOpacity: isSelected ? 0.3 : 0.12,
        });
        polygon.setMap(map);
        kakao.maps.event.addListener(polygon, "click", () => selectPlan(planId));
        return polygon;
      });

      boundaryLabelsRef.current = entries.map(([planId, points]) => {
        const center = averageCenter(points);
        const isSelected = planId === selectedId;
        const el = document.createElement("div");
        el.className = `map-view__zone-label ${isSelected ? "map-view__zone-label--selected" : ""}`;
        el.textContent = nameById.get(planId) ?? planId;
        const label = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(center.lat, center.lng),
          content: el,
          yAnchor: 0.5,
          zIndex: isSelected ? 20 : 10,
        });
        label.setMap(map);
        return label;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [boundaries, colorById, nameById, drawingPlanId, selectedId, selectPlan]);

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
        strokeWeight: 1,
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

  // 선택된 사업으로 지도 이동 — 직접 그린 경계가 있으면 그 경계가 실제
  // 위치이므로 경계 전체가 보이도록 맞추고, 없으면 (원래 근사치일 수 있는)
  // 사업 좌표로 이동한다. 경계 좌표는 사용자가 직접 찍은 정밀한 위치라
  // plans.csv의 동단위 근사 좌표보다 우선한다.
  useEffect(() => {
    if (!selectedId || !mapRef.current || drawingPlanId) return;
    const boundary = boundaries[selectedId];
    if (boundary && boundary.length > 0) {
      const bounds = new kakao.maps.LatLngBounds();
      boundary.forEach((pt) => bounds.extend(new kakao.maps.LatLng(pt.lat, pt.lng)));
      mapRef.current.setBounds(bounds);
      return;
    }
    const feature = features.find((f) => f.properties.id === selectedId);
    if (!feature) return;
    const [lng, lat] = feature.geometry.coordinates;
    const position = new kakao.maps.LatLng(lat, lng);
    mapRef.current.panTo(position);
    mapRef.current.setLevel(SELECTED_LEVEL);
  }, [selectedId, features, drawingPlanId, boundaries]);

  return (
    <div
      ref={containerRef}
      className={`map-view ${drawingPlanId ? "map-view--drawing" : ""}`}
    />
  );
}
