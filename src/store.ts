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
  shootVector: { x: number; y: number };
  setShootVector: (v: { x: number; y: number }) => void;
  isShooting: boolean;
  setShooting: (s: boolean) => void;
  playerPosition: [number, number, number];
  setPlayerPosition: (p: [number, number, number]) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'playing',
  score: 0,
  totalNPCs: 45,
  setScore: (score) => set({ score }),
  setStatus: (status) => set({ status }),
  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (v) => set({ joystickVector: v }),
  shootVector: { x: 0, y: 0 },
  setShootVector: (v) => set({ shootVector: v }),
  isShooting: false,
  setShooting: (s) => set({ isShooting: s }),
  playerPosition: [0, 0, 0],
  setPlayerPosition: (p) => set({ playerPosition: p }),
}));
