import { useQuery } from "@tanstack/react-query";
import type { LatLng } from "../store/boundaryStore";

// geo/plan_boundaries.geojson — 사용자가 지도에서 손으로 그린 뒤 BoundaryExport로
// 내보낸 JSON을 Claude가 저장소에 커밋한 "공유 기준" 경계. store/boundaryStore.ts의
// localStorage 값은 그린 기기의 브라우저에만 남기 때문에(백엔드 없는 정적 사이트),
// 다른 기기(예: 모바일)에서 열면 경계가 안 보이고 plans.csv의 근사 좌표 마커만
// 보이는 문제가 있었다 — 이 파일이 커밋되어 있으면 배포된 사이트를 어떤 기기에서
// 열어도 동일한 경계가 보인다. MapView.tsx에서 이 값과 localStorage 값을 병합할 때
// localStorage(이 기기에서 그리는 중/수정 중인 것)가 우선한다.
interface PlanBoundaryFeature {
  type: "Feature";
  properties: { id: string };
  geometry: { type: "Polygon"; coordinates: number[][][] };
}

interface PlanBoundaryGeoJSON {
  type: "FeatureCollection";
  features: PlanBoundaryFeature[];
}

async function fetchPlanBoundaries(): Promise<Record<string, LatLng[]>> {
  // cache: "no-store" — usePlansData.ts와 동일한 이유. 특히 이 파일은 PC에서 새로
  // 그린 경계를 커밋한 직후 확인하는 용도라 캐시로 인해 안 보이면 "또 안 된다"는
  // 오해를 사기 쉽다.
  const res = await fetch(`${import.meta.env.BASE_URL}data/plan_boundaries.geojson`, {
    cache: "no-store",
  });
  if (!res.ok) return {}; // 아직 커밋된 경계가 없어도 지도는 정상 동작해야 함
  const geojson: PlanBoundaryGeoJSON = await res.json();
  const result: Record<string, LatLng[]> = {};
  for (const feature of geojson.features) {
    const ring = feature.geometry.coordinates[0];
    // GeoJSON 폴리곤 스펙(RFC 7946)은 첫 점=마지막 점으로 닫힌 링을 요구하지만,
    // 이 앱 내부에서 쓰는 LatLng[]는 (kakao.maps.Polygon처럼) 닫히지 않은 꼭짓점
    // 목록이라 마지막 중복점은 제거한다 — 그대로 두면 지도에 불필요한 꼭짓점이
    // 하나 더 찍힌다(육안으로는 티 안 나지만 draftPoints 개수 등이 어긋남).
    const first = ring[0];
    const last = ring[ring.length - 1];
    const isClosed = ring.length > 1 && first[0] === last[0] && first[1] === last[1];
    const points = isClosed ? ring.slice(0, -1) : ring;
    result[feature.properties.id] = points.map(([lng, lat]) => ({ lat, lng }));
  }
  return result;
}

export function usePlanBoundaries() {
  return useQuery({
    queryKey: ["plan-boundaries"],
    queryFn: fetchPlanBoundaries,
    staleTime: Infinity,
  });
}
