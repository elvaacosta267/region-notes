import { create } from "zustand";
import { persist } from "zustand/middleware";

// 이 앱은 이제 "편집 기기는 딱 하나(사용자의 PC), 나머지 모든 화면(다른 PC·모바일
// 포함)은 항상 보기 전용"이라는 단순한 모델을 쓴다. 예전에는 기기마다 동기화 코드를
// 직접 만들고 서로 입력해 맞춰야 했는데(그 결과 PC와 모바일이 서로 다른 코드에
// 연결되거나 아예 연결이 안 되는 문제가 반복됐다), 이제는 Firestore 문서 경로
// (VITE_SYNC_ID)가 빌드에 고정으로 박혀 있어 모든 기기가 아무 설정 없이 자동으로
// 같은 데이터를 실시간으로 받아본다(lib/firestoreSync.ts). 유일하게 기기마다 다른
// 값은 "이 브라우저가 편집 기기인가"뿐이고, 그건 로컬에만 저장한다 — 이 상태가
// 아니면 항상 읽기 전용(hooks/useViewOnlyMode.ts)이라 초기값은 반드시 false여야
// 한다(그래야 이 배포를 새로 여는 모든 기기가 기본적으로 보기 전용으로 시작한다).
//
// 주의(보안 모델): VITE_SYNC_ID는 이제 Kakao/Firebase 키와 같은 취급의 "공개
// 빌드값"이라 배포된 JS 번들에 그대로 노출된다 — devtools로 보면 누구나 값을
// 확인할 수 있다. Firestore 보안 규칙은 이 코드를 아는 모든 요청에 get/write를
// 둘 다 허용하므로(CLAUDE.md 참고), 기술적으로는 이 값을 알아낸 사람이 "이 기기를
// 편집 기기로 설정"을 거치지 않고도 Firestore에 직접 쓰기를 시도할 수 있다. 이건
// 이전의 "코드 기반 뷰어 링크"와 이미 같은 수준의 신뢰 모델(진짜 서버 인증이 아닌
// UI 레벨 안내)이라 개인/가족 공유 규모에서는 허용하지만, 더 넓은 대상에 공개하는
// 용도로는 쓰지 않는다.
interface SyncState {
  isEditor: boolean;
  setIsEditor: (v: boolean) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      isEditor: false,
      setIsEditor: (v) => set({ isEditor: v }),
    }),
    { name: "region-notes-editor-mode" }
  )
);
