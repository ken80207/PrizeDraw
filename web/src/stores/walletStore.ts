/**
 * Wallet balance store backed by Zustand.
 */

import { create } from "zustand";

export interface WalletStore {
  drawPointsBalance: number;
  revenuePointsBalance: number;

  setBalances: (draw: number, revenue: number) => void;
  addDrawPoints: (amount: number) => void;
  deductDrawPoints: (amount: number) => void;
  addRevenuePoints: (amount: number) => void;
  deductRevenuePoints: (amount: number) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  drawPointsBalance: 0,
  revenuePointsBalance: 0,

  setBalances(draw: number, revenue: number) {
    set({ drawPointsBalance: draw, revenuePointsBalance: revenue });
  },

  addDrawPoints(amount: number) {
    set((state) => ({
      drawPointsBalance: state.drawPointsBalance + amount,
    }));
  },

  deductDrawPoints(amount: number) {
    set((state) => ({
      drawPointsBalance: Math.max(0, state.drawPointsBalance - amount),
    }));
  },

  addRevenuePoints(amount: number) {
    set((state) => ({
      revenuePointsBalance: state.revenuePointsBalance + amount,
    }));
  },

  deductRevenuePoints(amount: number) {
    set((state) => ({
      revenuePointsBalance: Math.max(0, state.revenuePointsBalance - amount),
    }));
  },
}));
