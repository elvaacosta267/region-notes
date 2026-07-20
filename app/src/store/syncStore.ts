import { create } from "zustand";
import { persist } from "zustand/middleware";

// 실시간 동기화 코드(=Firestore 문서 경로) 저장소. 이 저장소는 이 프로젝트가 public
// GitHub repo이기 때문에 존재한다 — 빌드된 JS에 박아넣는 값(env var 포함)은 누구나
// devtools로 볼 수 있어 "고정된 비밀 경로"를 소스에 둘 수 없다. 대신 사용자가 기기마다
// 딱 한 번 코드를 직접 입력/공유하게 하고, 그 코드를 이 기기의 localStorage에만
// 저장한다 — Firestore 보안 규칙이 list를 막아두므로 이 코드를 아는 사람만
// get/write 가능하다(lib/firebaseSync.ts, CLAUDE.md 참고).
interface SyncState {
  syncId: string | null;
  setSyncId: (id: string | null) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      syncId: null,
      setSyncId: (id) => set({ syncId: id }),
    }),
    { name: "region-notes-sync-id" }
  )
);
