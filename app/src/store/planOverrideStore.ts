import { create } from "zustand";
import { persist } from "zustand/middleware";

// plans.csv의 사업명은 지자체 공식 사업개요 표기(예: "십정초주변 / 정비구역후보지(23년
// 2차)")라 실거주자/투자자가 실제로 쓰는 통칭(예: "십정1구역")과 다를 수 있다. CSV를
// 고쳐 영구 반영하려면 출처가 필요하므로, 사용자가 직접 확인한 통칭은 일단 이 로컬
// 오버라이드로 표시하고, boundaryStore와 마찬가지로 이 브라우저에 저장한다.
// hooks/useFirestoreSync.ts로 동기화 코드를 연결해두면 다른 기기와 실시간으로
// 자동 맞춰지고(replaceOverrides), 아니면 components/filters/LocalDataExport.tsx/
// LocalDataImport.tsx로 수동 복사-붙여넣기해야 옮겨진다. notes(개인 메모)는 특히
// git에는 절대 커밋하지 않는다(Firestore는 기기간 동기화용이라 무관 — 비공개 메모가
// 공개 저장소에 올라가는 것만 막는다).
interface PlanOverrideState {
  nameOverrides: Record<string, string>;
  notes: Record<string, string>;
  extraLinks: Record<string, string>;
  setNameOverride: (planId: string, name: string) => void;
  clearNameOverride: (planId: string) => void;
  setNote: (planId: string, text: string) => void;
  setExtraLink: (planId: string, url: string) => void;
  importOverrides: (data: {
    nameOverrides?: Record<string, string>;
    notes?: Record<string, string>;
    extraLinks?: Record<string, string>;
  }) => void;
  replaceOverrides: (data: {
    nameOverrides: Record<string, string>;
    notes: Record<string, string>;
    extraLinks: Record<string, string>;
  }) => void;
}

export const usePlanOverrideStore = create<PlanOverrideState>()(
  persist(
    (set) => ({
      nameOverrides: {},
      notes: {},
      extraLinks: {},

      setNameOverride: (planId, name) =>
        set((state) => ({
          nameOverrides: { ...state.nameOverrides, [planId]: name },
        })),

      clearNameOverride: (planId) =>
        set((state) => {
          const next = { ...state.nameOverrides };
          delete next[planId];
          return { nameOverrides: next };
        }),

      // 메모/관련 링크도 사업명 오버라이드와 같은 이유로 로컬(브라우저)에만 저장한다 —
      // 사용자가 직접 남기는 참고용 부가정보라 plans.csv(공식 데이터)에 섞지 않는다.
      setNote: (planId, text) =>
        set((state) => {
          const next = { ...state.notes };
          if (text.trim()) next[planId] = text;
          else delete next[planId];
          return { notes: next };
        }),

      setExtraLink: (planId, url) =>
        set((state) => {
          const next = { ...state.extraLinks };
          if (url.trim()) next[planId] = url.trim();
          else delete next[planId];
          return { extraLinks: next };
        }),

      // 다른 기기(주로 PC)에서 내보낸 오버라이드를 이 기기에 upsert 병합한다 —
      // boundaryStore.importBoundaries와 동일한 목적(당일 기기간 동기화, git 불필요).
      importOverrides: (data) =>
        set((state) => ({
          nameOverrides: { ...state.nameOverrides, ...(data.nameOverrides ?? {}) },
          notes: { ...state.notes, ...(data.notes ?? {}) },
          extraLinks: { ...state.extraLinks, ...(data.extraLinks ?? {}) },
        })),

      // lib/firestoreSync.ts 전용 — 원격(Firestore) 상태를 그대로 이 기기의 상태로
      // 덮어쓴다. importOverrides(upsert)와 달리 다른 기기에서 지운 메모/사업명
      // 오버라이드도 이 기기에서 사라져야 실시간 동기화가 정확히 맞는다.
      replaceOverrides: (data) =>
        set({
          nameOverrides: data.nameOverrides,
          notes: data.notes,
          extraLinks: data.extraLinks,
        }),
    }),
    { name: "region-notes-plan-name-overrides" }
  )
);
