/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_JS_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// 카카오맵 JS SDK는 <script> 태그로 전역에 로드되고 npm 타입 패키지가 없어
// 필요한 만큼만 느슨하게 선언한다 (lib/kakaoMapLoader.ts, components/map/MapView.tsx에서 사용).
declare global {
  interface Window {
    kakao: typeof kakao;
  }

  interface KakaoLatLng {
    getLat(): number;
    getLng(): number;
  }

  interface KakaoMap {
    setCenter(latlng: KakaoLatLng): void;
    panTo(latlng: KakaoLatLng): void;
    setLevel(level: number, options?: { anchor?: KakaoLatLng }): void;
    getLevel(): number;
  }

  interface KakaoCustomOverlay {
    setMap(map: KakaoMap | null): void;
  }

  const kakao: {
    maps: {
      load(callback: () => void): void;
      Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap;
      LatLng: new (lat: number, lng: number) => KakaoLatLng;
      CustomOverlay: new (options: {
        position: KakaoLatLng;
        content: HTMLElement | string;
        yAnchor?: number;
        zIndex?: number;
      }) => KakaoCustomOverlay;
      event: {
        addListener(target: unknown, type: string, handler: (...args: unknown[]) => void): void;
      };
    };
  };
}

export {};
