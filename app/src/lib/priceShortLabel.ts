// "확인필요(하하골마을과 동일 유형, 도시재생사업 여부 원문 미확인)"처럼 사유가 길게
// 붙는 값은 순위표에서는 "확인필요"만 보여주고, 전체 사유는 title 툴팁으로 남긴다.
export function priceShortLabel(price: string): string {
  return price.startsWith("확인필요") ? "확인필요" : price;
}
