import { useQuery } from "@tanstack/react-query";
import type { PlansGeoJSON } from "../lib/types";

async function fetchPlans(): Promise<PlansGeoJSON> {
  // cache: "no-store" — 이 파일은 파일명이 고정(해시 안 붙음)이라 배포 후에도
  // 브라우저가 이전 방문 때의 HTTP 캐시를 그대로 재사용할 수 있다. 그러면 최근에
  // 새로 배포된 기기와, 예전에 캐시된 채 안 새로고침한 기기가 서로 다른 데이터를
  // 보게 되어(가중치는 같아도) 순위/점수가 달라 보이는 문제가 생긴다 — 항상 최신
  // 배포본을 받도록 캐시를 강제로 건너뛴다.
  const res = await fetch(`${import.meta.env.BASE_URL}data/plans.geojson`, { cache: "no-store" });
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
