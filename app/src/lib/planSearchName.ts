// plans.csv의 사업명에는 " / 정비구역후보지(23년 2차)", "(현지개량)" 같은
// 내부 분류용 접미사가 붙어있다. 이걸 그대로 외부 검색엔진에 보내면 실제로는
// 존재하는 사업(예: 청천4구역)도 정확히 일치하는 결과가 없다고 나온다.
// 검색어를 만들 때는 이 접미사를 떼어낸 핵심 명칭만 사용한다.
export function planSearchName(planName: string): string {
  const beforeSlash = planName.split("/")[0].trim();
  return beforeSlash.replace(/\([^)]*\)\s*$/, "").trim();
}
