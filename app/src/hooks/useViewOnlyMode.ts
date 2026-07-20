// URL에 ?view=<동기화코드>가 있으면 "보기 전용 모드" — 실시간으로 최신 데이터를 받아
// 보여주긴 하지만(hooks/useFirestoreSync.ts), 이 앱 안에서 편집 UI(이름 수정, 경계
// 그리기, 메모/링크, 동기화 코드 관리, 내보내기/가져오기)는 전부 숨긴다. 가족·지인
// 등 "수정은 안 하고 그냥 최신 상태만 보고 싶은" 사람에게 공유하는 용도.
//
// 주의: 이건 UI 수준의 보기 전용이지 서버가 강제하는 진짜 권한 분리가 아니다 —
// Firestore 보안 규칙은 이 코드를 아는 모든 요청에 get/write를 둘 다 허용한다
// (CLAUDE.md 참고). 진짜 쓰기 차단은 Cloud Functions + 별도 Auth가 필요한데, 이
// 프로젝트 규모(개인/가족 공유)에는 과하다고 판단해 UI 레벨로만 막는다 — 신뢰할 수
// 있는 사람에게만 이 링크를 공유할 것.
export function useViewOnlyMode(): { readOnly: boolean; viewSyncId: string | null } {
  const params = new URLSearchParams(window.location.search);
  const viewSyncId = params.get("view");
  return { readOnly: !!viewSyncId, viewSyncId };
}
