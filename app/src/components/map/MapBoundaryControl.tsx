import { useRankingStore } from "../../store/rankingStore";
import { useBoundaryStore } from "../../store/boundaryStore";
import "./MapBoundaryControl.css";

// 지도 좌하단(기존 범례 자리)에서 바로 경계를 그릴 수 있게 하는 컨트롤.
// 순위표/지도에서 선택된 사업(selectedId) 기준으로 동작 — 상세패널의
// 경계 그리기 섹션과 동일한 boundaryStore 액션을 공유한다.
export function MapBoundaryControl() {
  const selectedId = useRankingStore((s) => s.selectedId);
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const drawingPlanId = useBoundaryStore((s) => s.drawingPlanId);
  const draftPoints = useBoundaryStore((s) => s.draftPoints);
  const startDrawing = useBoundaryStore((s) => s.startDrawing);
  const undoLastPoint = useBoundaryStore((s) => s.undoLastPoint);
  const finishDrawing = useBoundaryStore((s) => s.finishDrawing);
  const cancelDrawing = useBoundaryStore((s) => s.cancelDrawing);
  const clearBoundary = useBoundaryStore((s) => s.clearBoundary);

  if (drawingPlanId) {
    return (
      <div className="map-boundary-control">
        <p className="map-boundary-control__hint">
          지도를 클릭해 경계를 도로 따라 순서대로 찍어주세요 ({draftPoints.length}개
          점, 완료하려면 3개 이상 필요 — 점 개수 제한 없음)
        </p>
        <div className="map-boundary-control__actions">
          <button onClick={undoLastPoint} disabled={draftPoints.length === 0}>
            마지막 점 취소
          </button>
          <button onClick={finishDrawing} disabled={draftPoints.length < 3}>
            완료
          </button>
          <button onClick={cancelDrawing}>취소</button>
        </div>
      </div>
    );
  }

  if (!selectedId) {
    return (
      <div className="map-boundary-control map-boundary-control--empty">
        순위표에서 사업을 선택하면 여기서 바로 경계를 그릴 수 있어요
      </div>
    );
  }

  const boundary = boundaries[selectedId];
  return (
    <div className="map-boundary-control">
      {boundary ? (
        <>
          <span>경계 있음 ({boundary.length}개 점)</span>
          <div className="map-boundary-control__actions">
            <button onClick={() => startDrawing(selectedId)}>다시 그리기</button>
            <button onClick={() => clearBoundary(selectedId)}>삭제</button>
          </div>
        </>
      ) : (
        <button onClick={() => startDrawing(selectedId)}>구역 경계 그리기 ✏️</button>
      )}
    </div>
  );
}
