import { create } from "zustand";
import { persist } from "zustand/middleware";

// 정비구역 경계(폴리곤)를 사용자가 지도 위에서 직접 클릭해 그리는 기능의 상태.
// 카카오맵 무료 API가 지적도 폴리곤을 안 주기 때문에(CLAUDE.md 참고) 사용자가
// 손으로 그린 경계를 대신 쓴다. 편집 기기(store/syncStore.ts의 isEditor)에서는
// localStorage에 저장되는 즉시 lib/firestoreSync.ts가 Firestore로 push하므로
// 별도 내보내기/가져오기 버튼 없이 다른 모든 화면에 실시간(수 초 내) 반영된다.
// 영구 백업이 필요하면 boundaryStore 값을 Claude에게 줘서 geo/plan_boundaries.geojson에
// 커밋할 수도 있다(README 업데이트 루프와 동일한 패턴, 선택 사항 — CLAUDE.md 참고).
export type LatLng = { lat: number; lng: number };

interface BoundaryState {
  boundaries: Record<string, LatLng[]>;
  drawingPlanId: string | null;
  draftPoints: LatLng[];
  startDrawing: (planId: string) => void;
  addDraftPoint: (point: LatLng) => void;
  updateDraftPoint: (index: number, point: LatLng) => void;
  undoLastPoint: () => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  clearBoundary: (planId: string) => void;
  replaceBoundaries: (data: Record<string, LatLng[]>) => void;
}

export const useBoundaryStore = create<BoundaryState>()(
  persist(
    (set, get) => ({
      boundaries: {},
      drawingPlanId: null,
      draftPoints: [],

      startDrawing: (planId) =>
        set({ drawingPlanId: planId, draftPoints: get().boundaries[planId] ?? [] }),

      addDraftPoint: (point) =>
        set((state) => ({ draftPoints: [...state.draftPoints, point] })),

      updateDraftPoint: (index, point) =>
        set((state) => ({
          draftPoints: state.draftPoints.map((p, i) => (i === index ? point : p)),
        })),

      undoLastPoint: () =>
        set((state) => ({ draftPoints: state.draftPoints.slice(0, -1) })),

      finishDrawing: () =>
        set((state) => {
          if (!state.drawingPlanId || state.draftPoints.length < 3) {
            return { drawingPlanId: null, draftPoints: [] };
          }
          return {
            boundaries: { ...state.boundaries, [state.drawingPlanId]: state.draftPoints },
            drawingPlanId: null,
            draftPoints: [],
          };
        }),

      cancelDrawing: () => set({ drawingPlanId: null, draftPoints: [] }),

      clearBoundary: (planId) =>
        set((state) => {
          const next = { ...state.boundaries };
          delete next[planId];
          return { boundaries: next };
        }),

      // lib/firestoreSync.ts 전용(보기 전용 화면에서만 호출됨) — 원격(Firestore)
      // 상태를 그대로 이 기기의 상태로 덮어쓴다. 편집 기기에서 삭제한 경계도
      // 보기 전용 화면에서 사라져야 실시간 동기화가 정확히 맞는다.
      replaceBoundaries: (data) => set({ boundaries: data }),
    }),
    {
      name: "region-notes-plan-boundaries",
      // drawingPlanId/draftPoints는 그리는 중 임시 상태라 새로고침하면 사라져야
      // 한다 — 저장하면 새로고침할 때마다 지도가 그리기 모드로 멈춰있게 된다.
      partialize: (state) => ({ boundaries: state.boundaries }),
    }
  )
);
