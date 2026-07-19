// plans.csv의 비고란 "대표지번: {동} {지번}[번지][ 일원]..." 텍스트에서 지번만 뽑아
// 지자체 정비구역 지정 고시에서 쓰는 "{동} {지번}구역 외" 표기로 변환한다.
// 목적: 근거법/사업유형이 달라도 같은 지번을 쓰는 사업(중복 등재 후보)을
// 순위표·상세패널에서 한눈에 비교할 수 있게 하기 위함 — 실제 지정 고시번호는
// 아니고, plans.csv에 이미 있는 대표지번을 관용 표기로 재포맷한 것뿐이다.
const WITH_ILWON = /대표지번:\s*([^.]+?)\s*일원/;
const WITHOUT_ILWON = /대표지번:\s*([^.]+)/;

export function officialZoneLabel(비고: string): string | null {
  const match = 비고.match(WITH_ILWON) ?? 비고.match(WITHOUT_ILWON);
  if (!match) return null;
  const cleaned = match[1].trim().replace(/번지/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return `${cleaned}구역 외`;
}
