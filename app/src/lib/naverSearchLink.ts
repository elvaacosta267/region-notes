import { planSearchName } from "./planSearchName";

// 호갱노노(site: 한정 구글검색), 네이버부동산(도메인 자체가 구글에 거의 색인 안 됨) 둘 다
// 특정 단지 페이지로 바로 여는 딥링크를 안정적으로 만들 방법이 없었다(각각 SPA 검색이라
// URL 파라미터로 결과를 못 열고, 검색엔진 우회도 실제 매칭 결과를 보장 못 함).
// 대신 네이버 통합검색을 도메인 제한 없이 그대로 열어서, 결과가 있으면 매물/시세 정보나
// 뉴스가, 없으면 최소한 "검색결과 없음"이 아니라 관련 정보가 뜨도록 한다.
export function naverSearchUrl(planName: string): string {
  const query = `${planSearchName(planName)} 매물`;
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

// 네이버부동산은 이름 검색은 딥링크가 안 되지만, 지도 중심좌표(ms=lat,lng,zoom)로
// 여는 URL은 공개적으로 통용되는 방식이라 plans.csv의 lat/lng으로 해당 구역 근방
// 매물 지도를 바로 띄울 수 있다. a=매물종류(아파트/분양권/재건축/빌라/단독다가구),
// e=RETAIL(상가)까지 넓게 잡아 이 프로젝트가 다루는 자산유형(아파트~상가)을 포괄한다.
export function naverLandMapUrl(lat: number, lng: number): string {
  return `https://new.land.naver.com/search?ms=${lat},${lng},17&a=APT:ABYG:JGC:PRE:JWJT:DDDGG:VL&e=RETAIL`;
}
