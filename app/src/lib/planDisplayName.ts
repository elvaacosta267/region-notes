export function planDisplayName(
  planId: string,
  officialName: string,
  overrides: Record<string, string>
): string {
  return overrides[planId]?.trim() || officialName;
}

// 순위표(특히 모바일 폭)에서는 "oo재개발 / 정비구역후보지(23년 2차)" 같은 내부 분류
// 접미사까지 다 보여줄 필요가 없다 — "/" 앞부분만 보여주고 전체 이름은 title 툴팁으로.
export function planShortDisplayName(name: string): string {
  return name.split("/")[0].trim();
}

// 순위표 인라인 편집과 상세패널 편집이 같은 커밋 규칙(빈 값/원래 이름이면 오버라이드
// 해제)을 쓰도록 공유한다.
export function commitNameOverride(
  planId: string,
  officialName: string,
  draft: string,
  setNameOverride: (planId: string, name: string) => void,
  clearNameOverride: (planId: string) => void
): void {
  const trimmed = draft.trim();
  if (!trimmed || trimmed === officialName) {
    clearNameOverride(planId);
  } else {
    setNameOverride(planId, trimmed);
  }
}
