import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial, MathUtils, Vector3 } from "three";

interface HumanoidProps {
  position?: [number, number, number];
  color: string;
  isMoving: boolean;
  isShooting: boolean;
  scale?: number;
  hasGun?: boolean;
  dualWield?: boolean;
  isReloading?: boolean;
}

const _worldPos = new Vector3();

export function Humanoid({
  position = [0, 0, 0],
  color,
  isMoving,
  isShooting,
  scale = 1,
  hasGun = false,
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
    () => new MeshStandardMaterial({ color: "#f5ccbe", roughness: 0.75 }),
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
  const goldMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#ffcc00",
        roughness: 0.1,
        metalness: 0.95,
        emissive: "#aa7a00",
        emissiveIntensity: 0.3,
      }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = 10;

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

    if (actuallyMoving && !isShooting) {
      // Walk Cycle
      const walkCycle = Math.sin(t * speed);
      const walkCycleLegs = Math.sin(t * speed);

      // Bobbing
      if (bodyRef.current) {
        bodyRef.current.position.y = MathUtils.lerp(
          bodyRef.current.position.y,
          0.95 + Math.abs(Math.sin(t * speed * 2)) * 0.05,
          0.2,
        );

        // Torso twist opposite to legs forward
        bodyRef.current.rotation.y = MathUtils.lerp(
          bodyRef.current.rotation.y,
          walkCycle * 0.1,
          0.2,
        );
        bodyRef.current.rotation.z = MathUtils.lerp(
          bodyRef.current.rotation.z,
          Math.sin(t * speed * 2) * 0.02,
          0.2,
        );
      }

      // Arms swing
      if (leftArmRef.current) {
        if (dualWield) {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -Math.PI / 4,
            0.2,
          );
          leftArmRef.current.rotation.z = MathUtils.lerp(
            leftArmRef.current.rotation.z,
            0.1,
            0.2,
          );
        } else {
          leftArmRef.current.rotation.x = MathUtils.lerp(
            leftArmRef.current.rotation.x,
            -walkCycle * 0.5,
            0.2,
          );
        }
      }

      if (hasGun) {
        // Carry gun in a ready stance while running
        if (rightArmRef.current) {
          rightArmRef.current.rotation.x = MathUtils.lerp(
            rightArmRef.current.rotation.x,
            -Math.PI / 4,
            0.2,
          );
          rightArmRef.current.rotation.z = MathUtils.lerp(
            rightArmRef.current.rotation.z,
            -0.1,
            0.2,
          );
        }
        if (rightElbowRef.current)
          rightElbowRef.current.rotation.x = MathUtils.lerp(
            rightElbowRef.current.rotation.x,
            -0.5,
            0.2,
          );
      } else {
        if (rightArmRef.current)
          rightArmRef.current.rotation.x = MathUtils.lerp(
            rightArmRef.current.rotation.x,
            walkCycle * 0.5,
            0.2,
          );
        // Elbow bends forward (negative x) when arm moves forward (negative x).
        if (rightElbowRef.current)
          rightElbowRef.current.rotation.x = MathUtils.lerp(
            rightElbowRef.current.rotation.x,
            walkCycle < 0 ? walkCycle * 0.5 : 0,
            0.2,
          );
      }

      // Left arm moves opposite to right arm
      // Elbow bends forward (negative x) when arm moves forward (negative x)
      if (leftElbowRef.current) {
        if (dualWield) {
          leftElbowRef.current.rotation.x = MathUtils.lerp(
            leftElbowRef.current.rotation.x,
            -0.5,
            0.2,
          );
        } else {
          leftElbowRef.current.rotation.x = MathUtils.lerp(
            leftElbowRef.current.rotation.x,
            -walkCycle < 0 ? -walkCycle * 0.5 : 0,
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
      // Idle & Combat recovery
      if (bodyRef.current) {
        bodyRef.current.position.y = MathUtils.lerp(
          bodyRef.current.position.y,
          0.95,
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

      if (hasGun) {
        // Raise aim arm straight forward
        if (rightArmRef.current) {
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
        if (dualWield) {
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
        {/* Chest with jacket lapels details */}
        <group position={[0, 0.3, 0]}>
          <mesh castShadow receiveShadow material={suitMaterial}>
            <boxGeometry args={[0.42, 0.4, 0.25]} />
          </mesh>

          {/* Jacket Left & Right Lapels */}
          <group position={[-0.1, 0.08, 0.126]}>
            <mesh material={suitMaterial} rotation={[0, 0, -0.2]}>
              <boxGeometry args={[0.07, 0.24, 0.02]} />
            </mesh>
          </group>
          <group position={[0.1, 0.08, 0.126]}>
            <mesh material={suitMaterial} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[0.07, 0.24, 0.02]} />
            </mesh>
          </group>

          {/* Shirt V-Neck */}
          <mesh position={[0, 0.1, 0.126]} material={shirtMaterial}>
            <boxGeometry args={[0.12, 0.2, 0.01]} />
          </mesh>
          {/* Tie */}
          <mesh
            position={[0, 0.04, 0.13]}
            material={
              new MeshStandardMaterial({
                color: color === "#000000" ? "#1a1a1a" : "#444444",
                roughness: 0.8,
              })
            }
          >
            <boxGeometry args={[0.04, 0.26, 0.012]} />
          </mesh>
        </group>

        {/* Abs/Lower Torso */}
        <mesh castShadow material={suitMaterial}>
          <boxGeometry args={[0.38, 0.25, 0.22]} />
        </mesh>

        {/* Neck */}
        <mesh material={skinMaterial}>
          <cylinderGeometry args={[0.06, 0.08, 0.15, 8]} />
        </mesh>

        {/* Head */}
        <group ref={headRef} position={[0, 0.72, 0]}>
          {/* Main Head Base */}
          <mesh castShadow receiveShadow material={skinMaterial}>
            <boxGeometry args={[0.22, 0.28, 0.24]} />
          </mesh>

          {/* Low-poly Short Back Hair details */}
          <group position={[0, 0.05, -0.04]}>
            <mesh
              material={
                new MeshStandardMaterial({ color: "#111111", roughness: 0.9 })
              }
            >
              <boxGeometry args={[0.23, 0.22, 0.18]} />
            </mesh>
            <mesh
              position={[0, 0.12, 0.03]}
              material={
                new MeshStandardMaterial({ color: "#111111", roughness: 0.9 })
              }
            >
              <boxGeometry args={[0.23, 0.06, 0.12]} />
            </mesh>
          </group>

          {/* Slick Agent Sunglasses - Dark visor slit matching the cool poster look */}
          <group position={[0, 0.04, 0.11]}>
            <mesh
              material={
                new MeshStandardMaterial({
                  color: "#050505",
                  roughness: 0.05,
                  metalness: 0.9,
                })
              }
            >
              <boxGeometry args={[0.21, 0.05, 0.035]} />
            </mesh>
            {/* Sunglasses temporal temples lines */}
            <mesh
              position={[-0.105, 0.015, -0.05]}
              material={
                new MeshStandardMaterial({ color: "#050505", roughness: 0.1 })
              }
            >
              <boxGeometry args={[0.01, 0.02, 0.1]} />
            </mesh>
            <mesh
              position={[0.105, 0.015, -0.05]}
              material={
                new MeshStandardMaterial({ color: "#050505", roughness: 0.1 })
              }
            >
              <boxGeometry args={[0.01, 0.02, 0.1]} />
            </mesh>
          </group>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.26, 0.4, 0]}>
          <mesh position={[0, 0, 0]} material={suitMaterial}>
            <sphereGeometry args={[0.07, 16, 16]} />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[0, -0.15, 0]}
            material={suitMaterial}
          >
            <boxGeometry args={[0.12, 0.35, 0.12]} />
          </mesh>

          <group ref={leftElbowRef} position={[0, -0.32, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.06, 16, 16]} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.15, 0]}
              material={suitMaterial}
            >
              <boxGeometry args={[0.1, 0.32, 0.1]} />
            </mesh>

            {/* White Shirt Cuff Sleeve Extensions */}
            <mesh material={shirtMaterial}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
            </mesh>

            <mesh position={[0, -0.36, 0]} material={skinMaterial}>
              <boxGeometry args={[0.08, 0.12, 0.08]} />
            </mesh>

            {dualWield && hasGun && (
              <group position={[0, -0.42, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Barrel / slide */}
                <mesh
                  castShadow
                  material={
                    new MeshStandardMaterial({
                      color: "#1a1a1a",
                      roughness: 0.15,
                      metalness: 0.85,
                    })
                  }
                >
                  <boxGeometry args={[0.04, 0.06, 0.18]} />
                </mesh>
                {/* Grip / handle */}
                <mesh
                  position={[0, -0.05, -0.04]}
                  rotation={[-0.3, 0, 0]}
                  material={
                    new MeshStandardMaterial({
                      color: "#222",
                      roughness: 0.9,
                    })
                  }
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
            <sphereGeometry args={[0.07, 16, 16]} />
          </mesh>
          <mesh
            castShadow
            receiveShadow
            position={[0, -0.15, 0]}
            material={suitMaterial}
          >
            <boxGeometry args={[0.12, 0.35, 0.12]} />
          </mesh>

          <group ref={rightElbowRef} position={[0, -0.32, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.06, 16, 16]} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.15, 0]}
              material={suitMaterial}
            >
              <boxGeometry args={[0.1, 0.32, 0.1]} />
            </mesh>

            {/* White Shirt Cuff Sleeve Extensions */}
            <mesh material={shirtMaterial}>
              <boxGeometry args={[0.09, 0.04, 0.09]} />
            </mesh>

            <mesh position={[0, -0.36, 0]} material={skinMaterial}>
              <boxGeometry args={[0.08, 0.12, 0.08]} />
            </mesh>

            {/* Elegant low poly pistol / Colt Noir style */}
            {hasGun && (
              <group position={[0, -0.42, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                {/* Barrel / slide */}
                <mesh
                  castShadow
                  material={
                    new MeshStandardMaterial({
                      color: "#1a1a1a",
                      roughness: 0.15,
                      metalness: 0.85,
                    })
                  }
                >
                  <boxGeometry args={[0.04, 0.06, 0.18]} />
                </mesh>
                {/* Grip / handle */}
                <mesh
                  position={[0, -0.05, -0.04]}
                  rotation={[-0.3, 0, 0]}
                  material={
                    new MeshStandardMaterial({
                      color: "#111111",
                      roughness: 0.7,
                    })
                  }
                >
                  <boxGeometry args={[0.035, 0.08, 0.035]} />
                </mesh>
                {/* Slide steel highlights */}
                <mesh
                  position={[0, 0.025, 0.04]}
                  material={
                    new MeshStandardMaterial({
                      color: "#ffffff",
                      roughness: 0.2,
                      metalness: 0.9,
                    })
                  }
                >
                  <boxGeometry args={[0.01, 0.012, 0.09]} />
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
              <sphereGeometry args={[0.08, 16, 16]} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.2, 0]}
              material={suitMaterial}
            >
              <boxGeometry args={[0.15, 0.45, 0.15]} />
            </mesh>
            <group ref={leftKneeRef} position={[0, -0.42, 0]}>
              <mesh position={[0, 0, 0]} material={suitMaterial}>
                <sphereGeometry args={[0.075, 16, 16]} />
              </mesh>
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.22, 0]}
                material={suitMaterial}
              >
                <boxGeometry args={[0.13, 0.45, 0.13]} />
              </mesh>
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.48, 0.03]}
                material={shoeMaterial}
              >
                <boxGeometry args={[0.14, 0.08, 0.22]} />
              </mesh>
            </group>
          </group>

          {/* Right Leg */}
          <group ref={rightLegRef} position={[0.12, 0, 0]}>
            <mesh position={[0, 0, 0]} material={suitMaterial}>
              <sphereGeometry args={[0.08, 16, 16]} />
            </mesh>
            <mesh
              castShadow
              receiveShadow
              position={[0, -0.2, 0]}
              material={suitMaterial}
            >
              <boxGeometry args={[0.15, 0.45, 0.15]} />
            </mesh>
            <group ref={rightKneeRef} position={[0, -0.42, 0]}>
              <mesh position={[0, 0, 0]} material={suitMaterial}>
                <sphereGeometry args={[0.075, 16, 16]} />
              </mesh>
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.22, 0]}
                material={suitMaterial}
              >
                <boxGeometry args={[0.13, 0.45, 0.13]} />
              </mesh>
              <mesh
                castShadow
                receiveShadow
                position={[0, -0.48, 0.03]}
                material={shoeMaterial}
              >
                <boxGeometry args={[0.14, 0.08, 0.22]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
