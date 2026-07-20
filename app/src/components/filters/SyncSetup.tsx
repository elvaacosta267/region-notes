import { useState } from "react";
import { useSyncStore } from "../../store/syncStore";
import "./SyncSetup.css";

// 사람이 손으로 다른 기기에 옮기기 편한 코드 — Firestore 문서 경로로 쓰인다.
// 이 코드를 아는 사람만 데이터에 접근 가능하다(보안 규칙에서 list 금지, get만 허용
// — CLAUDE.md 참고). 128비트 UUID 전체 대신 앞 12자만 써도 이 앱 하나가 쓰는
// 컬렉션 안에서 우연히 겹칠 확률은 무시할 수준이다.
function generateSyncCode(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// 실시간 동기화 코드 발급/입력 UI — 한 번만 설정해두면 이후 모든 경계/사업명/메모/
// 링크 수정이 기기 간에 자동으로(수 초 내) 반영된다(hooks/useFirestoreSync.ts).
export function SyncSetup() {
  const syncId = useSyncStore((s) => s.syncId);
  const setSyncId = useSyncStore((s) => s.setSyncId);
  const [inputCode, setInputCode] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  if (syncId) {
    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(syncId);
        setCopyStatus("copied");
        setTimeout(() => setCopyStatus("idle"), 2000);
      } catch {
        // 클립보드 권한이 막혀도 코드가 아래 <code>로 항상 화면에 보이므로 수동 복사 가능
      }
    };
    return (
      <div className="sync-setup sync-setup--connected">
        <span className="sync-setup__status">● 실시간 동기화 켜짐</span>
        <code className="sync-setup__code">{syncId}</code>
        <button type="button" onClick={handleCopy}>
          {copyStatus === "copied" ? "복사됨" : "코드 복사"}
        </button>
        <button type="button" onClick={() => setSyncId(null)}>
          연결 해제
        </button>
      </div>
    );
  }

  return (
    <div className="sync-setup">
      <p className="sync-setup__hint">
        코드를 만들고 다른 기기에 똑같이 입력하면, 이후 이 기기에서 고친 내용이
        버튼 없이 자동으로 반영됩니다.
      </p>
      <div className="sync-setup__actions">
        <button type="button" onClick={() => setSyncId(generateSyncCode())}>
          새 동기화 코드 만들기
        </button>
        <input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value.trim())}
          placeholder="다른 기기에서 만든 코드 입력"
        />
        <button type="button" onClick={() => setSyncId(inputCode)} disabled={!inputCode}>
          연결
        </button>
      </div>
    </div>
  );
}
