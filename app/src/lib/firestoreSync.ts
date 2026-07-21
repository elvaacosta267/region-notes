import { doc, getFirestore, onSnapshot, setDoc } from "firebase/firestore";
import { firebaseApp } from "./firebase";
import { useBoundaryStore } from "../store/boundaryStore";
import { usePlanOverrideStore } from "../store/planOverrideStore";

// 이 프로젝트 전체에서 딱 하나만 쓰는 고정 Firestore 문서 경로 — VITE_FIREBASE_*와
// 같은 취급의 공개 빌드값이다(store/syncStore.ts 상단 주석의 보안 모델 참고).
// 기기마다 코드를 만들고 맞춰 입력하던 예전 방식과 달리, 이 값이 고정이라 모든
// 기기가 설정 없이 자동으로 같은 문서를 구독한다.
const SYNC_ID = import.meta.env.VITE_SYNC_ID;

let writeTimer: ReturnType<typeof setTimeout> | null = null;

function pushLocalToFirestore() {
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
// Firestore가 유일한 진실이다 — 원격 변경을 그대로 로컬에 반영만 하고, 이 기기는
// 절대 쓰지 않는다.
//
// readOnly: false(편집 기기, 이 프로젝트에서 딱 하나여야 함)면 정확히 반대다 — 이
// 브라우저의 로컬 상태가 유일한 진실이고, Firestore는 절대 읽어서 로컬에 반영하지
// 않는다. 예전 구현은 편집 기기도 원격 스냅샷을 로컬에 그대로 덮어썼는데, 그 결과
// 이 기기가 연결되는 순간 Firestore에 남아있던 값(다른 기기가 쓴 값이든, 테스트로
// 남은 값이든)이 이 기기의 로컬 경계/사업명 수정 내용을 통째로 지워버리는 사고가
// 실제로 발생했다 — "PC에서만 수정, 나머지는 전부 실시간 보기 전용"이라는 모델
// 자체가 편집 기기의 로컬 상태를 유일한 소스 오브 트루스로 취급해야 성립하므로,
// 편집 기기는 연결 즉시(그리고 로컬이 바뀔 때마다) 자기 상태를 Firestore로
// 밀어넣기만 하고 절대 되읽지 않는다.
export function startFirestoreSync(options: { readOnly?: boolean } = {}): () => void {
  const readOnly = options.readOnly ?? true;

  if (!readOnly) {
    pushLocalToFirestore();
    const unsubscribeBoundary = useBoundaryStore.subscribe((state, prevState) => {
      if (state.boundaries !== prevState.boundaries) pushLocalToFirestore();
    });
    const unsubscribeOverride = usePlanOverrideStore.subscribe(() => pushLocalToFirestore());
    return () => {
      unsubscribeBoundary();
      unsubscribeOverride();
      if (writeTimer) clearTimeout(writeTimer);
    };
  }

  const db = getFirestore(firebaseApp);
  const ref = doc(db, "syncs", SYNC_ID, "state", "data");
  const unsubscribeSnapshot = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      useBoundaryStore.getState().replaceBoundaries(data.boundaries ?? {});
      usePlanOverrideStore.getState().replaceOverrides({
        nameOverrides: data.nameOverrides ?? {},
        notes: data.notes ?? {},
        extraLinks: data.extraLinks ?? {},
      });
    },
    (err) => {
      console.error("실시간 동기화 수신 실패:", err);
    }
  );
  return () => unsubscribeSnapshot();
}
