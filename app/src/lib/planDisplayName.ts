export function planDisplayName(
  planId: string,
  officialName: string,
  overrides: Record<string, string>
): string {
  return overrides[planId]?.trim() || officialName;
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
