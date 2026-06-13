export type BuildingKind = 'glass' | 'concrete' | 'brick';

export type BuildingData = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  id: number;
  kind: BuildingKind;
  tiered: boolean;
  waterTower: boolean;
  billboard: boolean;
  awningColor: string;
};

export type SkylineData = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  id: number;
};

// Use a simple seeded random to maintain consistent building layouts
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Sparse accent pops against the pale clay city: coral + electric blue + neutral
const AWNING_COLORS = ['#ff5a4d', '#3d9bff', '#aab3c0', '#ff8a5e'];

// Manhattan-style grid: city blocks at fixed cells, separated by streets.
// Main avenues run along x=0 (north-south) and z=0 (east-west).
export const generateBuildings = (seed = 12345): BuildingData[] => {
  const rng = seededRandom(seed);
  const coords = [-39, -26, -13, 13, 26, 39];
  const items: BuildingData[] = [];
  let id = 0;

  for (const cx of coords) {
    for (const cz of coords) {
      const roll = rng();
      let kind: BuildingKind =
        roll < 0.4 ? 'glass' : roll < 0.75 ? 'concrete' : 'brick';
      // Downtown core: cells touching the main crossing favour glass towers
      const core = Math.abs(cx) <= 13 && Math.abs(cz) <= 13;
      if (core && rng() < 0.5) kind = 'glass';

      const h =
        kind === 'glass'
          ? 15 + rng() * 11
          : kind === 'concrete'
            ? 9 + rng() * 7
            : 6 + rng() * 3.5;
      const w = 6.5 + rng() * 3;
      const d = 6.5 + rng() * 3;

      items.push({
        x: cx + (rng() - 0.5) * 1.6,
        z: cz + (rng() - 0.5) * 1.6,
        w,
        d,
        h,
        id: id++,
        kind,
        tiered: kind === 'glass' && rng() < 0.6,
        waterTower: kind !== 'glass' && rng() < 0.35,
        billboard: kind === 'concrete' && rng() < 0.18,
        awningColor: AWNING_COLORS[Math.floor(rng() * AWNING_COLORS.length)],
      });
    }
  }
  return items;
};

// Tall tower silhouettes ringing the playable area: a downtown skyline
// softened by distance fog.
export const generateSkyline = (seed = 777): SkylineData[] => {
  const rng = seededRandom(seed);
  const items: SkylineData[] = [];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + rng() * 0.2;
    const radius = 60 + rng() * 20;
    items.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      w: 9 + rng() * 9,
      d: 9 + rng() * 9,
      h: 32 + rng() * 38,
      id: i,
    });
  }
  return items;
};

export const BUILDINGS = generateBuildings();
export const SKYLINE = generateSkyline();

export const resolveBuildingCollisions = (pos: {x: number, y: number, z: number}, radius: number = 0.5) => {
  for (const b of BUILDINGS) {
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;

    if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
      // Find the closest edge to push out to
      const dists = [
          Math.abs(pos.x - minX),
          Math.abs(pos.x - maxX),
          Math.abs(pos.z - minZ),
          Math.abs(pos.z - maxZ)
      ];

      const minDist = Math.min(...dists);

      if (minDist === dists[0]) pos.x = minX;
      else if (minDist === dists[1]) pos.x = maxX;
      else if (minDist === dists[2]) pos.z = minZ;
      else if (minDist === dists[3]) pos.z = maxZ;
    }
  }
};
