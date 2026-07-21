import { useSyncStore } from "../../store/syncStore";
import "./SyncSetup.css";

// 편집 기기 지정 UI — 예전엔 기기마다 동기화 코드를 만들고 서로 입력해 맞춰야
// 했는데(그 결과 PC와 모바일이 다른 코드에 연결되거나 연결 자체가 누락되는 문제가
// 반복됐다), 이제 Firestore 문서 경로가 고정(VITE_SYNC_ID)이라 코드를 다룰 필요가
// 없다. 유일하게 남은 선택은 "이 브라우저가 편집 기기인가"뿐이다 — 켜면 이후 이
// 브라우저에서 고치는 모든 내용이 실시간으로 다른 모든 화면에 반영된다
// (hooks/useFirestoreSync.ts). 헤더 오른쪽 구석에 작게 표시되는 배지라 설명은
// title 툴팁으로만 제공하고 화면 공간을 차지하지 않는다.
export function SyncSetup() {
  const isEditor = useSyncStore((s) => s.isEditor);
  const setIsEditor = useSyncStore((s) => s.setIsEditor);

  if (isEditor) {
    return (
      <div className="sync-setup-badge">
        <span className="sync-setup-badge__status">✏️ 편집 기기</span>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "이 기기의 편집 권한을 해제할까요? 이후 이 화면은 보기 전용으로 바뀝니다."
              )
            ) {
              setIsEditor(false);
            }
          }}
        >
          해제
        </button>
      </div>
    );
  }

  return (
    <div className="sync-setup-badge">
      <span className="sync-setup-badge__status sync-setup-badge__status--readonly">
        👀 보기 전용
      </span>
      <button
        type="button"
        title="이 브라우저를 편집 기기로 설정하면, 이후 여기서 고친 사업명·메모·경계 등이 버튼 없이 실시간으로 다른 모든 화면에 반영됩니다. 편집 기기는 한 곳으로만 유지하세요."
        onClick={() => {
          if (
            window.confirm(
              "이 브라우저를 편집 기기로 설정할까요? 이후 이 브라우저에서 고치는 모든 내용이 실시간으로 다른 모든 화면에 반영됩니다."
            )
          ) {
            setIsEditor(true);
          }
        }}
      >
        편집 기기로 설정
      </button>
    </div>
  );
}
