import { useEffect } from "react";
import { useSyncStore } from "../store/syncStore";
import { startFirestoreSync } from "../lib/firestoreSync";
import { useViewOnlyMode } from "./useViewOnlyMode";

// syncId(직접 연결한 코드) 또는 viewSyncId(?view= 보기 전용 링크)가 있는 동안만
// lib/firestoreSync.ts의 실시간 동기화를 켠다 — 둘 다 없으면 기존처럼 localStorage
// 전용으로 동작한다(하위호환). 보기 전용 링크가 우선한다: 두 값이 동시에 있는
// 경우(예: 이미 편집 기기로 연결해둔 브라우저에서 실수로 view 링크를 열었을 때)
// 편집 권한이 있어도 이 링크로 들어온 이상 쓰기를 하지 않는 게 더 안전한 기본값이다.
export function useFirestoreSync() {
  const syncId = useSyncStore((s) => s.syncId);
  const { readOnly, viewSyncId } = useViewOnlyMode();
  const effectiveSyncId = readOnly ? viewSyncId : syncId;

  useEffect(() => {
    if (!effectiveSyncId) return;
    return startFirestoreSync(effectiveSyncId, { readOnly });
  }, [effectiveSyncId, readOnly]);
}
