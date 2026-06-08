export type BuildingData = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  id: number;
  lightTheme: string;
  lightHeight: number;
  windowRows: number;
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

export const generateBuildings = (seed = 12345): BuildingData[] => {
  const items: BuildingData[] = [];
  const rng = seededRandom(seed);
  
  for (let i = 0; i < 45; i++) {
    const angle = (i / 45) * Math.PI * 2;
    const radius = 18 + rng() * 25;
    
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Leave space for the main central cross-junction street
    if (Math.abs(x) < 8 || Math.abs(z) < 8) continue;
    
    const width = 3 + rng() * 5;
    const depth = 3 + rng() * 5;
    const height = 8 + rng() * 22;
    
    // Define building variant stylistic decor (e.g. Neon colors or window patterns)
    const lightTheme = rng() > 0.5 ? '#ff5500' : '#00ffff'; 
    const lightHeight = height * (0.3 + rng() * 0.6);
    const windowRows = Math.floor(4 + rng() * 6);
    
    items.push({ x, z, w: width, d: depth, h: height, id: i, lightTheme, lightHeight, windowRows });
  }
  return items;
};

export const BUILDINGS = generateBuildings();

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
