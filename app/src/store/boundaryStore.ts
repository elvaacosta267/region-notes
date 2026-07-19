import { create } from "zustand";
import { persist } from "zustand/middleware";

// 정비구역 경계(폴리곤)를 사용자가 지도 위에서 직접 클릭해 그리는 기능의 상태.
// 카카오맵 무료 API가 지적도 폴리곤을 안 주기 때문에(CLAUDE.md 참고) 사용자가
// 손으로 그린 경계를 대신 쓴다. 이 앱은 정적 사이트(백엔드 없음)라 브라우저
// localStorage에만 저장된다 — 기기를 바꾸면 사라지므로, WeightPanel 옆 "경계
// 내보내기" 버튼으로 JSON을 복사해 Claude에게 전달하면 geo/plan_boundaries.geojson
// 에 영구 반영할 수 있다(README 업데이트 루프와 동일한 패턴).
export type LatLng = { lat: number; lng: number };

interface BoundaryState {
  boundaries: Record<string, LatLng[]>;
  drawingPlanId: string | null;
  draftPoints: LatLng[];
  startDrawing: (planId: string) => void;
  addDraftPoint: (point: LatLng) => void;
  undoLastPoint: () => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  clearBoundary: (planId: string) => void;
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
    }),
    {
      name: "region-notes-plan-boundaries",
      // drawingPlanId/draftPoints는 그리는 중 임시 상태라 새로고침하면 사라져야
      // 한다 — 저장하면 새로고침할 때마다 지도가 그리기 모드로 멈춰있게 된다.
      partialize: (state) => ({ boundaries: state.boundaries }),
    }
  )
);
