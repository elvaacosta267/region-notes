import { useQuery } from "@tanstack/react-query";
import type { PlansGeoJSON } from "../lib/types";

async function fetchPlans(): Promise<PlansGeoJSON> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/plans.geojson`);
  if (!res.ok) {
    throw new Error(`plans.geojson 로드 실패: ${res.status}`);
  }
  return res.json();
}

export function usePlansData() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: fetchPlans,
    staleTime: Infinity, // 정적 파일, 빌드 시점에만 바뀜
  });
}
