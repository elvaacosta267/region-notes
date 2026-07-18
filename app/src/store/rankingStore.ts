import { create } from "zustand";
import { DEFAULT_WEIGHTS, type FeasibilityWeights } from "../lib/types";

interface RankingState {
  weights: FeasibilityWeights;
  setWeight: (key: keyof FeasibilityWeights, value: number) => void;
  resetWeights: () => void;
  selectedId: string | null;
  selectPlan: (id: string | null) => void;
}

export const useRankingStore = create<RankingState>((set) => ({
  weights: DEFAULT_WEIGHTS,
  setWeight: (key, value) =>
    set((state) => ({ weights: { ...state.weights, [key]: value } })),
  resetWeights: () => set({ weights: DEFAULT_WEIGHTS }),
  selectedId: null,
  selectPlan: (id) => set({ selectedId: id }),
}));
