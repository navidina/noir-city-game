// Roguelite upgrade system: after each cleared wave the player picks 1 of 3 perks.

export interface PlayerStats {
  damageMult: number;
  fireRateMult: number;
  speedMult: number;
  reloadMult: number;
  critChance: number;
  magnetRadius: number;
  lifeSteal: number;
  dashCooldown: number; // seconds
}

export const DEFAULT_STATS: PlayerStats = {
  damageMult: 1,
  fireRateMult: 1,
  speedMult: 1,
  reloadMult: 1,
  critChance: 0.05,
  magnetRadius: 2.5,
  lifeSteal: 0,
  dashCooldown: 2.5,
};

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'damage', name: 'Hollow Points', desc: '+25% bullet damage', icon: '◆' },
  { id: 'firerate', name: 'Hair Trigger', desc: '+20% fire rate', icon: '≫' },
  { id: 'speed', name: 'City Runner', desc: '+12% movement speed', icon: '➤' },
  { id: 'crit', name: 'Dead Eye', desc: '+10% critical hit chance (2x damage)', icon: '◎' },
  { id: 'magnet', name: 'Magnetic Persona', desc: 'Pickups are drawn to you from farther away', icon: '∿' },
  { id: 'lifesteal', name: 'Blood Contract', desc: 'Heal +2 HP on every kill', icon: '♦' },
  { id: 'reload', name: 'Quick Hands', desc: '35% faster reloads', icon: '↻' },
  { id: 'maxhp', name: 'Iron Constitution', desc: '+25 max HP and heal 50 HP now', icon: '▣' },
  { id: 'dash', name: 'Phantom Step', desc: '-25% dash cooldown', icon: '⌁' },
];

export function pickUpgrades(count = 3): UpgradeDef[] {
  const pool = [...UPGRADES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function applyUpgrade(id: string, stats: PlayerStats): PlayerStats {
  const s = { ...stats };
  switch (id) {
    case 'damage':
      s.damageMult *= 1.25;
      break;
    case 'firerate':
      s.fireRateMult *= 1.2;
      break;
    case 'speed':
      s.speedMult *= 1.12;
      break;
    case 'crit':
      s.critChance = Math.min(0.75, s.critChance + 0.1);
      break;
    case 'magnet':
      s.magnetRadius += 2.5;
      break;
    case 'lifesteal':
      s.lifeSteal += 2;
      break;
    case 'reload':
      s.reloadMult *= 1.35;
      break;
    case 'dash':
      s.dashCooldown = Math.max(0.6, s.dashCooldown * 0.75);
      break;
    // 'maxhp' is handled in the store since it touches health, not stats
  }
  return s;
}
