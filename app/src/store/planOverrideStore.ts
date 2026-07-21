import { create } from "zustand";
import { persist } from "zustand/middleware";

// plans.csv의 사업명은 지자체 공식 사업개요 표기(예: "십정초주변 / 정비구역후보지(23년
// 2차)")라 실거주자/투자자가 실제로 쓰는 통칭(예: "십정1구역")과 다를 수 있다. CSV를
// 고쳐 영구 반영하려면 출처가 필요하므로, 사용자가 직접 확인한 통칭은 일단 이 로컬
// 오버라이드로 표시하고, boundaryStore와 마찬가지로 이 브라우저에 저장한다. 편집
// 기기(store/syncStore.ts의 isEditor)에서는 저장되는 즉시 lib/firestoreSync.ts가
// Firestore로 push하므로 별도 버튼 없이 다른 모든 화면에 실시간 반영된다. notes(개인
// 메모)는 특히 git에는 절대 커밋하지 않는다(Firestore는 기기간 동기화용이라 무관 —
// 비공개 메모가 공개 저장소에 올라가는 것만 막는다).
interface PlanOverrideState {
  nameOverrides: Record<string, string>;
  notes: Record<string, string>;
  extraLinks: Record<string, string>;
  setNameOverride: (planId: string, name: string) => void;
  clearNameOverride: (planId: string) => void;
  setNote: (planId: string, text: string) => void;
  setExtraLink: (planId: string, url: string) => void;
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

      // lib/firestoreSync.ts 전용(보기 전용 화면에서만 호출됨) — 원격(Firestore)
      // 상태를 그대로 이 기기의 상태로 덮어쓴다. 편집 기기에서 지운 메모/사업명
      // 오버라이드도 보기 전용 화면에서 사라져야 실시간 동기화가 정확히 맞는다.
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
