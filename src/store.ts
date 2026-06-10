import { create } from 'zustand';
import { DEFAULT_STATS, PlayerStats, UpgradeDef, applyUpgrade } from './upgrades';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'upgrading' | 'won' | 'lost';
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
  reserve: number; // total backup ammo when picked up (Infinity = unlimited)
}

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  pistol: { id: 'pistol', name: 'Pistol', fireDelay: 0.22, ammoCapacity: 24, reloadTime: 1.5, bulletsPerShot: 2, spread: 0.05, damage: 1, reserve: Infinity },
  tommy: { id: 'tommy', name: 'Tommy Gun', fireDelay: 0.1, ammoCapacity: 45, reloadTime: 2.0, bulletsPerShot: 1, spread: 0.15, damage: 0.8, reserve: 90 },
  shotgun: { id: 'shotgun', name: 'Shotgun', fireDelay: 0.8, ammoCapacity: 8, reloadTime: 1.8, bulletsPerShot: 6, spread: 0.35, damage: 1, reserve: 16 },
};

export interface GameState {
  status: GameStatus;
  score: number;
  wave: number;
  totalNPCs: number;
  health: number;
  maxHealth: number;
  kills: number;
  banner: string | null;
  damageTick: number;
  muted: boolean;
  runId: number;
  setHealth: (health: number) => void;
  setScore: (score: number) => void;
  setWave: (wave: number) => void;
  setTotalNPCs: (count: number) => void;
  setStatus: (status: GameStatus) => void;
  addKill: () => void;
  setBanner: (b: string | null) => void;
  bumpDamageFlash: () => void;
  toggleMuted: () => void;
  restart: () => void;
  stats: PlayerStats;
  upgradeChoices: UpgradeDef[] | null;
  setUpgradeChoices: (u: UpgradeDef[] | null) => void;
  chooseUpgrade: (id: string) => void;
  dashRequested: boolean;
  setDashRequested: (d: boolean) => void;
  dashReadyAt: number; // epoch ms when the dash comes off cooldown
  setDashReadyAt: (t: number) => void;
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
  reserveAmmo: number;
  setReserveAmmo: (a: number) => void;
  isReloading: boolean;
  setReloading: (r: boolean) => void;
  reloadRequested: boolean;
  setReloadRequested: (r: boolean) => void;
}

export const useGameStore = create<GameState>((set) => ({
  status: 'menu',
  score: 0,
  wave: 1,
  totalNPCs: 15, // Start with fewer enemies on wave 1
  health: 100,
  maxHealth: 100,
  kills: 0,
  banner: null,
  damageTick: 0,
  muted: false,
  runId: 0,
  setHealth: (health) => set({ health }),
  setScore: (score) => set({ score }),
  setWave: (wave) => set({ wave }),
  setTotalNPCs: (count) => set({ totalNPCs: count }),
  setStatus: (status) => set({ status }),
  addKill: () => set((s) => ({ kills: s.kills + 1 })),
  setBanner: (b) => set({ banner: b }),
  bumpDamageFlash: () => set((s) => ({ damageTick: s.damageTick + 1 })),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  stats: DEFAULT_STATS,
  upgradeChoices: null,
  setUpgradeChoices: (u) => set({ upgradeChoices: u }),
  chooseUpgrade: (id) =>
    set((s) => {
      const extra: Partial<GameState> = {};
      if (id === 'maxhp') {
        extra.maxHealth = s.maxHealth + 25;
        extra.health = Math.min(s.maxHealth + 25, s.health + 50);
      }
      return {
        ...extra,
        stats: applyUpgrade(id, s.stats),
        upgradeChoices: null,
        status: 'playing',
      };
    }),
  dashRequested: false,
  setDashRequested: (d) => set({ dashRequested: d }),
  dashReadyAt: 0,
  setDashReadyAt: (t) => set({ dashReadyAt: t }),
  restart: () =>
    set((s) => ({
      runId: s.runId + 1,
      status: 'playing',
      score: 0,
      wave: 1,
      totalNPCs: 15,
      health: 100,
      maxHealth: 100,
      kills: 0,
      banner: null,
      stats: DEFAULT_STATS,
      upgradeChoices: null,
      dashRequested: false,
      dashReadyAt: 0,
      weapon: 'pistol',
      ammo: WEAPONS.pistol.ammoCapacity,
      reserveAmmo: Infinity,
      isReloading: false,
      reloadRequested: false,
      isShooting: false,
      joystickVector: { x: 0, y: 0 },
      shootVector: { x: 0, y: 0 },
      playerPosition: [0, 0, 0],
    })),
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
  reserveAmmo: Infinity,
  setReserveAmmo: (a) => set({ reserveAmmo: a }),
  isReloading: false,
  setReloading: (r) => set({ isReloading: r }),
  reloadRequested: false,
  setReloadRequested: (r) => set({ reloadRequested: r }),
}));
