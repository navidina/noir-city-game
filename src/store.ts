import { create } from 'zustand';
import { Vector3 } from 'three';

export type GameStatus = 'playing' | 'won' | 'lost';
export type WeaponType = 'pistol' | 'tommy' | 'shotgun';

export interface WeaponStats {
  id: WeaponType;
  name: string;
  fireDelay: number;
  ammoCapacity: number;
  reloadTime: number; // in seconds
  bulletsPerShot: number;
  spread: number;
  damage: number;
}

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  pistol: { id: 'pistol', name: 'Pistol', fireDelay: 0.22, ammoCapacity: 24, reloadTime: 1.5, bulletsPerShot: 2, spread: 0.05, damage: 1 },
  tommy: { id: 'tommy', name: 'Tommy Gun', fireDelay: 0.1, ammoCapacity: 45, reloadTime: 2.0, bulletsPerShot: 1, spread: 0.15, damage: 0.8 },
  shotgun: { id: 'shotgun', name: 'Shotgun', fireDelay: 0.8, ammoCapacity: 8, reloadTime: 1.8, bulletsPerShot: 6, spread: 0.35, damage: 1 },
};

export interface GameState {
  status: GameStatus;
  score: number;
  wave: number;
  totalNPCs: number;
  health: number;
  maxHealth: number;
  setHealth: (health: number) => void;
  setScore: (score: number) => void;
  setWave: (wave: number) => void;
  setTotalNPCs: (count: number) => void;
  setStatus: (status: GameStatus) => void;
  joystickVector: { x: number; y: number };
  setJoystickVector: (v: { x: number; y: number }) => void;
  shootVector: { x: number; y: number };
  setShootVector: (v: { x: number; y: number }) => void;
  isShooting: boolean;
  setShooting: (s: boolean) => void;
  playerPosition: [number, number, number];
  setPlayerPosition: (p: [number, number, number]) => void;
  minimapCtx: CanvasRenderingContext2D | null;
  setMinimapCtx: (ctx: CanvasRenderingContext2D | null) => void;
  weapon: WeaponType;
  setWeapon: (w: WeaponType) => void;
  ammo: number;
  setAmmo: (a: number) => void;
  isReloading: boolean;
  setReloading: (r: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'playing',
  score: 0,
  wave: 1,
  totalNPCs: 15, // Start with fewer enemies on wave 1
  health: 1000,
  maxHealth: 1000,
  setHealth: (health) => set({ health }),
  setScore: (score) => set({ score }),
  setWave: (wave) => set({ wave }),
  setTotalNPCs: (count) => set({ totalNPCs: count }),
  setStatus: (status) => set({ status }),
  joystickVector: { x: 0, y: 0 },
  setJoystickVector: (v) => set({ joystickVector: v }),
  shootVector: { x: 0, y: 0 },
  setShootVector: (v) => set({ shootVector: v }),
  isShooting: false,
  setShooting: (s) => set({ isShooting: s }),
  playerPosition: [0, 0, 0],
  setPlayerPosition: (p) => set({ playerPosition: p }),
  minimapCtx: null,
  setMinimapCtx: (ctx) => set({ minimapCtx: ctx }),
  weapon: 'pistol',
  setWeapon: (w) => set({ weapon: w }),
  ammo: 24,
  setAmmo: (a) => set({ ammo: a }),
  isReloading: false,
  setReloading: (r) => set({ isReloading: r })
}));
