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
  const res = await fetch(`${import.meta.env.BASE_URL}data/bupyeong_boundary.geojson`);
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
