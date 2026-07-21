import { useEffect } from "react";
import { useSyncStore } from "../store/syncStore";
import { startFirestoreSync } from "../lib/firestoreSync";

// 편집 기기로 설정된 브라우저(store/syncStore.ts의 isEditor)만 쓰기 권한으로
// 연결하고, 그 외 모든 화면은 항상 읽기 전용으로 같은 고정 문서를 구독한다 —
// 기기마다 코드를 맞춰 입력할 필요가 없어 새로 여는 즉시 최신 상태가 보인다.
export function useFirestoreSync() {
  const isEditor = useSyncStore((s) => s.isEditor);

  useEffect(() => {
    return startFirestoreSync({ readOnly: !isEditor });
  }, [isEditor]);
}
