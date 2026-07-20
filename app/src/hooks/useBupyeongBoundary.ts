import { useQuery } from "@tanstack/react-query";

// tools/fetch_bupyeong_boundary.py가 만드는 실제 행정동 경계(통계청 SGIS 원자료,
// vuski/admdongkor가 가공, CC BY 4.0) — 임의로 근사한 도형이 아니다.
export interface AdminDongFeature {
  type: "Feature";
  properties: { adm_nm: string };
  geometry: { type: "MultiPolygon"; coordinates: number[][][][] };
}

export interface AdminBoundaryGeoJSON {
  type: "FeatureCollection";
  features: AdminDongFeature[];
}

async function fetchBoundary(): Promise<AdminBoundaryGeoJSON | null> {
  // cache: "no-store" — usePlansData.ts와 동일한 이유(고정 파일명이라 기기마다
  // 다른 시점의 HTTP 캐시를 볼 수 있음). 이 파일은 자주 안 바뀌지만 일관성을 위해 맞춤.
  const res = await fetch(`${import.meta.env.BASE_URL}data/bupyeong_boundary.geojson`, {
    cache: "no-store",
  });
  if (!res.ok) return null; // 아직 생성 전이어도 지도 자체는 정상 동작해야 함
  return res.json();
}

export function useBupyeongBoundary() {
  return useQuery({
    queryKey: ["bupyeong-boundary"],
    queryFn: fetchBoundary,
    staleTime: Infinity,
  });
}
