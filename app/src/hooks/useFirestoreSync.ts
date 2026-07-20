import { useEffect } from "react";
import { useSyncStore } from "../store/syncStore";
import { startFirestoreSync } from "../lib/firestoreSync";

// syncId가 설정된 동안만 lib/firestoreSync.ts의 실시간 동기화를 켠다 — 아직 동기화
// 코드를 만들지 않은 사용자는 기존처럼 localStorage 전용으로 동작한다(하위호환).
export function useFirestoreSync() {
  const syncId = useSyncStore((s) => s.syncId);

  useEffect(() => {
    if (!syncId) return;
    return startFirestoreSync(syncId);
  }, [syncId]);
}
