import { planSearchName } from "./planSearchName";

// 네이버부동산(new.land.naver.com)도 호갱노노와 마찬가지로 공식 API가 없고
// 내부 검색이 SPA 라우팅이라 URL로 특정 단지 결과를 직접 열 수 없다.
// 동일하게 도메인 한정 검색엔진 검색으로 딥링크를 대체한다.
export function naverLandSearchUrl(planName: string): string {
  const query = `site:new.land.naver.com ${planSearchName(planName)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
