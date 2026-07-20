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
  updateDraftPoint: (index: number, point: LatLng) => void;
  undoLastPoint: () => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;
  clearBoundary: (planId: string) => void;
  importBoundaries: (data: Record<string, LatLng[]>) => void;
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

      // 다른 기기(주로 PC)에서 "경계 내보내기"로 복사한 JSON을 이 기기에 즉시
      // 반영한다 — git 커밋/배포를 기다릴 필요 없는 PC↔모바일 당일 동기화 경로.
      // upsert이므로 이 기기에 이미 있던 다른 plan id의 경계는 그대로 남는다.
      // 3점 미만은 유효한 폴리곤이 아니라서 조용히 걸러낸다(tools/import_plan_boundaries.py
      // 의 동일 규칙과 맞춤).
      importBoundaries: (data) =>
        set((state) => {
          const valid = Object.fromEntries(
            Object.entries(data).filter(([, points]) => points.length >= 3)
          );
          return { boundaries: { ...state.boundaries, ...valid } };
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
