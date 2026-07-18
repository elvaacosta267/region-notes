// 카카오맵 JS SDK는 <script> 태그로 로드해야 하는 전역 라이브러리라 npm import가 안 된다.
// autoload=false로 받아 kakao.maps.load()가 끝난 뒤에만 지도를 생성하도록 한 번만 로드한다.
let loadPromise: Promise<void> | null = null;

export function loadKakaoMaps(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const appKey = import.meta.env.VITE_KAKAO_JS_KEY;
    if (!appKey) {
      reject(new Error("VITE_KAKAO_JS_KEY가 설정되지 않았습니다 (app/.env.local 확인)"));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve());
    script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
