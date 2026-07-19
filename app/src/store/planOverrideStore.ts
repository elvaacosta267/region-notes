import { create } from "zustand";
import { persist } from "zustand/middleware";

// plans.csv의 사업명은 지자체 공식 사업개요 표기(예: "십정초주변 / 정비구역후보지(23년
// 2차)")라 실거주자/투자자가 실제로 쓰는 통칭(예: "십정1구역")과 다를 수 있다. CSV를
// 고쳐 영구 반영하려면 출처가 필요하므로, 사용자가 직접 확인한 통칭은 일단 이 로컬
// 오버라이드로 표시하고, boundaryStore와 마찬가지로 브라우저에만 저장한다.
interface PlanOverrideState {
  nameOverrides: Record<string, string>;
  notes: Record<string, string>;
  extraLinks: Record<string, string>;
  setNameOverride: (planId: string, name: string) => void;
  clearNameOverride: (planId: string) => void;
  setNote: (planId: string, text: string) => void;
  setExtraLink: (planId: string, url: string) => void;
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
    }),
    { name: "region-notes-plan-name-overrides" }
  )
);
