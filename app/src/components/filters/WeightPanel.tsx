import { useState } from "react";
import { useRankingStore } from "../../store/rankingStore";
import type { FeasibilityWeights } from "../../lib/types";
import "./WeightPanel.css";

const LABELS: Record<keyof FeasibilityWeights, string> = {
  A_stage_progress: "사업단계 진척률",
  B_pretest: "예타상태",
  C_delay: "지연여부",
  D_infra: "인프라연계",
  E_price_attractiveness: "투자금 매력도",
  F_upside_potential: "잔여 개발이익 여력",
};

export function WeightPanel() {
  const [open, setOpen] = useState(false);
  const weights = useRankingStore((s) => s.weights);
  const setWeight = useRankingStore((s) => s.setWeight);
  const resetWeights = useRankingStore((s) => s.resetWeights);

  return (
    <div className="weight-panel">
      <button className="weight-panel__toggle" onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} 가중치 조절 (고급)
      </button>
      {open && (
        <div className="weight-panel__body">
          <p className="weight-panel__hint">
            각 요소의 중요도를 직접 조절할 수 있습니다. 합이 1이 아니어도 자동으로
            정규화되어 점수는 항상 0~100 사이로 계산됩니다.
          </p>
          {(Object.keys(weights) as (keyof FeasibilityWeights)[]).map((key) => (
            <label key={key} className="weight-panel__row">
              <span className="weight-panel__label">{LABELS[key]}</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weights[key]}
                onChange={(e) => setWeight(key, Number(e.target.value))}
              />
              <span className="weight-panel__value">{weights[key].toFixed(2)}</span>
            </label>
          ))}
          <button className="weight-panel__reset" onClick={resetWeights}>
            기본값으로 초기화
          </button>
        </div>
      )}
    </div>
  );
}
