import { initializeApp } from "firebase/app";

// Firebase 웹 설정값은 Kakao JS 키와 마찬가지로 공개돼도 되는 값이다(비밀키 아님) —
// 실제 접근 제어는 Firestore 보안 규칙(문서 경로=동기화 코드를 아는 사람만 get/write,
// list는 금지)이 담당한다. app/.env.local(로컬)과 GitHub Actions repo variable(배포)
// 양쪽에 VITE_FIREBASE_* 가 설정돼 있어야 한다 — VITE_KAKAO_JS_KEY와 동일한 패턴.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
