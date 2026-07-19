// 예약 업데이트 작업이 주 단위로 도는 걸 전제로, 최근 2회분 정도(약 2주)는
// "새 소식" 배지를 계속 보여준다 — 그보다 오래되면 자연히 사라진다.
const RECENT_UPDATE_WINDOW_DAYS = 14;

export function isRecentUpdate(dateStr: string): boolean {
  if (!dateStr) return false;
  const updated = new Date(dateStr).getTime();
  if (Number.isNaN(updated)) return false;
  const days = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= RECENT_UPDATE_WINDOW_DAYS;
}
