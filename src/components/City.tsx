import { useMemo, useRef } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial } from "three";
import { BUILDINGS, BuildingData } from "../utils/buildings";

function Building({ b, bColor }: { b: BuildingData; bColor: string }) {
  const materialsRef = useRef<MeshStandardMaterial[]>([]);

  useFrame((state) => {
    // Determine if building is between camera and player
    // Camera is roughly at (px, py+12, pz+16)
    const playerZApprox = state.camera.position.z - 16;
    const playerXApprox = state.camera.position.x;

    // Check if building is in front of the player (closer to camera) and block the view radially
    const isOccluding =
      b.z > playerZApprox - b.d / 2 &&
      b.z < state.camera.position.z + 5 &&
      Math.abs(b.x - playerXApprox) < b.w / 2 + 4.5 &&
      b.h > 4;

    const targetOpacity = isOccluding ? 0.3 : 1.0;

    materialsRef.current.forEach((mat) => {
      if (mat) {
        mat.opacity += (targetOpacity - mat.opacity) * 0.1;
        mat.transparent = true;
        mat.depthWrite = !isOccluding;
      }
    });
  });

  return (
    <group>
      {/* Building Frame Block */}
      <mesh receiveShadow castShadow position={[b.x, b.h / 2, b.z]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial
          ref={(m) => {
            if (m && !materialsRef.current.includes(m))
              materialsRef.current.push(m);
          }}
          color={bColor}
          roughness={0.7}
          metalness={0.15}
        />
      </mesh>

      {/* AC Ventilation Roof Details on shorter skyscrapers */}
      {b.h < 15 && (
        <mesh position={[b.x, b.h + 0.15, b.z]}>
          <boxGeometry args={[b.w * 0.6, 0.3, b.d * 0.6]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m && !materialsRef.current.includes(m))
                materialsRef.current.push(m);
            }}
            color="#403c37"
            roughness={0.8}
          />
        </mesh>
      )}

      {/* Decorative vertical pillar slits extending upwards */}
      <mesh
        position={[b.x + b.w * 0.5 - 0.1, b.h * 0.85, b.z - b.d * 0.5 + 0.1]}
      >
        <boxGeometry args={[0.03, b.h * 0.3, 0.08]} />
        <meshStandardMaterial
          ref={(m) => {
            if (m && !materialsRef.current.includes(m))
              materialsRef.current.push(m);
          }}
          color="#706861"
          roughness={0.8}
        />
      </mesh>
    </group>
  );
}

export function City() {
  const buildings = BUILDINGS;

  const ledges = useMemo(
    () =>
      buildings.flatMap((b) =>
        Array.from({ length: b.windowRows }).map((_, r) => {
          const hOffset = 1.0 + (r * (b.h - 1)) / b.windowRows;
          return {
            key: `${b.id}-${r}`,
            pos: [b.x, hOffset, b.z + b.d / 2 + 0.015],
            scale: [b.w * 0.85, 0.03, 0.005],
          };
        }),
      ),
    [buildings],
  );

  const windows1 = useMemo(
    () =>
      buildings
        .filter((b) => b.id % 3 === 0)
        .flatMap((b) =>
          Array.from({ length: b.windowRows }).map((_, r) => {
            const hOffset = 1.0 + (r * (b.h - 1)) / b.windowRows;
            return {
              key: `${b.id}-${r}`,
              pos: [b.x - b.w * 0.25, hOffset + 0.06, b.z + b.d / 2 + 0.02],
              scale: [0.15, 0.11, 0.005],
            };
          }),
        ),
    [buildings],
  );

  const windows2 = useMemo(
    () =>
      buildings
        .filter((b) => b.id % 2 === 0)
        .flatMap((b) =>
          Array.from({ length: b.windowRows }).map((_, r) => {
            const hOffset = 1.0 + (r * (b.h - 1)) / b.windowRows;
            return {
              key: `${b.id}-${r}`,
              pos: [b.x + b.w * 0.2, hOffset + 0.06, b.z + b.d / 2 + 0.02],
              scale: [0.15, 0.11, 0.005],
            };
          }),
        ),
    [buildings],
  );

  return (
    <group>
      {/* 1. Main Asphalt Road Base (Realistic warm daylight asphalt/stone concrete) */}
      <mesh
        receiveShadow
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[110, 110]} />
        <meshStandardMaterial
          color="#8c887f"
          roughness={0.65} // Natural daylight concrete roughness
          metalness={0.1}
        />
      </mesh>

      {/* 2. Structured Sidewalks (Raised concrete walkways dividing the city) */}
      {/* Left/Right walkways bounding the north-south road */}
      <mesh receiveShadow position={[-16, 0.05, 0]}>
        <boxGeometry args={[20, 0.1, 110]} />
        <meshStandardMaterial color="#aba59a" roughness={0.7} />
      </mesh>
      <mesh receiveShadow position={[16, 0.05, 0]}>
        <boxGeometry args={[20, 0.1, 110]} />
        <meshStandardMaterial color="#aba59a" roughness={0.7} />
      </mesh>

      {/* East-West road sidewalks */}
      <mesh receiveShadow position={[0, 0.051, -20]}>
        <boxGeometry args={[110, 0.09, 12]} />
        <meshStandardMaterial color="#b3ada2" roughness={0.7} />
      </mesh>
      <mesh receiveShadow position={[0, 0.051, 20]}>
        <boxGeometry args={[110, 0.09, 12]} />
        <meshStandardMaterial color="#b3ada2" roughness={0.7} />
      </mesh>

      {/* Raised Sidewalk Curb lines (Highlighting edges structure) */}
      <mesh position={[-6.05, 0.11, 0]}>
        <boxGeometry args={[0.1, 0.04, 110]} />
        <meshStandardMaterial color="#6e685f" roughness={0.5} />
      </mesh>
      <mesh position={[6.05, 0.11, 0]}>
        <boxGeometry args={[0.1, 0.04, 110]} />
        <meshStandardMaterial color="#6e685f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.11, -14.05]}>
        <boxGeometry args={[110, 0.04, 0.1]} />
        <meshStandardMaterial color="#6e685f" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.11, 14.05]}>
        <boxGeometry args={[110, 0.04, 0.1]} />
        <meshStandardMaterial color="#6e685f" roughness={0.5} />
      </mesh>

      {/* 3. Road Markings (Double yellow line divider matching classic city streets) */}
      {Array.from({ length: 15 }).map((_, i) => {
        const z = -45 + i * 7;
        if (Math.abs(z) < 14) return null; // Avoid overlapping intersection crosswalk area
        return (
          <group key={`lane-${i}`}>
            {/* Left yellow bar */}
            <mesh position={[-0.1, 0.012, z]}>
              <boxGeometry args={[0.07, 0.002, 3.8]} />
              <meshStandardMaterial color="#cca43b" roughness={0.65} />
            </mesh>
            {/* Right yellow bar */}
            <mesh position={[0.1, 0.012, z]}>
              <boxGeometry args={[0.07, 0.002, 3.8]} />
              <meshStandardMaterial color="#cca43b" roughness={0.65} />
            </mesh>
          </group>
        );
      })}

      {/* Main Intersection Crosswalk / Zebra Crossing (Off-white warm layout) */}
      {/* North crosswalk elements */}
      <group position={[0, 0.01, -11]}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={`zebra-n-${i}`} position={[-4 + i * 1.0, 0, 0]}>
            <boxGeometry args={[0.5, 0.002, 3.2]} />
            <meshStandardMaterial color="#dfdad0" roughness={0.8} />
          </mesh>
        ))}
      </group>
      {/* South crosswalk elements */}
      <group position={[0, 0.01, 11]}>
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={`zebra-s-${i}`} position={[-4 + i * 1.0, 0, 0]}>
            <boxGeometry args={[0.5, 0.002, 3.2]} />
            <meshStandardMaterial color="#dfdad0" roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* Painted Off-White Street Direction Arrow */}
      <group position={[1.5, 0.01, 24]} rotation={[0, Math.PI, 0]}>
        {/* Shaft of the arrow */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.22, 0.002, 3.2]} />
          <meshStandardMaterial color="#dfdad0" roughness={0.8} />
        </mesh>
        {/* Slanted diagonal pointer bars */}
        <mesh position={[-0.45, 0, -1.2]} rotation={[0, 0.6, 0]}>
          <boxGeometry args={[0.22, 0.002, 1.2]} />
          <meshStandardMaterial color="#dfdad0" roughness={0.8} />
        </mesh>
        <mesh position={[0.45, 0, -1.2]} rotation={[0, -0.6, 0]}>
          <boxGeometry args={[0.22, 0.002, 1.2]} />
          <meshStandardMaterial color="#dfdad0" roughness={0.8} />
        </mesh>
      </group>

      {/* 4. Elegant Sidewalk Props (Matches Image 2 features) */}
      {/* Heavy iron dark drain manholes */}
      <mesh position={[-3.2, 0.015, -4.5]} rotation={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.01, 12]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.85}
          metalness={0.7}
        />
      </mesh>
      <mesh position={[3.5, 0.015, 18]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.01, 12]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.85}
          metalness={0.7}
        />
      </mesh>

      {/* Metal Bollards bounding corners */}
      {[-5.6, 5.6].map((x) =>
        [-13.5, 13.5].map((z) => (
          <group key={`bollard-${x}-${z}`} position={[x, 0.1, z]}>
            {/* Bollard pole */}
            <mesh>
              <cylinderGeometry args={[0.08, 0.09, 0.72, 8]} />
              <meshStandardMaterial
                color="#1e1e1e"
                roughness={0.4}
                metalness={0.65}
              />
            </mesh>
            {/* Cap */}
            <mesh position={[0, 0.36, 0]}>
              <sphereGeometry args={[0.09, 8, 8]} />
              <meshStandardMaterial
                color="#333333"
                roughness={0.3}
                metalness={0.8}
              />
            </mesh>
          </group>
        )),
      )}

      {/* Trash columns / garbage bins on sidewalks */}
      <group position={[-6.8, 0.1, 4]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.55, 0.8, 0.55]} />
          <meshStandardMaterial
            color="#2d2d2d"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.81, 0]}>
          <boxGeometry args={[0.58, 0.03, 0.58]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
      </group>
      <group position={[6.8, 0.1, -16]}>
        <mesh position={[0, 0.4, 0]}>
          <boxGeometry args={[0.55, 0.8, 0.55]} />
          <meshStandardMaterial
            color="#2d2d2d"
            roughness={0.5}
            metalness={0.3}
          />
        </mesh>
        <mesh position={[0, 0.81, 0]}>
          <boxGeometry args={[0.58, 0.03, 0.58]} />
          <meshStandardMaterial color="#111111" roughness={0.3} />
        </mesh>
      </group>

      {/* 5. High-fidelity Cinematic Streetlamps (Glow and Spotlights off during the Day) */}
      {/* Placing 4 strategic lamp posts bounding the streets */}
      {[
        { x: -5.8, y: 7.0, z: -18.0, rY: 0 },
        { x: 5.8, y: 7.0, z: 18.0, rY: Math.PI },
        { x: -14.0, y: 7.0, z: 5.8, rY: -Math.PI / 2 },
        { x: 14.0, y: 7.0, z: -5.8, rY: Math.PI / 2 },
      ].map((lamp, i) => (
        <group
          key={`streetlamp-${i}`}
          position={[lamp.x, 0.1, lamp.z]}
          rotation={[0, lamp.rY, 0]}
        >
          {/* Main vertical slim post */}
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[0.07, 0.1, 6.4, 8]} />
            <meshStandardMaterial
              color="#333333"
              roughness={0.6}
              metalness={0.5}
            />
          </mesh>
          {/* Top curved neck horizontal bar */}
          <mesh position={[0.45, 6.4, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 1.0, 8]} />
            <meshStandardMaterial
              color="#333333"
              roughness={0.6}
              metalness={0.5}
            />
          </mesh>
          {/* Flat lamp head fixture */}
          <mesh position={[0.9, 6.25, 0]}>
            <boxGeometry args={[0.4, 0.15, 0.24]} />
            <meshStandardMaterial color="#2d2d2d" roughness={0.6} />
          </mesh>
          {/* Unlit streetlamp glass bulb */}
          <mesh position={[0.9, 6.17, 0]}>
            <boxGeometry args={[0.25, 0.02, 0.18]} />
            <meshStandardMaterial color="#bfbaad" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* 6. Upgraded Skyscrapers / Sandstone Facades with Window Highlights */}
      {buildings.map((b) => {
        // Diverse natural daytime skyscraper facade tones
        const buildingColors = [
          "#948a7c", // Natural warm concrete brick
          "#796f62", // Earthy brown plaster
          "#a3978a", // Light desert masonry stone
          "#877d70", // Warm clay ochre
          "#ab9f90", // Premium light limestone
          "#6b6155", // Dark industrial base
        ];
        const bColor = buildingColors[b.id % buildingColors.length];

        return <Building key={b.id} b={b} bColor={bColor} />;
      })}

      {/* OPTIMIZED GEOMETRY: Render all repetitive facade ledges using 1 draw call */}
      <Instances limit={1000}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#302b26" roughness={0.6} />
        {ledges.map((item) => (
          <Instance
            key={item.key}
            position={item.pos as any}
            scale={item.scale as any}
          />
        ))}
      </Instances>

      {/* OPTIMIZED GEOMETRY: Render window type 1 using 1 draw call */}
      <Instances limit={500}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ebdfcf" roughness={0.3} />
        {windows1.map((item) => (
          <Instance
            key={item.key}
            position={item.pos as any}
            scale={item.scale as any}
          />
        ))}
      </Instances>

      {/* OPTIMIZED GEOMETRY: Render window type 2 using 1 draw call */}
      <Instances limit={500}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#f0ede6" roughness={0.3} />
        {windows2.map((item) => (
          <Instance
            key={item.key}
            position={item.pos as any}
            scale={item.scale as any}
          />
        ))}
      </Instances>

      {/* 7. Ambient Global Noon Glow and Crisp Solar Shadows */}
      <ambientLight intensity={0.52} color="#ebe7dd" />
      <hemisphereLight args={["#ffffff", "#80796d", 0.42]} />
      <directionalLight
        position={[18, 55, 12]}
        intensity={2.1}
        color="#fff9f0" // Glistening golden warm sunlight
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={120}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0008}
      />
    </group>
  );
}
