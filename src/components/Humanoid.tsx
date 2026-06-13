import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial, MathUtils, Vector3 } from "three";

interface HumanoidProps {
  position?: [number, number, number];
  color: string;
  isMoving: boolean;
  isRunning?: boolean;
  isShooting: boolean;
  scale?: number;
  hasGun?: boolean;
  weaponType?: string;
  dualWield?: boolean;
  isReloading?: boolean;
}

const _worldPos = new Vector3();

// Shared materials (module-level: created once, reused by every humanoid)
const hairMaterial = new MeshStandardMaterial({
  color: "#15100c",
  roughness: 0.95,
});
const glassesMaterial = new MeshStandardMaterial({
  color: "#050505",
  roughness: 0.05,
  metalness: 0.9,
});
const gunMetalMaterial = new MeshStandardMaterial({
  color: "#1a1a1a",
  roughness: 0.15,
  metalness: 0.85,
});
const gunGripMaterial = new MeshStandardMaterial({
  color: "#111111",
  roughness: 0.7,
});
const woodMaterial = new MeshStandardMaterial({
  color: "#2d1606",
  roughness: 0.9,
});
const shotgunWoodMaterial = new MeshStandardMaterial({
  color: "#281c00",
  roughness: 0.9,
});
const steelMaterial = new MeshStandardMaterial({
  color: "#ffffff",
  roughness: 0.2,
  metalness: 0.9,
});
const beltMaterial = new MeshStandardMaterial({
  color: "#0a0a0a",
  roughness: 0.5,
});

export function Humanoid({
  position = [0, 0, 0],
  color,
  isMoving,
  isRunning = false,
  isShooting,
  scale = 1,
  hasGun = false,
  weaponType = 'pistol',
  dualWield = false,
  isReloading = false,
}: HumanoidProps) {
  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);

  const leftArmRef = useRef<Group>(null);
  const leftElbowRef = useRef<Group>(null);

  const rightArmRef = useRef<Group>(null);
  const rightElbowRef = useRef<Group>(null);

  const leftLegRef = useRef<Group>(null);
  const leftKneeRef = useRef<Group>(null);

  const rightLegRef = useRef<Group>(null);
  const rightKneeRef = useRef<Group>(null);

  const headRef = useRef<Group>(null);

  const lastPosRef = useRef<[number, number, number] | null>(null);

  const suitMaterial = useMemo(
    () => new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15 }),
    [color],
  );
  const skinMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#e7cabd", roughness: 0.85, metalness: 0 }),
    [],
  );
  const shoeMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#0d0d0d",
        roughness: 0.2,
        metalness: 0.4,
      }),
    [],
  );
  const shirtMaterial = useMemo(
    () => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.9 }),
    [],
  );
  const tieMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: color === "#000000" ? "#1a1a1a" : "#444444",
        roughness: 0.8,
      }),
    [color],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = isRunning ? 15 : 10;
    const amplitude = isRunning ? 1.4 : 1.0;

    // Auto-detect movement by tracking actual world position delta
    let actuallyMoving = isMoving;
    if (rootRef.current) {
      rootRef.current.getWorldPosition(_worldPos);
      if (lastPosRef.current) {
        const dx = _worldPos.x - lastPosRef.current[0];
        const dz = _worldPos.z - lastPosRef.current[2];
        const distSq = dx * dx + dz * dz;
        actuallyMoving = distSq > 0.0001; // Moving somewhat
      }
      lastPosRef.current = [_worldPos.x, _worldPos.y, _worldPos.z];
    }

    if (actuallyMoving) {
      // Walk Cycle
      const walkCycle = Math.sin(t * speed) * amplitude;
      const walkCycleLegs = Math.sin(t * speed) * amplitude;

      // Bobbing
      if (bodyRef.current) {
        bodyRef.current.position.y = MathUtils.lerp(
          bodyRef.current.position.y,
          0.95 + Math.abs(Math.sin(t * speed * 2)) * 0.05 * amplitude,
          0.2,
        );

        if (!isShooting && !isReloading) {
          // Torso twist opposite to legs forward
          bodyRef.current.rotation.y = MathUtils.lerp(
            bodyRef.current.rotation.y,
            walkCycle * 0.1,
            0.2,
          );
        }

        bodyRef.current.rotation.z = MathUtils.lerp(
          bodyRef.current.rotation.z,
          Math.sin(t * speed * 2) * 0.02,
          0.2,
        );
      }

      // Head stays level and counter-rotates slightly against the torso twist
      if (headRef.current) {
        headRef.current.rotation.y = MathUtils.lerp(
          headRef.current.rotation.y,
          -walkCycle * 0.06,
          0.15,
        );
        headRef.current.rotation.x = MathUtils.lerp(
          headRef.current.rotation.x,
          0,
          0.15,
        );
      }

      if (!isShooting && !isReloading) {
        // Arms swing naturally with motion, pointing down slightly instead of forward
        if (leftArmRef.current) {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -walkCycle * 0.5,
            0.2,
          );
          leftArmRef.current.rotation.z = MathUtils.lerp(
            leftArmRef.current.rotation.z,
            0,
            0.2,
          );
        }

        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = MathUtils.lerp(
            rightArmRef.current.rotation.x,
            walkCycle * 0.5,
            0.2,
          );
          rightArmRef.current.rotation.z = MathUtils.lerp(
            rightArmRef.current.rotation.z,
            0,
            0.2,
          );
        }

        if (rightElbowRef.current) {
          rightElbowRef.current.rotation.x = MathUtils.lerp(
            rightElbowRef.current.rotation.x,
            walkCycle < 0 ? walkCycle * 0.5 : -0.2,
            0.2,
          );
        }

        if (leftElbowRef.current) {
          leftElbowRef.current.rotation.x = MathUtils.lerp(
            leftElbowRef.current.rotation.x,
            -walkCycle < 0 ? -walkCycle * 0.5 : -0.2,
            0.2,
          );
        }
      }

      // Legs swing
      if (leftLegRef.current)
        leftLegRef.current.rotation.x = MathUtils.lerp(
          leftLegRef.current.rotation.x,
          walkCycleLegs * 0.55,
          0.3,
        );
      if (rightLegRef.current)
        rightLegRef.current.rotation.x = MathUtils.lerp(
          rightLegRef.current.rotation.x,
          -walkCycleLegs * 0.55,
          0.3,
        );

      // Knees bend backward (positive x) when leg moves back (positive x),
      // but also bend slightly when moving forward to clear the ground.
      const leftKneeTarget =
        walkCycleLegs > 0 ? walkCycleLegs * 0.8 : -walkCycleLegs * 0.1;
      const rightKneeTarget =
        -walkCycleLegs > 0 ? -walkCycleLegs * 0.8 : walkCycleLegs * 0.1;

      if (leftKneeRef.current)
        leftKneeRef.current.rotation.x = MathUtils.lerp(
          leftKneeRef.current.rotation.x,
          leftKneeTarget,
          0.3,
        );
      if (rightKneeRef.current)
        rightKneeRef.current.rotation.x = MathUtils.lerp(
          rightKneeRef.current.rotation.x,
          rightKneeTarget,
          0.3,
        );
    } else {
      // Idle & Combat recovery: subtle breathing and a slow head sway keep
      // the figure alive instead of frozen
      if (bodyRef.current) {
        bodyRef.current.position.y = MathUtils.lerp(
          bodyRef.current.position.y,
          0.95 + Math.sin(t * 2.2) * 0.012,
          0.1,
        );
        bodyRef.current.rotation.y = MathUtils.lerp(
          bodyRef.current.rotation.y,
          0,
          0.1,
        );
        bodyRef.current.rotation.z = MathUtils.lerp(
          bodyRef.current.rotation.z,
          0,
          0.1,
        );
      }

      if (headRef.current && !isShooting && !isReloading) {
        headRef.current.rotation.y = MathUtils.lerp(
          headRef.current.rotation.y,
          Math.sin(t * 0.6) * 0.1,
          0.05,
        );
        headRef.current.rotation.x = MathUtils.lerp(
          headRef.current.rotation.x,
          Math.sin(t * 0.9) * 0.03,
          0.05,
        );
      }

      if (leftLegRef.current)
        leftLegRef.current.rotation.x = MathUtils.lerp(
          leftLegRef.current.rotation.x,
          0,
          0.2,
        );
      if (rightLegRef.current)
        rightLegRef.current.rotation.x = MathUtils.lerp(
          rightLegRef.current.rotation.x,
          0,
          0.2,
        );
      if (leftKneeRef.current)
        leftKneeRef.current.rotation.x = MathUtils.lerp(
          leftKneeRef.current.rotation.x,
          0,
          0.2,
        );
      if (rightKneeRef.current)
        rightKneeRef.current.rotation.x = MathUtils.lerp(
          rightKneeRef.current.rotation.x,
          0,
          0.2,
        );

      if (!isShooting) {
        if (leftArmRef.current) {
          if (dualWield) {
            leftArmRef.current.rotation.x = MathUtils.lerp(
              leftArmRef.current.rotation.x,
              -Math.PI / 4,
              0.1,
            );
            leftArmRef.current.rotation.z = MathUtils.lerp(
              leftArmRef.current.rotation.z,
              0.05,
              0.1,
            );
            if (leftElbowRef.current)
              leftElbowRef.current.rotation.x = MathUtils.lerp(
                leftElbowRef.current.rotation.x,
                -0.4,
                0.1,
              );
          } else {
            leftArmRef.current.rotation.x = MathUtils.lerp(
              leftArmRef.current.rotation.x,
              0,
              0.1,
            );
            if (leftElbowRef.current)
              leftElbowRef.current.rotation.x = MathUtils.lerp(
                leftElbowRef.current.rotation.x,
                -0.1,
                0.1,
              );
          }
        }

        if (hasGun) {
          // Idle point gun forward-low
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = MathUtils.lerp(
              rightArmRef.current.rotation.x,
              -Math.PI / 4,
              0.1,
            );
            rightArmRef.current.rotation.z = MathUtils.lerp(
              rightArmRef.current.rotation.z,
              -0.05,
              0.1,
            );
          }
          if (rightElbowRef.current)
            rightElbowRef.current.rotation.x = MathUtils.lerp(
              rightElbowRef.current.rotation.x,
              -0.4,
              0.1,
            );
        } else {
          if (rightArmRef.current)
            rightArmRef.current.rotation.x = MathUtils.lerp(
              rightArmRef.current.rotation.x,
              0,
              0.1,
            );
          if (rightElbowRef.current)
            rightElbowRef.current.rotation.x = MathUtils.lerp(
              rightElbowRef.current.rotation.x,
              -0.1,
              0.1,
            );
        }
      }
    }

    // Shooting / Reloading Pose (Takes priority)
    const recoilX = isShooting && !isReloading ? (Math.sin(state.clock.getElapsedTime() * 40) > 0 ? -0.2 : 0) : 0;

    if (isReloading) {
      if (bodyRef.current) {
        bodyRef.current.rotation.y = MathUtils.lerp(bodyRef.current.rotation.y, 0, 0.3);
      }

      // Head looks down at the weapon while reloading
      if (headRef.current) {
        headRef.current.rotation.x = MathUtils.lerp(headRef.current.rotation.x, 0.35, 0.2);
        headRef.current.rotation.y = MathUtils.lerp(headRef.current.rotation.y, 0, 0.2);
      }

      // fast alternating hands rotation
      const reloadTwirl = Math.sin(t * 15);

      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 4 + reloadTwirl * 0.2, 0.4);
        rightArmRef.current.rotation.z = MathUtils.lerp(rightArmRef.current.rotation.z, 0.2, 0.4);
      }
      if (rightElbowRef.current) {
        rightElbowRef.current.rotation.x = MathUtils.lerp(rightElbowRef.current.rotation.x, -1.0, 0.4);
      }

      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = MathUtils.lerp(leftArmRef.current.rotation.x, -Math.PI / 4 - reloadTwirl * 0.2, 0.4);
        leftArmRef.current.rotation.z = MathUtils.lerp(leftArmRef.current.rotation.z, -0.2, 0.4);
      }
      if (leftElbowRef.current) {
        leftElbowRef.current.rotation.x = MathUtils.lerp(leftElbowRef.current.rotation.x, -1.0, 0.4);
      }
    } else if (isShooting) {
      if (bodyRef.current) {
        // Twist slightly
        bodyRef.current.rotation.y = MathUtils.lerp(
          bodyRef.current.rotation.y,
          -Math.PI / 6,
          0.3,
        );
      }

      // Head counter-rotates to keep eyes on the target
      if (headRef.current) {
        headRef.current.rotation.y = MathUtils.lerp(
          headRef.current.rotation.y,
          Math.PI / 6,
          0.3,
        );
        headRef.current.rotation.x = MathUtils.lerp(
          headRef.current.rotation.x,
          0,
          0.3,
        );
      }

      if (hasGun) {
        // Raise aim arm straight forward
        if (rightArmRef.current) {
          if (weaponType === 'tommy' || weaponType === 'shotgun') {
            rightArmRef.current.rotation.x = MathUtils.lerp(
              rightArmRef.current.rotation.x,
              -Math.PI / 2 + 0.1 + (weaponType === 'shotgun' ? recoilX * 1.5 : recoilX * 0.5),
              0.4,
            );
            rightArmRef.current.rotation.z = MathUtils.lerp(
              rightArmRef.current.rotation.z,
              0.15,
              0.4,
            );
          } else {
            rightArmRef.current.rotation.x = MathUtils.lerp(
              rightArmRef.current.rotation.x,
              -Math.PI / 2 + recoilX,
              0.4,
            );
            rightArmRef.current.rotation.z = MathUtils.lerp(
              rightArmRef.current.rotation.z,
              -0.1,
              0.4,
            );
          }
        }
        if (rightElbowRef.current)
          rightElbowRef.current.rotation.x = MathUtils.lerp(
            rightElbowRef.current.rotation.x,
            -0.05 + recoilX * 0.5,
            0.4,
          );
      } else {
        // Punch-like behavior
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = MathUtils.lerp(
            rightArmRef.current.rotation.x,
            -Math.PI / 2 + 0.2,
            0.3,
          );
          rightArmRef.current.rotation.z = MathUtils.lerp(
            rightArmRef.current.rotation.z,
            -0.2,
            0.3,
          );
        }
        if (rightElbowRef.current)
          rightElbowRef.current.rotation.x = MathUtils.lerp(
            rightElbowRef.current.rotation.x,
            0,
            0.3,
          );
      }

      // Guard left hand or shoot
      if (leftArmRef.current) {
        if (weaponType === 'tommy' || weaponType === 'shotgun') {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -Math.PI / 2 + 0.3 + recoilX * 0.8,
            0.4,
          );
          leftArmRef.current.rotation.z = MathUtils.lerp(
            leftArmRef.current.rotation.z,
            0.35,
            0.4,
          );
          if (leftElbowRef.current) {
            leftElbowRef.current.rotation.x = MathUtils.lerp(
              leftElbowRef.current.rotation.x,
              -0.4,
              0.4,
            );
          }
        } else if (dualWield) {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -Math.PI / 2 + recoilX,
            0.4,
          );
          leftArmRef.current.rotation.z = MathUtils.lerp(
            leftArmRef.current.rotation.z,
            0.1,
            0.4,
          );
          if (leftElbowRef.current) {
            leftElbowRef.current.rotation.x = MathUtils.lerp(
              leftElbowRef.current.rotation.x,
              -0.05 + recoilX * 0.5,
              0.4,
            );
          }
        } else {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -Math.PI / 3,
            0.2,
          );
          leftArmRef.current.rotation.z = MathUtils.lerp(
            leftArmRef.current.rotation.z,
            0.3,
            0.2,
          );
          if (leftElbowRef.current) {
            leftElbowRef.current.rotation.x = MathUtils.lerp(
              leftElbowRef.current.rotation.x,
              -1.5,
              0.2,
            );
          }
        }
      }
    } else {
      // Clean up rotation z
      if (rightArmRef.current)
        rightArmRef.current.rotation.z = MathUtils.lerp(
          rightArmRef.current.rotation.z,
          0.1,
          0.1,
        );
      if (leftArmRef.current)
        leftArmRef.current.rotation.z = MathUtils.lerp(
          leftArmRef.current.rotation.z,
          -0.1,
          0.1,
        );
    }
  });

  return (
    <group ref={rootRef} position={position} scale={scale}>
      <group ref={bodyRef} position={[0, 0.95, 0]}>
        {/* Chest: rounded ribcage tapering into the waist */}
        <group position={[0, 0.3, 0]}>
          <mesh
            castShadow
            receiveShadow
            material={suitMaterial}
            scale={[1, 1, 0.72]}
          >
            <capsuleGeometry args={[0.2, 0.2, 4, 14]} />
          </mesh>

          {/* Shoulder pads of the suit jacket */}
          <mesh
            castShadow
            position={[-0.19, 0.12, 0]}
            material={suitMaterial}
            scale={[1, 0.8, 0.85]}
          >
            <sphereGeometry args={[0.09, 12, 10]} />
          </mesh>
          <mesh
            castShadow
            position={[0.19, 0.12, 0]}
            material={suitMaterial}
            scale={[1, 0.8, 0.85]}
          >
            <sphereGeometry args={[0.09, 12, 10]} />
          </mesh>

          {/* Jacket Left & Right Lapels */}
          <group position={[-0.085, 0.06, 0.147]}>
            <mesh material={suitMaterial} rotation={[0.06, -0.25, -0.22]}>
              <boxGeometry args={[0.065, 0.24, 0.018]} />
            </mesh>
          </group>
          <group position={[0.085, 0.06, 0.147]}>
            <mesh material={suitMaterial} rotation={[0.06, 0.25, 0.22]}>
              <boxGeometry args={[0.065, 0.24, 0.018]} />
            </mesh>
          </group>

          {/* Shirt V-Neck */}
          <mesh position={[0, 0.08, 0.149]} material={shirtMaterial}>
            <boxGeometry args={[0.1, 0.22, 0.012]} />
          </mesh>
          {/* Tie knot */}
          <mesh position={[0, 0.16, 0.163]} material={tieMaterial}>
            <boxGeometry args={[0.05, 0.045, 0.02]} />
          </mesh>
          {/* Tie tail */}
          <mesh
            position={[0, 0.02, 0.159]}
            rotation={[0.04, 0, 0]}
            material={tieMaterial}
          >
            <boxGeometry args={[0.038, 0.24, 0.014]} />
          </mesh>
        </group>

        {/* Abs/Lower Torso (narrower waist) */}
        <mesh
          castShadow
          material={suitMaterial}
          scale={[0.95, 1, 0.7]}
          position={[0, 0.02, 0]}
        >
          <capsuleGeometry args={[0.17, 0.14, 4, 12]} />
        </mesh>

        {/* Belt */}
        <mesh position={[0, -0.1, 0]} material={beltMaterial} scale={[1, 1, 0.72]}>
          <cylinderGeometry args={[0.165, 0.165, 0.045, 14]} />
        </mesh>

        {/* Neck */}
        <mesh position={[0, 0.52, 0]} material={skinMaterial}>
          <cylinderGeometry args={[0.05, 0.065, 0.14, 10]} />
        </mesh>
        {/* Shirt collar */}
        <mesh position={[0, 0.47, 0]} material={shirtMaterial}>
          <cylinderGeometry args={[0.075, 0.085, 0.05, 10]} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0.72, 0]}>
          {/* Skull: rounded ellipsoid */}
          <mesh
            castShadow
            receiveShadow
            material={skinMaterial}
            position={[0, 0.02, 0]}
            scale={[0.92, 1.12, 0.98]}
          >
            <sphereGeometry args={[0.125, 20, 16]} />
          </mesh>

          {/* Jaw / chin */}
          <mesh
            castShadow
            material={skinMaterial}
            position={[0, -0.08, 0.04]}
            scale={[1.05, 0.78, 0.95]}
          >
            <sphereGeometry args={[0.075, 14, 12]} />
          </mesh>

          {/* Ears */}
          <mesh
            material={skinMaterial}
            position={[-0.114, 0.0, 0]}
            scale={[0.45, 1, 0.75]}
          >
            <sphereGeometry args={[0.032, 10, 8]} />
          </mesh>
          <mesh
            material={skinMaterial}
            position={[0.114, 0.0, 0]}
            scale={[0.45, 1, 0.75]}
          >
            <sphereGeometry args={[0.032, 10, 8]} />
          </mesh>

          {/* Nose */}
          <mesh
            material={skinMaterial}
            position={[0, -0.025, 0.125]}
            scale={[0.65, 1.1, 1]}
          >
            <sphereGeometry args={[0.024, 10, 8]} />
          </mesh>

          {/* Slicked-back short hair: rounded cap hugging the skull */}
          <mesh
            material={hairMaterial}
            position={[0, 0.065, -0.022]}
            scale={[0.97, 0.85, 0.98]}
          >
            <sphereGeometry args={[0.128, 18, 14]} />
          </mesh>
          {/* Hairline at the back of the neck */}
          <mesh
            material={hairMaterial}
            position={[0, -0.04, -0.095]}
            scale={[0.85, 0.7, 0.45]}
          >
            <sphereGeometry args={[0.1, 12, 10]} />
          </mesh>

          {/* Wrap-around agent sunglasses: two lenses, bridge and temples */}
          <group position={[0, 0.025, 0.1]}>
            <mesh
              material={glassesMaterial}
              position={[-0.052, 0, 0.018]}
              rotation={[0, -0.32, 0]}
            >
              <boxGeometry args={[0.075, 0.045, 0.018]} />
            </mesh>
            <mesh
              material={glassesMaterial}
              position={[0.052, 0, 0.018]}
              rotation={[0, 0.32, 0]}
            >
              <boxGeometry args={[0.075, 0.045, 0.018]} />
            </mesh>
            {/* Bridge */}
            <mesh material={glassesMaterial} position={[0, 0.008, 0.026]}>
              <boxGeometry args={[0.035, 0.012, 0.014]} />
            </mesh>
            {/* Temples back to the ears */}
            <mesh material={glassesMaterial} position={[-0.105, 0.005, -0.05]}>
              <boxGeometry args={[0.008, 0.014, 0.13]} />
            </mesh>
            <mesh material={glassesMaterial} position={[0.105, 0.005, -0.05]}>
              <boxGeometry args={[0.008, 0.014, 0.13]} />
            </mesh>
          </group>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.26, 0.4, 0]}>
          <mesh position={[0, 0, 0]} material={suitMaterial}>
            <sphereGeometry args={[0.07, 14, 12]} />
          </mesh>
          {/* Upper arm: rounded sleeve */}
          <mesh
            castShadow
            receiveShadow
            position={[0, -0.16, 0]}
            material={suitMaterial}
          >
            <capsuleGeometry args={[0.057, 0.2, 4, 10]} />
          </mesh>

          <group ref={leftElbowRef} position={[0, -0.32, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.055, 12, 10]} />
            </mesh>
            {/* Forearm */}
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.15, 0]}
              material={suitMaterial}
            >
              <capsuleGeometry args={[0.048, 0.18, 4, 10]} />
            </mesh>

            {/* White Shirt Cuff at the wrist */}
            <mesh position={[0, -0.27, 0]} material={shirtMaterial}>
              <cylinderGeometry args={[0.052, 0.052, 0.04, 10]} />
            </mesh>

            {/* Hand: rounded fist */}
            <mesh
              castShadow
              position={[0, -0.345, 0.005]}
              material={skinMaterial}
              scale={[0.85, 1.15, 0.95]}
            >
              <sphereGeometry args={[0.052, 12, 10]} />
            </mesh>

            {dualWield && hasGun && (
              <group position={[0, -0.42, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Barrel / slide */}
                <mesh castShadow material={gunMetalMaterial}>
                  <boxGeometry args={[0.04, 0.06, 0.18]} />
                </mesh>
                {/* Grip / handle */}
                <mesh
                  position={[0, -0.05, -0.04]}
                  rotation={[-0.3, 0, 0]}
                  material={gunGripMaterial}
                >
                  <boxGeometry args={[0.035, 0.09, 0.05]} />
                </mesh>
              </group>
            )}
          </group>
        </group>

        {/* Right Arm */}
        <group ref={rightArmRef} position={[0.26, 0.4, 0]}>
          <mesh position={[0, 0, 0]} material={suitMaterial}>
            <sphereGeometry args={[0.07, 14, 12]} />
          </mesh>
          {/* Upper arm: rounded sleeve */}
          <mesh
            castShadow
            receiveShadow
            position={[0, -0.16, 0]}
            material={suitMaterial}
          >
            <capsuleGeometry args={[0.057, 0.2, 4, 10]} />
          </mesh>

          <group ref={rightElbowRef} position={[0, -0.32, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.055, 12, 10]} />
            </mesh>
            {/* Forearm */}
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.15, 0]}
              material={suitMaterial}
            >
              <capsuleGeometry args={[0.048, 0.18, 4, 10]} />
            </mesh>

            {/* White Shirt Cuff at the wrist */}
            <mesh position={[0, -0.27, 0]} material={shirtMaterial}>
              <cylinderGeometry args={[0.052, 0.052, 0.04, 10]} />
            </mesh>

            {/* Hand: rounded fist */}
            <mesh
              castShadow
              position={[0, -0.345, 0.005]}
              material={skinMaterial}
              scale={[0.85, 1.15, 0.95]}
            >
              <sphereGeometry args={[0.052, 12, 10]} />
            </mesh>

            {/* Right Hand Weapons */}
            {hasGun && (!weaponType || weaponType === 'pistol') && (
              <group position={[0, -0.42, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Barrel / slide */}
                <mesh castShadow material={gunMetalMaterial}>
                  <boxGeometry args={[0.04, 0.06, 0.18]} />
                </mesh>
                {/* Grip / handle */}
                <mesh
                  position={[0, -0.05, -0.04]}
                  rotation={[-0.3, 0, 0]}
                  material={gunGripMaterial}
                >
                  <boxGeometry args={[0.035, 0.08, 0.035]} />
                </mesh>
                {/* Slide steel highlights */}
                <mesh position={[0, 0.025, 0.04]} material={steelMaterial}>
                  <boxGeometry args={[0.01, 0.012, 0.09]} />
                </mesh>
              </group>
            )}

            {hasGun && weaponType === 'tommy' && (
              <group position={[0, -0.42, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Barrel / Body */}
                <mesh castShadow material={gunMetalMaterial}>
                  <boxGeometry args={[0.045, 0.07, 0.35]} />
                </mesh>
                {/* Drum Magazine */}
                <mesh position={[0, -0.05, -0.02]} rotation={[0, 0, Math.PI / 2]} material={gunGripMaterial}>
                  <cylinderGeometry args={[0.065, 0.065, 0.055, 16]} />
                </mesh>
                {/* Grip / handle */}
                <mesh position={[0, -0.06, -0.12]} rotation={[-0.3, 0, 0]} material={woodMaterial}>
                  <boxGeometry args={[0.035, 0.1, 0.04]} />
                </mesh>
                {/* Front grip / wood */}
                <mesh position={[0, -0.05, 0.12]} material={woodMaterial}>
                  <boxGeometry args={[0.035, 0.04, 0.16]} />
                </mesh>
                {/* Thin Barrel end */}
                <mesh position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]} material={gunMetalMaterial}>
                  <cylinderGeometry args={[0.01, 0.01, 0.1, 8]} />
                </mesh>
              </group>
            )}

            {hasGun && weaponType === 'shotgun' && (
              <group position={[0, -0.42, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Long Barrel */}
                <mesh castShadow position={[0, 0.015, 0.1]} rotation={[Math.PI / 2, 0, 0]} material={gunMetalMaterial}>
                  <cylinderGeometry args={[0.012, 0.012, 0.45, 8]} />
                </mesh>
                {/* Lower Tube */}
                <mesh castShadow position={[0, -0.015, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={gunGripMaterial}>
                  <cylinderGeometry args={[0.014, 0.014, 0.35, 8]} />
                </mesh>
                {/* Receiver */}
                <mesh castShadow position={[0, 0, -0.1]} material={gunGripMaterial}>
                  <boxGeometry args={[0.04, 0.06, 0.16]} />
                </mesh>
                {/* Grip / handle / Stock base */}
                <mesh position={[0, -0.04, -0.16]} rotation={[-0.4, 0, 0]} material={shotgunWoodMaterial}>
                  <boxGeometry args={[0.035, 0.09, 0.045]} />
                </mesh>
                {/* Pump (wood) */}
                <mesh position={[0, -0.015, 0.12]} rotation={[Math.PI / 2, 0, 0]} material={shotgunWoodMaterial}>
                  <cylinderGeometry args={[0.02, 0.02, 0.12, 8]} />
                </mesh>
              </group>
            )}
          </group>
        </group>

        {/* Hips */}
        <group position={[0, -0.1, 0]}>
          {/* Left Leg */}
          <group ref={leftLegRef} position={[-0.12, 0, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.08, 14, 12]} />
            </mesh>
            {/* Thigh */}
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.2, 0]}
              material={suitMaterial}
            >
              <capsuleGeometry args={[0.073, 0.26, 4, 12]} />
            </mesh>
            <group ref={leftKneeRef} position={[0, -0.42, 0]}>
              <mesh position={[0, 0, 0]} material={suitMaterial}>
                <sphereGeometry args={[0.068, 12, 10]} />
              </mesh>
              {/* Calf with trouser drape */}
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.22, 0]}
                material={suitMaterial}
              >
                <capsuleGeometry args={[0.062, 0.27, 4, 12]} />
              </mesh>
              {/* Ankle */}
              <mesh position={[0, -0.42, 0]} material={beltMaterial}>
                <cylinderGeometry args={[0.045, 0.05, 0.06, 10]} />
              </mesh>
              {/* Dress shoe with a rounded toe */}
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.475, 0.015]}
                material={shoeMaterial}
              >
                <boxGeometry args={[0.115, 0.07, 0.18]} />
              </mesh>
              <mesh
                castShadow
                position={[0, -0.485, 0.11]}
                material={shoeMaterial}
                scale={[1, 0.55, 1.3]}
              >
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
            </group>
          </group>

          {/* Right Leg */}
          <group ref={rightLegRef} position={[0.12, 0, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.08, 14, 12]} />
            </mesh>
            {/* Thigh */}
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.2, 0]}
              material={suitMaterial}
            >
              <capsuleGeometry args={[0.073, 0.26, 4, 12]} />
            </mesh>
            <group ref={rightKneeRef} position={[0, -0.42, 0]}>
              <mesh position={[0, 0, 0]} material={suitMaterial}>
                <sphereGeometry args={[0.068, 12, 10]} />
              </mesh>
              {/* Calf with trouser drape */}
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.22, 0]}
                material={suitMaterial}
              >
                <capsuleGeometry args={[0.062, 0.27, 4, 12]} />
              </mesh>
              {/* Ankle */}
              <mesh position={[0, -0.42, 0]} material={beltMaterial}>
                <cylinderGeometry args={[0.045, 0.05, 0.06, 10]} />
              </mesh>
              {/* Dress shoe with a rounded toe */}
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.475, 0.015]}
                material={shoeMaterial}
              >
                <boxGeometry args={[0.115, 0.07, 0.18]} />
              </mesh>
              <mesh
                castShadow
                position={[0, -0.485, 0.11]}
                material={shoeMaterial}
                scale={[1, 0.55, 1.3]}
              >
                <sphereGeometry args={[0.055, 10, 8]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
