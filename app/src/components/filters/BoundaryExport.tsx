import { useState } from "react";
import { useBoundaryStore } from "../../store/boundaryStore";
import "./BoundaryExport.css";

// 사용자가 지도에서 직접 그린 구역 경계는 브라우저 localStorage에만 있다(백엔드 없는
// 정적 사이트라서 — MapView.tsx, store/boundaryStore.ts 참고). 기기를 바꾸거나
// 캐시를 지우면 사라지므로, 여기서 JSON으로 내보내 다른 기기의 BoundaryImport.tsx에
// 붙여넣으면 그 자리에서 바로 반영된다(Claude/git 불필요 — 당일 동기화용, CLAUDE.md
// 참고). 영구 백업이 필요하면 같은 JSON을 Claude에게 줘서 geo/plan_boundaries.geojson
// 에 커밋할 수도 있다(선택 사항).
export function BoundaryExport() {
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const [json, setJson] = useState("");
  const count = Object.keys(boundaries).length;

  if (count === 0) return null;

  const handleExport = async () => {
    const text = JSON.stringify(boundaries, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      // 클립보드 권한이 막힌 환경(포커스 없음, 권한 거부 등) 대비 —
      // 텍스트를 화면에 직접 보여줘서 수동으로 선택/복사할 수 있게 한다.
      setJson(text);
      setStatus("fallback");
    }
  };

  return (
    <div className="boundary-export">
      <button onClick={handleExport}>
        직접 그린 경계 {count}건 내보내기(복사)
      </button>
      {status === "copied" && (
        <span className="boundary-export__status">
          복사됨 — 다른 기기의 "가져오기"에 붙여넣으세요 (영구 백업하려면 Claude에게도 전달 가능)
        </span>
      )}
      {status === "fallback" && (
        <>
          <span className="boundary-export__status">
            클립보드 복사가 막혀 있어요 — 아래 내용을 직접 선택해 복사한 뒤 다른 기기의 "가져오기"에 붙여넣으세요
          </span>
          <textarea
            className="boundary-export__fallback"
            readOnly
            value={json}
            onFocus={(e) => e.target.select()}
          />
        </>
      )}
    </div>
  );
}
