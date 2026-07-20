/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KAKAO_JS_KEY: string;
  // Firebase 웹 설정값 — Kakao JS 키와 마찬가지로 공개돼도 되는 값(비밀키 아님).
  // 실제 접근 제어는 Firestore 보안 규칙이 담당한다 (lib/firebaseSync.ts 참고).
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
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
    setBounds(bounds: KakaoLatLngBounds): void;
    relayout(): void;
  }

  interface KakaoLatLngBounds {
    extend(latlng: KakaoLatLng): void;
  }

  interface KakaoCustomOverlay {
    setMap(map: KakaoMap | null): void;
  }

  interface KakaoPolygon {
    setMap(map: KakaoMap | null): void;
  }

  interface KakaoMarker {
    setMap(map: KakaoMap | null): void;
    getPosition(): KakaoLatLng;
  }

  interface KakaoMouseEvent {
    latLng: KakaoLatLng;
  }

  const kakao: {
    maps: {
      load(callback: () => void): void;
      Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap;
      LatLng: new (lat: number, lng: number) => KakaoLatLng;
      LatLngBounds: new () => KakaoLatLngBounds;
      CustomOverlay: new (options: {
        position: KakaoLatLng;
        content: HTMLElement | string;
        yAnchor?: number;
        zIndex?: number;
      }) => KakaoCustomOverlay;
      Polygon: new (options: {
        path: KakaoLatLng[];
        strokeWeight?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeStyle?: string;
        fillColor?: string;
        fillOpacity?: number;
      }) => KakaoPolygon;
      Marker: new (options: {
        position: KakaoLatLng;
        draggable?: boolean;
      }) => KakaoMarker;
      event: {
        addListener(
          target: unknown,
          type: string,
          handler: (e: KakaoMouseEvent) => void
        ): void;
        removeListener(target: unknown, type: string, handler: (e: KakaoMouseEvent) => void): void;
      };
    };
  };
}

export {};
