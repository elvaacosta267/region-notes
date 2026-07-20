import { useState } from "react";
import { useBoundaryStore } from "../../store/boundaryStore";
import { usePlanOverrideStore } from "../../store/planOverrideStore";
import "./LocalDataExport.css";

// 이 브라우저에만 저장된 로컬 수정사항(직접 그린 경계, 사업명 수정, 메모, 관련
// 링크)을 한 번에 묶어 내보낸다. 원래는 경계만 내보낼 수 있어서 "PC에서 사업명
// 고친 게 모바일에 하나도 안 보인다"는 문제가 있었다 — 이제 이 버튼 하나로
// 4종류 전부 같은 JSON에 담긴다. LocalDataImport.tsx에 붙여넣으면 즉시 반영되고
// (Claude/git 불필요, 당일 기기간 동기화), 경계만 별도로 영구 백업하고 싶으면
// 같은 JSON을 Claude에게 전달해 geo/plan_boundaries.geojson에 커밋할 수도 있다
// (선택 사항 — CLAUDE.md 참고). notes(개인 메모)는 비공개 정보일 수 있어 git에는
// 절대 올리지 않는다 — 기기간 동기화로만 옮긴다.
export function LocalDataExport() {
  const boundaries = useBoundaryStore((s) => s.boundaries);
  const nameOverrides = usePlanOverrideStore((s) => s.nameOverrides);
  const notes = usePlanOverrideStore((s) => s.notes);
  const extraLinks = usePlanOverrideStore((s) => s.extraLinks);
  const [status, setStatus] = useState<"idle" | "copied" | "fallback">("idle");
  const [json, setJson] = useState("");

  const boundaryCount = Object.keys(boundaries).length;
  const overrideCount =
    Object.keys(nameOverrides).length + Object.keys(notes).length + Object.keys(extraLinks).length;
  const totalCount = boundaryCount + overrideCount;

  if (totalCount === 0) return null;

  const handleExport = async () => {
    const text = JSON.stringify({ boundaries, nameOverrides, notes, extraLinks }, null, 2);
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
    <div className="local-data-export">
      <button onClick={handleExport}>
        이 기기 수정사항 내보내기(복사) — 경계 {boundaryCount}건, 사업명/메모/링크 {overrideCount}건
      </button>
      {status === "copied" && (
        <span className="local-data-export__status">
          복사됨 — 다른 기기의 "가져오기"에 붙여넣으세요 (경계는 영구 백업하려면 Claude에게도 전달 가능, 사업명·메모·링크는 기기간 동기화로만 사용)
        </span>
      )}
      {status === "fallback" && (
        <>
          <span className="local-data-export__status">
            클립보드 복사가 막혀 있어요 — 아래 내용을 직접 선택해 복사한 뒤 다른 기기의 "가져오기"에 붙여넣으세요
          </span>
          <textarea
            className="local-data-export__fallback"
            readOnly
            value={json}
            onFocus={(e) => e.target.select()}
          />
        </>
      )}
    </div>
  );
}
