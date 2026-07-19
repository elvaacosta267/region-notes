import { useState } from "react";
import { useBoundaryStore } from "../../store/boundaryStore";
import "./BoundaryExport.css";

// 사용자가 지도에서 직접 그린 구역 경계는 브라우저 localStorage에만 있다(백엔드 없는
// 정적 사이트라서 — MapView.tsx, store/boundaryStore.ts 참고). 기기를 바꾸거나
// 캐시를 지우면 사라지므로, 여기서 JSON으로 내보내 Claude에게 전달하면
// geo/plan_boundaries.geojson 등으로 영구 커밋할 수 있다.
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
        <span className="boundary-export__status">복사됨 — Claude와의 대화에 붙여넣어 전달하세요</span>
      )}
      {status === "fallback" && (
        <textarea
          className="boundary-export__fallback"
          readOnly
          value={json}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}
