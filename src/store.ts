import { create } from 'zustand';
import { Vector3 } from 'three';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  status: GameStatus;
  score: number;
  totalNPCs: number;
  setScore: (score: number) => void;
  setStatus: (status: GameStatus) => void;
  joystickVector: { x: number; y: number };
  setJoystickVector: (v: { x: number; y: number }) => void;
  isShooting: boolean;
  setShooting: (s: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'playing',
  score: 0,
  totalNPCs: 45,
  setScore: (score) => set({ score }),
  setStatus: (status) => set({ status }),
  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (v) => set({ joystickVector: v }),
  isShooting: false,
  setShooting: (s) => set({ isShooting: s }),
}));
