import { useSyncStore } from "../store/syncStore";

// 이 브라우저가 "편집 기기"(store/syncStore.ts의 isEditor)로 설정되어 있지 않으면
// 항상 보기 전용이다 — 편집 UI(이름 수정, 경계 그리기, 메모/링크, 편집 기기
// 전환, 내보내기/가져오기)를 전부 숨긴다. 기본값이 false이므로 이 배포를 새로
// 여는 모든 기기(다른 PC 포함)는 아무 설정 없이 보기 전용으로 시작한다 — 편집은
// 딱 하나의 기기에서 명시적으로 "이 기기를 편집 기기로 설정"을 눌러야만 켜진다.
//
// 주의: 이건 UI 수준의 보기 전용이지 서버가 강제하는 진짜 권한 분리가 아니다 —
// Firestore 보안 규칙은 이 문서 경로(VITE_SYNC_ID)를 아는 모든 요청에 get/write를
// 둘 다 허용한다(CLAUDE.md, store/syncStore.ts 참고). 진짜 쓰기 차단은 Cloud
// Functions + 별도 Auth가 필요한데, 이 프로젝트 규모(개인/가족 공유)에는 과하다고
// 판단해 UI 레벨로만 막는다.
export function useViewOnlyMode(): { readOnly: boolean } {
  const isEditor = useSyncStore((s) => s.isEditor);
  return { readOnly: !isEditor };
}
