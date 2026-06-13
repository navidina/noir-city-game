import { useMemo, useRef } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MeshStandardMaterial } from "three";
import { BUILDINGS, SKYLINE, BuildingData } from "../utils/buildings";

// ---------------------------------------------------------------------------
// Shared materials (module-level: one allocation for the whole city)
// "Clay blueprint" palette: matte cool off-white forms, two accent hues only
// (coral + electric blue), near-zero metalness so everything reads as a soft
// architectural model fading into a pale blue haze.
// ---------------------------------------------------------------------------
const asphaltMat = new MeshStandardMaterial({ color: "#c4ccd6", roughness: 0.95, metalness: 0 });
const asphaltSideMat = new MeshStandardMaterial({ color: "#ccd3dc", roughness: 0.95, metalness: 0 });
const sidewalkMat = new MeshStandardMaterial({ color: "#e7ebf0", roughness: 0.95, metalness: 0 });
const curbMat = new MeshStandardMaterial({ color: "#d2d8e0", roughness: 0.9, metalness: 0 });
const paintWhiteMat = new MeshStandardMaterial({ color: "#f4f6f9", roughness: 0.85, metalness: 0 });
const paintYellowMat = new MeshStandardMaterial({ color: "#e7c98f", roughness: 0.85, metalness: 0 });
const metalDarkMat = new MeshStandardMaterial({ color: "#3a4150", roughness: 0.7, metalness: 0.2 });
const metalMidMat = new MeshStandardMaterial({ color: "#9aa3b0", roughness: 0.7, metalness: 0.2 });
const ironMat = new MeshStandardMaterial({ color: "#aeb6c1", roughness: 0.85, metalness: 0.1 });
const trunkMat = new MeshStandardMaterial({ color: "#b9bcc5", roughness: 0.95, metalness: 0 });
const leafMat = new MeshStandardMaterial({ color: "#cfd6de", roughness: 0.95, metalness: 0 });
const leafDarkMat = new MeshStandardMaterial({ color: "#c2cad4", roughness: 0.95, metalness: 0 });
const planterMat = new MeshStandardMaterial({ color: "#d8dde4", roughness: 0.95, metalness: 0 });
const hydrantMat = new MeshStandardMaterial({ color: "#ff5a4d", roughness: 0.65, metalness: 0 });
const benchWoodMat = new MeshStandardMaterial({ color: "#c7ccd4", roughness: 0.95, metalness: 0 });
const carGlassMat = new MeshStandardMaterial({ color: "#aebccb", roughness: 0.25, metalness: 0.3 });
const tireMat = new MeshStandardMaterial({ color: "#454d5b", roughness: 0.9, metalness: 0 });
const taxiYellowMat = new MeshStandardMaterial({ color: "#e9d49a", roughness: 0.7, metalness: 0 });
const acUnitMat = new MeshStandardMaterial({ color: "#d4d9e1", roughness: 0.9, metalness: 0 });
const waterTowerMat = new MeshStandardMaterial({ color: "#cfd5de", roughness: 0.95, metalness: 0 });
const billboardPanelMat = new MeshStandardMaterial({ color: "#aab3c0", roughness: 0.6, metalness: 0.1 });
const billboardArtMat = new MeshStandardMaterial({ color: "#eef2f7", roughness: 0.7, metalness: 0 });
const billboardRedMat = new MeshStandardMaterial({ color: "#ff5a4d", roughness: 0.6, metalness: 0, emissive: "#ff5a4d", emissiveIntensity: 0.12 });
const lightRedMat = new MeshStandardMaterial({ color: "#ff5a4d", emissive: "#ff5a4d", emissiveIntensity: 0.9 });
const lightAmberMat = new MeshStandardMaterial({ color: "#cfd6de", emissive: "#ffffff", emissiveIntensity: 0.0 });
const lightGreenMat = new MeshStandardMaterial({ color: "#3d9bff", emissive: "#3d9bff", emissiveIntensity: 0.7 });
const skylineMat = new MeshStandardMaterial({ color: "#dde4ec", roughness: 0.95, metalness: 0 });
const skylineGlassMat = new MeshStandardMaterial({ color: "#d6dfea", roughness: 0.6, metalness: 0.15 });

const FACADE_COLORS: Record<string, string[]> = {
  glass: ["#e3e9f1", "#dae2ec", "#e8edf4"],
  concrete: ["#e6eaf0", "#dde2ea", "#eef1f6"],
  brick: ["#dfe1e8", "#d8dce4", "#e4e7ed", "#dbdfe7"],
};

// ---------------------------------------------------------------------------
// One building: facade box, per-building instanced window grid (fades together
// with the box when it blocks the camera), and rooftop/street-level details.
// ---------------------------------------------------------------------------
function Building({ b }: { b: BuildingData }) {
  const materialsRef = useRef<MeshStandardMaterial[]>([]);
  const reg = (m: MeshStandardMaterial | null) => {
    if (m && !materialsRef.current.includes(m)) materialsRef.current.push(m);
  };

  useFrame((state) => {
    // Fade the building when it stands between the camera and the player.
    // Camera looks at the player from +x/+z, roughly (px+15, py+20, pz+15).
    const playerXApprox = state.camera.position.x - 15;
    const playerZApprox = state.camera.position.z - 15;

    const isOccluding =
      b.h > 6 &&
      b.x > playerXApprox - b.w / 2 &&
      b.x < state.camera.position.x + 5 &&
      b.z > playerZApprox - b.d / 2 &&
      b.z < state.camera.position.z + 5 &&
      (Math.abs(b.x - playerXApprox) < b.w / 2 + 4.5 ||
        Math.abs(b.z - playerZApprox) < b.d / 2 + 4.5);

    const targetOpacity = isOccluding ? 0.22 : 1.0;

    materialsRef.current.forEach((mat) => {
      if (mat) {
        mat.opacity += (targetOpacity - mat.opacity) * 0.12;
        mat.transparent = true;
        mat.depthWrite = mat.opacity > 0.6;
      }
    });
  });

  const facade = FACADE_COLORS[b.kind][b.id % FACADE_COLORS[b.kind].length];
  const lowerH = b.tiered ? b.h * 0.62 : b.h;
  const upperH = b.h - lowerH;
  const upperW = b.w * 0.68;
  const upperD = b.d * 0.68;

  // Window grid on the two camera-facing facades (+x and +z)
  const windows = useMemo(() => {
    const out: {
      pos: [number, number, number];
      scale: [number, number, number];
      color: string;
    }[] = [];
    const isGlass = b.kind === "glass";
    const rowStep = isGlass ? 1.25 : 1.5;
    const groundClear = b.kind === "brick" ? 3.0 : 3.2; // leave room for storefronts
    const rows = Math.min(
      16,
      Math.max(0, Math.floor((lowerH - groundClear - 0.8) / rowStep)),
    );
    const winColors = isGlass
      ? ["#b8c4d3", "#c4cfdc", "#aebccd"]
      : ["#c2c9d4", "#cdd3dd", "#b7bfcc"];
    const litColor = "#86c4ff"; // sparse electric-blue lit windows

    const facesSpec = [
      { axis: "z" as const, span: b.w },
      { axis: "x" as const, span: b.d },
    ];

    for (const face of facesSpec) {
      const cols = Math.min(7, Math.floor(face.span / 1.1));
      const usable = face.span * 0.78;
      const step = usable / cols;
      for (let r = 0; r < rows; r++) {
        const y = groundClear + r * rowStep;
        for (let c = 0; c < cols; c++) {
          const off = -usable / 2 + step * (c + 0.5);
          // Deterministic sparse "lit" windows for life
          const lit = (b.id * 7 + r * 13 + c * 5) % 23 === 0;
          const color = lit
            ? litColor
            : winColors[(b.id + r + c) % winColors.length];
          if (face.axis === "z") {
            out.push({
              pos: [b.x + off, y, b.z + b.d / 2 + 0.025],
              scale: [step * 0.6, isGlass ? 0.95 : 0.7, 0.05],
              color,
            });
          } else {
            out.push({
              pos: [b.x + b.w / 2 + 0.025, y, b.z + off],
              scale: [0.05, isGlass ? 0.95 : 0.7, step * 0.6],
              color,
            });
          }
        }
      }
    }
    return out;
  }, [b, lowerH]);

  return (
    <group>
      {/* Main facade block */}
      <mesh receiveShadow castShadow position={[b.x, lowerH / 2, b.z]}>
        <boxGeometry args={[b.w, lowerH, b.d]} />
        <meshStandardMaterial
          ref={reg}
          color={facade}
          roughness={b.kind === "glass" ? 0.4 : 0.75}
          metalness={b.kind === "glass" ? 0.35 : 0.1}
        />
      </mesh>

      {/* Setback upper tier on modern towers */}
      {b.tiered && (
        <>
          <mesh
            receiveShadow
            castShadow
            position={[b.x, lowerH + upperH / 2, b.z]}
          >
            <boxGeometry args={[upperW, upperH, upperD]} />
            <meshStandardMaterial
              ref={reg}
              color={facade}
              roughness={0.4}
              metalness={0.35}
            />
          </mesh>
          {/* Vertical mullion strips on the upper tier */}
          {[-0.25, 0, 0.25].map((f) => (
            <mesh
              key={`mz-${f}`}
              position={[b.x + upperW * f, lowerH + upperH / 2, b.z + upperD / 2 + 0.02]}
            >
              <boxGeometry args={[0.08, upperH * 0.9, 0.04]} />
              <meshStandardMaterial ref={reg} color="#aab4c2" roughness={0.5} metalness={0.15} />
            </mesh>
          ))}
        </>
      )}

      {/* Roof parapet */}
      <mesh
        position={[
          b.x,
          (b.tiered ? b.h : lowerH) + 0.1,
          b.z,
        ]}
      >
        <boxGeometry
          args={[
            (b.tiered ? upperW : b.w) + 0.15,
            0.22,
            (b.tiered ? upperD : b.d) + 0.15,
          ]}
        />
        <meshStandardMaterial ref={reg} color="#cdd4dd" roughness={0.9} />
      </mesh>

      {/* Rooftop AC units on low/mid buildings */}
      {b.h < 16 && (
        <>
          <mesh position={[b.x - b.w * 0.18, lowerH + 0.45, b.z + b.d * 0.12]} material={acUnitMat}>
            <boxGeometry args={[1.3, 0.7, 1.0]} />
          </mesh>
          <mesh position={[b.x + b.w * 0.22, lowerH + 0.35, b.z - b.d * 0.18]} material={acUnitMat}>
            <boxGeometry args={[0.9, 0.5, 0.8]} />
          </mesh>
        </>
      )}

      {/* Classic American rooftop water tower */}
      {b.waterTower && (
        <group position={[b.x + b.w * 0.2, lowerH, b.z - b.d * 0.18]}>
          {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx * 0.8, 0.45, lz * 0.8]} material={metalMidMat}>
              <cylinderGeometry args={[0.05, 0.05, 0.9, 6]} />
            </mesh>
          ))}
          <mesh position={[0, 1.55, 0]} material={waterTowerMat} castShadow>
            <cylinderGeometry args={[0.85, 0.95, 1.4, 10]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} material={waterTowerMat}>
            <coneGeometry args={[0.95, 0.6, 10]} />
          </mesh>
        </group>
      )}

      {/* Antenna spire on tall towers */}
      {b.kind === "glass" && b.h > 18 && (
        <group position={[b.x, b.h + 0.2, b.z]}>
          <mesh position={[0, 1.2, 0]} material={metalDarkMat}>
            <cylinderGeometry args={[0.04, 0.07, 2.4, 6]} />
          </mesh>
          <mesh position={[0, 2.5, 0]} material={lightRedMat}>
            <sphereGeometry args={[0.09, 8, 8]} />
          </mesh>
        </group>
      )}

      {/* Rooftop billboard angled toward downtown */}
      {b.billboard && (
        <group
          position={[b.x, lowerH + 1.6, b.z]}
          rotation={[0, Math.atan2(-b.x, -b.z), 0]}
        >
          <mesh position={[-1.4, -0.8, -0.2]} material={metalMidMat}>
            <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
          </mesh>
          <mesh position={[1.4, -0.8, -0.2]} material={metalMidMat}>
            <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
          </mesh>
          <mesh material={billboardPanelMat} castShadow>
            <boxGeometry args={[4.4, 2.4, 0.12]} />
          </mesh>
          <mesh position={[0, 0.1, 0.07]} material={billboardArtMat}>
            <boxGeometry args={[3.9, 1.5, 0.02]} />
          </mesh>
          <mesh position={[0, -0.85, 0.07]} material={billboardRedMat}>
            <boxGeometry args={[3.9, 0.45, 0.02]} />
          </mesh>
        </group>
      )}

      {/* Street-level storefront with awning on brick/concrete blocks */}
      {b.kind !== "glass" && (
        <group position={[b.x, 0, b.z + b.d / 2]}>
          {/* Glass shopfront */}
          <mesh position={[0, 1.0, 0.03]}>
            <boxGeometry args={[b.w * 0.72, 1.7, 0.1]} />
            <meshStandardMaterial ref={reg} color="#aebccb" roughness={0.25} metalness={0.3} />
          </mesh>
          {/* Door frame */}
          <mesh position={[b.w * 0.22, 0.95, 0.09]}>
            <boxGeometry args={[0.75, 1.6, 0.04]} />
            <meshStandardMaterial ref={reg} color="#8893a3" roughness={0.5} />
          </mesh>
          {/* Awning */}
          <mesh position={[0, 2.25, 0.5]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[b.w * 0.78, 0.06, 1.05]} />
            <meshStandardMaterial ref={reg} color={b.awningColor} roughness={0.85} />
          </mesh>
          {/* Shop sign band */}
          <mesh position={[0, 2.75, 0.06]}>
            <boxGeometry args={[b.w * 0.6, 0.45, 0.08]} />
            <meshStandardMaterial ref={reg} color={b.awningColor} roughness={0.6} />
          </mesh>
        </group>
      )}

      {/* Window grid: one draw call per building, fades with the facade */}
      {windows.length > 0 && (
        <Instances limit={windows.length}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial ref={reg} roughness={0.2} metalness={0.55} />
          {windows.map((w, i) => (
            <Instance key={i} position={w.pos} scale={w.scale} color={w.color} />
          ))}
        </Instances>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Street furniture
// ---------------------------------------------------------------------------
function ParkedCar({
  pos,
  ry,
  color,
  taxi = false,
}: {
  pos: [number, number, number];
  ry: number;
  color?: string;
  taxi?: boolean;
}) {
  const bodyMat = useMemo(
    () =>
      taxi
        ? taxiYellowMat
        : new MeshStandardMaterial({ color: color || "#23252b", roughness: 0.35, metalness: 0.5 }),
    [color, taxi],
  );
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      {/* Body */}
      <mesh position={[0, 0.42, 0]} material={bodyMat} castShadow>
        <boxGeometry args={[1.7, 0.5, 4.0]} />
      </mesh>
      {/* Cabin glasshouse */}
      <mesh position={[0, 0.82, -0.25]} material={carGlassMat} castShadow>
        <boxGeometry args={[1.5, 0.42, 2.0]} />
      </mesh>
      {/* Wheels */}
      {[[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]].map(([wx, wz], i) => (
        <mesh key={i} position={[wx, 0.3, wz]} rotation={[0, 0, Math.PI / 2]} material={tireMat}>
          <cylinderGeometry args={[0.3, 0.3, 0.2, 10]} />
        </mesh>
      ))}
      {/* Lights */}
      <mesh position={[0, 0.45, 2.01]} material={paintWhiteMat}>
        <boxGeometry args={[1.3, 0.12, 0.04]} />
      </mesh>
      <mesh position={[0, 0.45, -2.01]} material={lightRedMat}>
        <boxGeometry args={[1.3, 0.1, 0.04]} />
      </mesh>
      {/* Taxi roof sign */}
      {taxi && (
        <mesh position={[0, 1.1, -0.25]} material={paintWhiteMat}>
          <boxGeometry args={[0.55, 0.14, 0.22]} />
        </mesh>
      )}
    </group>
  );
}

function StreetTree({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.12, 0]} material={planterMat} receiveShadow>
        <boxGeometry args={[1.0, 0.26, 1.0]} />
      </mesh>
      <mesh position={[0, 0.8, 0]} material={trunkMat} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 1.3, 6]} />
      </mesh>
      <mesh position={[0, 1.8, 0]} material={leafMat} castShadow>
        <sphereGeometry args={[0.8, 8, 7]} />
      </mesh>
      <mesh position={[0.3, 2.15, 0.15]} material={leafDarkMat}>
        <sphereGeometry args={[0.55, 8, 7]} />
      </mesh>
    </group>
  );
}

function TrafficLight({ pos, ry }: { pos: [number, number, number]; ry: number }) {
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      <mesh position={[0, 2.6, 0]} material={metalDarkMat}>
        <cylinderGeometry args={[0.07, 0.1, 5.2, 8]} />
      </mesh>
      {/* Arm reaching over the road */}
      <mesh position={[1.2, 5.0, 0]} rotation={[0, 0, Math.PI / 2]} material={metalDarkMat}>
        <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
      </mesh>
      {/* Signal head */}
      <group position={[2.3, 4.7, 0]}>
        <mesh material={metalDarkMat}>
          <boxGeometry args={[0.3, 0.85, 0.3]} />
        </mesh>
        <mesh position={[0, 0.26, 0.16]} material={lightRedMat}>
          <sphereGeometry args={[0.08, 8, 8]} />
        </mesh>
        <mesh position={[0, 0, 0.16]} material={lightAmberMat}>
          <sphereGeometry args={[0.08, 8, 8]} />
        </mesh>
        <mesh position={[0, -0.26, 0.16]} material={lightGreenMat}>
          <sphereGeometry args={[0.08, 8, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function FireHydrant({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.3, 0]} material={hydrantMat} castShadow>
        <cylinderGeometry args={[0.13, 0.16, 0.6, 8]} />
      </mesh>
      <mesh position={[0, 0.62, 0]} material={hydrantMat}>
        <sphereGeometry args={[0.13, 8, 8]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} rotation={[0, 0, Math.PI / 2]} material={hydrantMat}>
        <cylinderGeometry args={[0.06, 0.06, 0.42, 6]} />
      </mesh>
    </group>
  );
}

function Bench({ pos, ry }: { pos: [number, number, number]; ry: number }) {
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      <mesh position={[0, 0.5, 0]} material={benchWoodMat} castShadow>
        <boxGeometry args={[1.7, 0.07, 0.5]} />
      </mesh>
      <mesh position={[0, 0.85, -0.24]} rotation={[-0.2, 0, 0]} material={benchWoodMat}>
        <boxGeometry args={[1.7, 0.5, 0.06]} />
      </mesh>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.25, 0]} material={metalDarkMat}>
          <boxGeometry args={[0.07, 0.5, 0.45]} />
        </mesh>
      ))}
    </group>
  );
}

function StreetLamp({ pos, ry }: { pos: [number, number, number]; ry: number }) {
  return (
    <group position={pos} rotation={[0, ry, 0]}>
      <mesh position={[0, 3.2, 0]} material={metalMidMat}>
        <cylinderGeometry args={[0.07, 0.1, 6.4, 8]} />
      </mesh>
      <mesh position={[0.45, 6.4, 0]} rotation={[0, 0, Math.PI / 2]} material={metalMidMat}>
        <cylinderGeometry args={[0.06, 0.06, 1.0, 8]} />
      </mesh>
      <mesh position={[0.9, 6.25, 0]} material={metalDarkMat}>
        <boxGeometry args={[0.4, 0.15, 0.24]} />
      </mesh>
      <mesh position={[0.9, 6.17, 0]} material={paintWhiteMat}>
        <boxGeometry args={[0.25, 0.02, 0.18]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// City scene
// ---------------------------------------------------------------------------
export function City() {
  // Painted road markings collected into two instanced draw calls
  const whitePaint = useMemo(() => {
    const out: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    // Crosswalks over the N-S avenue (north + south of the intersection)
    for (const z of [-11, 11]) {
      for (let i = 0; i < 9; i++) {
        out.push({ pos: [-4 + i * 1.0, 0.025, z], scale: [0.5, 0.004, 3.2] });
      }
    }
    // Crosswalks over the E-W avenue (east + west of the intersection)
    for (const x of [-9.5, 9.5]) {
      for (let i = 0; i < 15; i++) {
        out.push({ pos: [x, 0.025, -11.9 + i * 1.7], scale: [3.2, 0.004, 0.6] });
      }
    }
    // Dashed lane separators on the wide E-W avenue
    for (const z of [-7, 7]) {
      for (let i = 0; i < 18; i++) {
        const x = -55 + i * 6.3;
        if (Math.abs(x) < 9) continue;
        out.push({ pos: [x, 0.025, z], scale: [2.2, 0.004, 0.14] });
      }
    }
    return out;
  }, []);

  const yellowPaint = useMemo(() => {
    const out: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    // Double yellow centerline, N-S avenue
    for (let i = 0; i < 16; i++) {
      const z = -52 + i * 7;
      if (Math.abs(z) < 15) continue;
      out.push({ pos: [-0.12, 0.025, z], scale: [0.08, 0.004, 4.2] });
      out.push({ pos: [0.12, 0.025, z], scale: [0.08, 0.004, 4.2] });
    }
    // Double yellow centerline, E-W avenue
    for (let i = 0; i < 16; i++) {
      const x = -52 + i * 7;
      if (Math.abs(x) < 11) continue;
      out.push({ pos: [x, 0.025, -0.12], scale: [4.2, 0.004, 0.08] });
      out.push({ pos: [x, 0.025, 0.12], scale: [4.2, 0.004, 0.08] });
    }
    return out;
  }, []);

  return (
    <group>
      {/* 1. Ground base: concrete sidewalk plain covering every block */}
      <mesh receiveShadow position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={sidewalkMat}>
        <planeGeometry args={[150, 150]} />
      </mesh>

      {/* 2. Asphalt: two main avenues + the secondary street grid */}
      {/* N-S main avenue */}
      <mesh receiveShadow position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]} material={asphaltMat}>
        <planeGeometry args={[12.4, 150]} />
      </mesh>
      {/* E-W main avenue (wide boulevard) */}
      <mesh receiveShadow position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={asphaltMat}>
        <planeGeometry args={[150, 28.4]} />
      </mesh>
      {/* Secondary side streets between the blocks */}
      {[-32.5, -19.5, 19.5, 32.5].map((x) => (
        <mesh key={`sns-${x}`} receiveShadow position={[x, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} material={asphaltSideMat}>
          <planeGeometry args={[3.6, 150]} />
        </mesh>
      ))}
      {[-32.5, -19.5, 19.5, 32.5].map((z) => (
        <mesh key={`sew-${z}`} receiveShadow position={[0, 0.002, z]} rotation={[-Math.PI / 2, 0, 0]} material={asphaltSideMat}>
          <planeGeometry args={[150, 3.6]} />
        </mesh>
      ))}

      {/* 3. Curbs along the main avenues */}
      {[-6.4, 6.4].map((x) => (
        <mesh key={`curb-ns-${x}`} position={[x, 0.03, 0]} material={curbMat}>
          <boxGeometry args={[0.16, 0.07, 150]} />
        </mesh>
      ))}
      {[-14.4, 14.4].map((z) => (
        <mesh key={`curb-ew-${z}`} position={[0, 0.03, z]} material={curbMat}>
          <boxGeometry args={[150, 0.07, 0.16]} />
        </mesh>
      ))}

      {/* 4. Road paint: 2 instanced draw calls for all markings */}
      <Instances limit={whitePaint.length}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d9d4c9" roughness={0.8} />
        {whitePaint.map((m, i) => (
          <Instance key={i} position={m.pos} scale={m.scale} />
        ))}
      </Instances>
      <Instances limit={yellowPaint.length}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#c9a23a" roughness={0.7} />
        {yellowPaint.map((m, i) => (
          <Instance key={i} position={m.pos} scale={m.scale} />
        ))}
      </Instances>

      {/* 5. Manholes */}
      <mesh position={[-3.2, 0.018, -4.5]} rotation={[0, 0.4, 0]} material={ironMat}>
        <cylinderGeometry args={[0.6, 0.6, 0.012, 12]} />
      </mesh>
      <mesh position={[3.5, 0.018, 18]} material={ironMat}>
        <cylinderGeometry args={[0.6, 0.6, 0.012, 12]} />
      </mesh>

      {/* 6. Parked traffic: sedans + yellow cabs along the avenue curbs */}
      <ParkedCar pos={[-4.9, 0, -28]} ry={0} color="#23252b" />
      <ParkedCar pos={[-4.9, 0, -23]} ry={0} color="#8a8d93" />
      <ParkedCar pos={[-4.9, 0, 16]} ry={0} taxi />
      <ParkedCar pos={[4.9, 0, -16]} ry={Math.PI} color="#6e2230" />
      <ParkedCar pos={[4.9, 0, 24]} ry={Math.PI} color="#d8d4c8" />
      <ParkedCar pos={[4.9, 0, 37]} ry={Math.PI} color="#2c3340" />
      <ParkedCar pos={[-37, 0, -12.9]} ry={Math.PI / 2} color="#1d1f24" />
      <ParkedCar pos={[-24, 0, -12.9]} ry={Math.PI / 2} color="#9aa0a6" />
      <ParkedCar pos={[24, 0, -12.9]} ry={Math.PI / 2} taxi />
      <ParkedCar pos={[-28, 0, 12.9]} ry={-Math.PI / 2} color="#37413b" />
      <ParkedCar pos={[28, 0, 12.9]} ry={-Math.PI / 2} color="#23252b" />

      {/* 7. Street trees in sidewalk planters */}
      <StreetTree pos={[-7.6, 0, -38]} />
      <StreetTree pos={[7.6, 0, -28]} />
      <StreetTree pos={[-7.6, 0, -17]} />
      <StreetTree pos={[7.6, 0, 17]} />
      <StreetTree pos={[-7.6, 0, 28]} />
      <StreetTree pos={[7.6, 0, 38]} />
      <StreetTree pos={[-38, 0, -15.8]} />
      <StreetTree pos={[-27, 0, 15.8]} />
      <StreetTree pos={[-16, 0, -15.8]} />
      <StreetTree pos={[16, 0, 15.8]} />
      <StreetTree pos={[27, 0, -15.8]} />
      <StreetTree pos={[38, 0, 15.8]} />

      {/* 8. Intersection hardware: traffic lights on all four corners */}
      <TrafficLight pos={[-7.0, 0, -15.0]} ry={0} />
      <TrafficLight pos={[7.0, 0, 15.0]} ry={Math.PI} />
      <TrafficLight pos={[-7.0, 0, 15.0]} ry={Math.PI / 2} />
      <TrafficLight pos={[7.0, 0, -15.0]} ry={-Math.PI / 2} />

      {/* 9. Sidewalk props: hydrants, benches, bins, bollards, newspaper boxes */}
      <FireHydrant pos={[6.9, 0, -17.5]} />
      <FireHydrant pos={[-6.9, 0, 17.5]} />
      <FireHydrant pos={[16.2, 0, 14.9]} />
      <Bench pos={[-10, 0, 15.6]} ry={Math.PI} />
      <Bench pos={[14, 0, -15.6]} ry={0} />
      <Bench pos={[7.3, 0, -26]} ry={-Math.PI / 2} />
      {[-5.6, 5.6].map((x) =>
        [-13.5, 13.5].map((z) => (
          <group key={`bollard-${x}-${z}`} position={[x, 0.1, z]}>
            <mesh material={metalDarkMat}>
              <cylinderGeometry args={[0.08, 0.09, 0.72, 8]} />
            </mesh>
            <mesh position={[0, 0.36, 0]} material={metalMidMat}>
              <sphereGeometry args={[0.09, 8, 8]} />
            </mesh>
          </group>
        )),
      )}
      {/* Trash bins */}
      {[[-6.8, 4], [6.8, -16], [-15.5, 15.8]].map(([x, z], i) => (
        <group key={`bin-${i}`} position={[x, 0.1, z]}>
          <mesh position={[0, 0.4, 0]} material={metalMidMat} castShadow>
            <cylinderGeometry args={[0.3, 0.26, 0.8, 10]} />
          </mesh>
          <mesh position={[0, 0.82, 0]} material={metalDarkMat}>
            <cylinderGeometry args={[0.32, 0.32, 0.05, 10]} />
          </mesh>
        </group>
      ))}
      {/* Newspaper boxes near the crossing */}
      {[["#ff5a4d", -8.2], ["#3d9bff", -8.9], ["#9aa3b0", -9.6]].map(([c, x], i) => (
        <mesh key={`news-${i}`} position={[x as number, 0.35, -15.4]} castShadow>
          <boxGeometry args={[0.4, 0.6, 0.4]} />
          <meshStandardMaterial color={c as string} roughness={0.6} />
        </mesh>
      ))}

      {/* Bus stop shelter on the boulevard */}
      <group position={[11.5, 0, 15.7]}>
        {[-1.5, 1.5].map((x) => (
          <mesh key={x} position={[x, 1.2, 0.5]} material={metalMidMat}>
            <cylinderGeometry args={[0.05, 0.05, 2.4, 6]} />
          </mesh>
        ))}
        <mesh position={[0, 2.45, 0]} material={metalDarkMat} castShadow>
          <boxGeometry args={[3.6, 0.08, 1.4]} />
        </mesh>
        <mesh position={[0, 1.3, -0.55]} material={carGlassMat}>
          <boxGeometry args={[3.4, 1.8, 0.05]} />
        </mesh>
        <mesh position={[0, 0.5, -0.2]} material={benchWoodMat}>
          <boxGeometry args={[2.8, 0.07, 0.45]} />
        </mesh>
      </group>

      {/* 10. Street lamps along both avenues */}
      <StreetLamp pos={[-6.9, 0.1, -24]} ry={0} />
      <StreetLamp pos={[6.9, 0.1, 24]} ry={Math.PI} />
      <StreetLamp pos={[-6.9, 0.1, 36]} ry={0} />
      <StreetLamp pos={[6.9, 0.1, -36]} ry={Math.PI} />
      <StreetLamp pos={[-24, 0.1, 14.9]} ry={-Math.PI / 2} />
      <StreetLamp pos={[24, 0.1, -14.9]} ry={Math.PI / 2} />
      <StreetLamp pos={[-36, 0.1, -14.9]} ry={Math.PI / 2} />
      <StreetLamp pos={[36, 0.1, 14.9]} ry={-Math.PI / 2} />

      {/* 11. Downtown blocks */}
      {BUILDINGS.map((b) => (
        <Building key={b.id} b={b} />
      ))}

      {/* 12. Skyline silhouettes beyond the playfield, softened by fog */}
      {SKYLINE.map((t) => (
        <group key={`sky-${t.id}`}>
          <mesh position={[t.x, t.h / 2, t.z]} material={t.id % 2 === 0 ? skylineGlassMat : skylineMat}>
            <boxGeometry args={[t.w, t.h, t.d]} />
          </mesh>
          <mesh position={[t.x, t.h + t.h * 0.06, t.z]} material={skylineMat}>
            <boxGeometry args={[t.w * 0.55, t.h * 0.12, t.d * 0.55]} />
          </mesh>
        </group>
      ))}

      {/* 13. Lighting: soft, near-shadowless studio light for the clay look —
          high ambient + hemisphere fill, gentle key for soft contact shadows */}
      <ambientLight intensity={0.95} color="#eef4fb" />
      <hemisphereLight args={["#ffffff", "#c4cedb", 0.85]} />
      <directionalLight
        position={[30, 46, 22]}
        intensity={1.15}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={170}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0009}
      />
    </group>
  );
}
