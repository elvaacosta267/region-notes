import { useState } from "react";
import { useBoundaryStore } from "../../store/boundaryStore";
import "./BoundaryImport.css";

// PC에서 "직접 그린 경계 내보내기"로 복사한 JSON을 다른 기기(주로 모바일)에
// 붙여넣어 즉시 반영하는 입력창 — git 커밋/배포를 거치는 geo/plan_boundaries.geojson
// 경로(영구 백업 + 새 기기 기본값 용도)와 달리, 이건 PC↔폰 당일 동기화가 목적이라
// Claude 개입이나 배포 대기 없이 붙여넣는 즉시 이 브라우저의 localStorage에 반영된다.
export function BoundaryImport() {
  const importBoundaries = useBoundaryStore((s) => s.importBoundaries);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleImport = () => {
    try {
      const parsed = JSON.parse(text) as Record<string, { lat: number; lng: number }[]>;
      importBoundaries(parsed);
      setStatus("success");
      setText("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  };

  if (!open) {
    return (
      <button type="button" className="boundary-import__toggle" onClick={() => setOpen(true)}>
        다른 기기 경계 가져오기
      </button>
    );
  }

  return (
    <div className="boundary-import">
      <p className="boundary-import__hint">
        PC 등에서 "직접 그린 경계 내보내기"로 복사한 JSON을 여기 붙여넣으세요 (같은
        Apple 기기라면 유니버설 클립보드로 자동 복사돼 있을 수 있어요).
      </p>
      <textarea
        className="boundary-import__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"P304": [{"lat":..,"lng":..}, ...], ...}'
      />
      <div className="boundary-import__actions">
        <button type="button" onClick={handleImport} disabled={!text.trim()}>
          가져오기
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      {status === "success" && <span className="boundary-import__status">가져왔습니다</span>}
      {status === "error" && (
        <span className="boundary-import__status boundary-import__status--error">
          JSON 형식이 올바르지 않습니다 — 내보내기 버튼으로 복사한 내용 그대로 붙여넣었는지 확인하세요
        </span>
      )}
    </div>
  );
}
