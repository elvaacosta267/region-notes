import { useState } from "react";
import { useBoundaryStore, type LatLng } from "../../store/boundaryStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
import "./LocalDataImport.css";

interface CombinedExport {
  boundaries?: Record<string, LatLng[]>;
  nameOverrides?: Record<string, string>;
  notes?: Record<string, string>;
  extraLinks?: Record<string, string>;
}

// PC 등에서 "이 기기 수정사항 내보내기"로 복사한 JSON을 다른 기기(주로 모바일)에
// 붙여넣어 즉시 반영하는 입력창 — Claude/git/배포 대기 없이 붙여넣는 즉시 이
// 브라우저의 localStorage(boundaryStore + planOverrideStore)에 반영된다.
export function LocalDataImport() {
  const importBoundaries = useBoundaryStore((s) => s.importBoundaries);
  const importOverrides = usePlanOverrideStore((s) => s.importOverrides);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleImport = () => {
    try {
      const parsed = JSON.parse(text) as CombinedExport | Record<string, LatLng[]>;
      // 예전 형식(경계만 담긴 평평한 {planId: LatLng[]})과 새 형식({boundaries,
      // nameOverrides, notes, extraLinks}) 둘 다 지원 — 예전에 복사해둔 걸 아직
      // 못 붙여넣은 사용자를 위한 하위호환.
      const isCombined =
        "boundaries" in parsed || "nameOverrides" in parsed || "notes" in parsed || "extraLinks" in parsed;
      if (isCombined) {
        const data = parsed as CombinedExport;
        if (data.boundaries) importBoundaries(data.boundaries);
        importOverrides({
          nameOverrides: data.nameOverrides,
          notes: data.notes,
          extraLinks: data.extraLinks,
        });
      } else {
        importBoundaries(parsed as Record<string, LatLng[]>);
      }
      setStatus("success");
      setText("");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    }
  };

  if (!open) {
    return (
      <button type="button" className="local-data-import__toggle" onClick={() => setOpen(true)}>
        다른 기기 수정사항 가져오기
      </button>
    );
  }

  return (
    <div className="local-data-import">
      <p className="local-data-import__hint">
        PC 등에서 "이 기기 수정사항 내보내기"로 복사한 JSON을 여기 붙여넣으세요 (경계,
        사업명 수정, 메모, 링크가 모두 함께 반영됩니다 — 같은 Apple 기기라면 유니버설
        클립보드로 자동 복사돼 있을 수 있어요).
      </p>
      <textarea
        className="local-data-import__textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='{"boundaries": {...}, "nameOverrides": {...}, "notes": {...}, "extraLinks": {...}}'
      />
      <div className="local-data-import__actions">
        <button type="button" onClick={handleImport} disabled={!text.trim()}>
          가져오기
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          닫기
        </button>
      </div>
      {status === "success" && <span className="local-data-import__status">가져왔습니다</span>}
      {status === "error" && (
        <span className="local-data-import__status local-data-import__status--error">
          JSON 형식이 올바르지 않습니다 — 내보내기 버튼으로 복사한 내용 그대로 붙여넣었는지 확인하세요
        </span>
      )}
    </div>
  );
}
