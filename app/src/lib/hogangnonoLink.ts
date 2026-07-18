import { planSearchName } from "./planSearchName";

// 호갱노노는 공식 API가 없고, 내부 검색은 SPA 라우팅이라 URL 파라미터로 직접
// 결과를 열 수 없다(가입 유도 모달이 검색창을 가로채 실제 검색 URL 패턴 확인도 어려움).
// 대신 hogangnono.com 도메인으로 한정한 검색엔진 검색을 딥링크로 써서,
// 내부 라우팅 구조와 무관하게 항상 해당 단지/구역 페이지로 안내되도록 한다.
export function hogangnonoSearchUrl(planName: string): string {
  const query = `site:hogangnono.com ${planSearchName(planName)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
