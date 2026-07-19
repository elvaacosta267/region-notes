export function planDisplayName(
  planId: string,
  officialName: string,
  overrides: Record<string, string>
): string {
  return overrides[planId]?.trim() || officialName;
}
