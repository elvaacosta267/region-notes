import "./Legend.css";

const CATEGORIES: { label: string; color: string }[] = [
  { label: "신도시(공공주택지구)/택지개발", color: "#2563eb" },
  { label: "광역교통", color: "#dc2626" },
  { label: "재건축(노후계획도시)", color: "#059669" },
  { label: "재개발", color: "#d97706" },
  { label: "재건축(도시정비법)", color: "#ea580c" },
  { label: "주거환경개선", color: "#0891b2" },
];

export function Legend() {
  return (
    <div className="legend">
      {CATEGORIES.map((c) => (
        <div key={c.label} className="legend__row">
          <span className="legend__dot" style={{ background: c.color }} />
          {c.label}
        </div>
      ))}
      <div className="legend__hint">마커 크기 = 실현가능성 점수</div>
    </div>
  );
}
