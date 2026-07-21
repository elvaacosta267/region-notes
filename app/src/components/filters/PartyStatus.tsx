import "./PartyStatus.css";

// 시장/구청장이 누구인지는 점수에 영향을 주지 않으므로(정치 레벨은 비점수화 원칙,
// db/schema.md) 이름 없이 소속 정당만 색 점으로 표시한다. 실존 인물의 정당 정보라
// 확인 없이 임의로 넣지 않고, 선거 결과가 확인된 값만 채운다 — 다음 지방선거 등으로
// 바뀌면 이 값만 갱신.
const PARTY_COLOR: Record<string, string> = {
  더불어민주당: "#2563eb",
  국민의힘: "#dc2626",
};

const OFFICIALS = [
  { label: "시장", role: "인천광역시장", party: "더불어민주당" },
  { label: "구청장", role: "부평구청장", party: "더불어민주당" },
];

export function PartyStatus() {
  return (
    <div className="party-status" title="참고용 정보이며 점수에는 반영되지 않습니다">
      {OFFICIALS.map(({ label, role, party }) => (
        <span key={label} className="party-status__item" title={`${role}: ${party}`}>
          <span
            className="party-status__dot"
            style={{ background: PARTY_COLOR[party] ?? "#888" }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}
