import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { firebaseApp } from "./firebase";
import { useBoundaryStore } from "../store/boundaryStore";
import { usePlanOverrideStore } from "../store/planOverrideStore";

// 이 프로젝트 전체에서 딱 하나만 쓰는 고정 Firestore 문서 경로 — VITE_FIREBASE_*와
// 같은 취급의 공개 빌드값이다(store/syncStore.ts 상단 주석의 보안 모델 참고).
// 기기마다 코드를 만들고 맞춰 입력하던 예전 방식과 달리, 이 값이 고정이라 모든
// 기기가 설정 없이 자동으로 같은 문서를 구독한다.
const SYNC_ID = import.meta.env.VITE_SYNC_ID;

// PC에서 그린 경계/고친 사업명·메모·링크가 다른 기기에 버튼 없이 자동으로(수 초 내)
// 반영되도록 하는 실시간 동기화 엔진.
//
// 문서 하나(syncs/{SYNC_ID}/state/data)에 boundaryStore + planOverrideStore를 합쳐
// 저장한다. 로컬 변경 -> Firestore로 write, Firestore 변경(편집 기기가 쓴 것) ->
// 로컬 store로 apply, 두 방향을 동시에 구독하므로 무한루프를 막아야 한다:
// applyingRemote 플래그를 원격 값을 로컬에 적용하는 그 순간만 true로 켜두고,
// 로컬 변경 구독 콜백은 이 플래그가 true면 아무것도 안 한다(Zustand의 set()은
// 구독자를 동기적으로 호출하므로 이 플래그로 정확히 구분된다).
let applyingRemote = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function pushLocalToFirestore() {
  if (applyingRemote) return;
  if (writeTimer) clearTimeout(writeTimer);
  // 짧은 시간에 여러 필드가 연달아 바뀌는 경우(예: 경계를 여러 점 찍는 중)를
  // 하나의 write로 묶기 위한 디바운스 — 매 클릭마다 네트워크 요청을 보내지 않는다.
  writeTimer = setTimeout(() => {
    const { boundaries } = useBoundaryStore.getState();
    const { nameOverrides, notes, extraLinks } = usePlanOverrideStore.getState();
    const db = getFirestore(firebaseApp);
    setDoc(doc(db, "syncs", SYNC_ID, "state", "data"), {
      boundaries,
      nameOverrides,
      notes,
      extraLinks,
      updatedAt: Date.now(),
    }).catch((err) => {
      console.error("실시간 동기화 저장 실패:", err);
    });
  }, 400);
}

// readOnly: true(편집 기기로 설정되지 않은 모든 화면 — hooks/useViewOnlyMode.ts)면
// 원격 값을 받아서 로컬에 반영만 하고, 이 기기의 어떤 변화도 Firestore에 쓰지
// 않는다 — 문서가 아직 없을 때의 "초기값 올리기"도 쓰기이므로 건너뛴다. UI 쪽에서도
// 편집 컨트롤을 숨기지만(각 컴포넌트의 useViewOnlyMode 체크), 여기서도 한 번 더
// 막아 이중으로 안전하게 한다.
export function startFirestoreSync(options: { readOnly?: boolean } = {}): () => void {
  const readOnly = options.readOnly ?? true;
  const db = getFirestore(firebaseApp);
  const ref = doc(db, "syncs", SYNC_ID, "state", "data");

  const unsubscribeSnapshot = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        if (!readOnly) pushLocalToFirestore(); // 편집 기기가 처음 연결 — 초기값으로 올림
        return;
      }
      const data = snap.data();
      applyingRemote = true;
      useBoundaryStore.getState().replaceBoundaries(data.boundaries ?? {});
      usePlanOverrideStore.getState().replaceOverrides({
        nameOverrides: data.nameOverrides ?? {},
        notes: data.notes ?? {},
        extraLinks: data.extraLinks ?? {},
      });
      applyingRemote = false;
    },
    (err) => {
      console.error("실시간 동기화 수신 실패:", err);
    }
  );

  if (readOnly) {
    return () => unsubscribeSnapshot();
  }

  // boundaryStore는 drawingPlanId/draftPoints(그리는 중 임시 상태)도 같은 store에
  // 있어 매 꼭짓점 클릭마다 알림이 오는데, 그건 아직 boundaries에 반영 전이라 굳이
  // 매번 write할 필요가 없다 — boundaries 참조가 실제로 바뀐 경우에만 push한다.
  const unsubscribeBoundary = useBoundaryStore.subscribe((state, prevState) => {
    if (state.boundaries !== prevState.boundaries) pushLocalToFirestore();
  });
  const unsubscribeOverride = usePlanOverrideStore.subscribe(() => pushLocalToFirestore());

  return () => {
    unsubscribeSnapshot();
    unsubscribeBoundary();
    unsubscribeOverride();
    if (writeTimer) clearTimeout(writeTimer);
  };
}
