import { useRef, useMemo, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Vector3,
  MathUtils,
  Group,
  MeshBasicMaterial,
  Mesh,
  Color,
} from "three";
import { useGameStore } from "../store";
import { Humanoid } from "./Humanoid";
import { City } from "./City";
import { resolveBuildingCollisions, BUILDINGS } from "../utils/buildings";

const BOUNDARY = 45;
const SPEED = 8;
const MAX_ACTIVE_BULLETS = 35;
const MAX_PARTICLES = 250;

// High-performance shared synthesizers using cached AudioContext & pre-generated noise buffer
let sharedAudioCtx: AudioContext | null = null;
let sharedNoiseBuffer: AudioBuffer | null = null;

function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!sharedNoiseBuffer) {
    const bufferSize = ctx.sampleRate * 0.45; // 0.45 seconds of natural decay
    sharedNoiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = sharedNoiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return sharedNoiseBuffer;
}

function playShootSound() {
  try {
    const ctx = getAudioContext();

    // 1. Play Pre-generated Gunpowder Blast (White Noise)
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.15);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.4);

    // 2. Low Frequency Thump Simulator
    const lowOsc = ctx.createOscillator();
    const lowGain = ctx.createGain();
    lowOsc.type = "triangle";
    lowOsc.frequency.setValueAtTime(170, ctx.currentTime);
    lowOsc.frequency.exponentialRampToValueAtTime(15, ctx.currentTime + 0.12);

    lowGain.gain.setValueAtTime(0.75, ctx.currentTime);
    lowGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    // 3. Firing Pin Transient Click
    const highOsc = ctx.createOscillator();
    const highGain = ctx.createGain();
    highOsc.type = "sine";
    highOsc.frequency.setValueAtTime(1100, ctx.currentTime);
    highGain.gain.setValueAtTime(0.1, ctx.currentTime);
    highGain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.04);

    // Connect nodes
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    lowOsc.connect(lowGain);
    lowGain.connect(ctx.destination);

    highOsc.connect(highGain);
    highGain.connect(ctx.destination);

    // Start playbacks instantly
    noise.start();
    lowOsc.start();
    highOsc.start();

    noise.stop(ctx.currentTime + 0.45);
    lowOsc.stop(ctx.currentTime + 0.15);
    highOsc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function playHitSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
}

function playConvertSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);

    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(440, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc2.start();
    osc.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

export function GameScene() {
  const { camera } = useThree();
  const { joystickVector, isShooting, score, totalNPCs, setScore, setStatus } =
    useGameStore();

  const playerRef = useRef<Group>(null);
  const playerPos = useRef(new Vector3(0, 0, 0));
  const [playerMoving, setPlayerMoving] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false);

  // Initialize NPCs
  const npcs = useMemo(() => {
    const list = [];
    for (let i = 0; i < totalNPCs; i++) {
      list.push({
        id: i,
        position: new Vector3(
          (Math.random() - 0.5) * 80,
          0,
          (Math.random() - 0.5) * 80,
        ),
        velocity: new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
          .normalize()
          .multiplyScalar(2 + Math.random() * 2),
        converted: false,
        timer: Math.random() * 5,
        lastShootTime: Math.random() * 2, // Stagger initial shots
        isShooting: false, // For animation
      });
    }
    return list;
  }, [totalNPCs]);

  // Conversions, hit counts and flashing damage states
  const [convertedMap, setConvertedMap] = useState<Record<number, boolean>>({});
  const [npcHitsMap, setNpcHitsMap] = useState<Record<number, number>>({});
  const [flashMap, setFlashMap] = useState<Record<number, boolean>>({});

  // High-performance bullet pool
  const bulletMeshesPoolRef = useRef<(Mesh | null)[]>([]);
  const bulletPoolRef = useRef<
    {
      position: Vector3;
      direction: Vector3;
      active: boolean;
    }[]
  >(
    Array.from({ length: MAX_ACTIVE_BULLETS }, () => ({
      position: new Vector3(),
      direction: new Vector3(),
      active: false,
    })),
  );
  const nextBulletIdxRef = useRef(0);
  const lastFireTimeRef = useRef(0);

  // Enemy bullet pool
  const MAX_ENEMY_BULLETS = 60;
  const enemyBulletMeshesRef = useRef<(Mesh | null)[]>([]);
  const enemyBulletPoolRef = useRef<
    {
      position: Vector3;
      direction: Vector3;
      active: boolean;
    }[]
  >(
    Array.from({ length: MAX_ENEMY_BULLETS }, () => ({
      position: new Vector3(),
      direction: new Vector3(),
      active: false,
    })),
  );
  const nextEnemyBulletIdxRef = useRef(0);

  // High-performance hit debris particle pool (Zero garbage collections!)
  const particleMeshesRef = useRef<(Mesh | null)[]>([]);
  const particlePoolRef = useRef<
    {
      position: Vector3;
      velocity: Vector3;
      rotation: Vector3;
      active: boolean;
      life: number;
      color: string;
      size: number;
    }[]
  >(
    Array.from({ length: MAX_PARTICLES }, () => ({
      position: new Vector3(),
      velocity: new Vector3(),
      rotation: new Vector3(),
      active: false,
      life: 0,
      color: "#111111",
      size: 0.15,
    })),
  );
  const nextParticleIdxRef = useRef(0);

  const npcRefs = useRef<Group[]>([]);

  // Spawn particle explosions when shooting characters
  const triggerHitParticles = (
    targetPos: Vector3,
    shooterDir: Vector3,
    type: "blood" | "spark" | "convert" = "blood",
  ) => {
    const startIdx = nextParticleIdxRef.current;
    const spawnCount = type === "convert" ? 24 : 12;

    for (let i = 0; i < spawnCount; i++) {
      const pIdx = (startIdx + i) % MAX_PARTICLES;
      const p = particlePoolRef.current[pIdx];

      // Spawn slightly elevated at torso height
      p.position
        .copy(targetPos)
        .add(new Vector3(0, 0.5 + Math.random() * 0.8, 0));

      // Blow back in bullet trajectory + vertical burst + dispersion spray
      const blowback = shooterDir.clone().normalize();
      if (type === "convert") {
        // Spherical burst for conversion
        blowback
          .set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
          )
          .normalize();
      } else {
        blowback.x += (Math.random() - 0.5) * 1.5;
        blowback.y += Math.random() * 1.2 + 0.2;
        blowback.z += (Math.random() - 0.5) * 1.5;
        blowback.normalize();
      }

      const speed =
        type === "convert"
          ? 6.0 + Math.random() * 8.0
          : 4.5 + Math.random() * 5.0;
      p.velocity.copy(blowback).multiplyScalar(speed);

      p.active = true;
      p.life = 1.0;
      p.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      if (type === "blood") {
        p.color = Math.random() > 0.4 ? "#ff0033" : "#aa0000";
      } else if (type === "convert") {
        p.color = Math.random() > 0.5 ? "#00ffff" : "#ffffff";
      } else {
        p.color = "#ffff00";
      }

      p.size = 0.08 + Math.random() * 0.14; // Multi-size particles

      const mesh = particleMeshesRef.current[pIdx];
      if (mesh) {
        mesh.position.copy(p.position);
        mesh.visible = true;
        mesh.scale.setScalar(1.0);
        if (mesh.material) {
          (mesh.material as MeshBasicMaterial).color.set(p.color);
        }
      }
    }
    nextParticleIdxRef.current = (startIdx + spawnCount) % MAX_PARTICLES;
  };

  useFrame((state, delta) => {
    // Player Movement
    const jx = joystickVector.x;
    const jy = joystickVector.y;

    const gameStatus = useGameStore.getState().status;
    let isMoving = false;

    if (gameStatus === "playing") {
      if (Math.abs(jx) > 0.01 || Math.abs(jy) > 0.01) {
        isMoving = true;

        const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        right.y = 0;
        right.normalize();
        const forward = new Vector3(0, 0, -1).applyQuaternion(
          camera.quaternion,
        );
        forward.y = 0;
        forward.normalize();

        const moveDir = forward
          .multiplyScalar(-jy)
          .add(right.multiplyScalar(jx))
          .normalize();

        // Update position
        playerPos.current.add(moveDir.clone().multiplyScalar(SPEED * delta));

        // Clamp to boundary
        playerPos.current.x = MathUtils.clamp(
          playerPos.current.x,
          -BOUNDARY,
          BOUNDARY,
        );
        playerPos.current.z = MathUtils.clamp(
          playerPos.current.z,
          -BOUNDARY,
          BOUNDARY,
        );

        // Resolve building collisions
        resolveBuildingCollisions(playerPos.current, 0.4);

        // Update store for camera/UI
        useGameStore
          .getState()
          .setPlayerPosition([
            playerPos.current.x,
            playerPos.current.y,
            playerPos.current.z,
          ]);

        // Update rotation smoothly
        if (playerRef.current) {
          playerRef.current.position.copy(playerPos.current);
          const { shootVector } = useGameStore.getState();
          // If we have a shoot vector with significant length, point in that direction
          if (shootVector.x !== 0 || shootVector.y !== 0) {
            const right = new Vector3(1, 0, 0).applyQuaternion(
              camera.quaternion,
            );
            right.y = 0;
            right.normalize();
            const forward = new Vector3(0, 0, -1).applyQuaternion(
              camera.quaternion,
            );
            forward.y = 0;
            forward.normalize();
            const shootDir = forward
              .multiplyScalar(-shootVector.y)
              .add(right.multiplyScalar(shootVector.x))
              .normalize();
            playerRef.current.rotation.y = Math.atan2(shootDir.x, shootDir.z);
          } else {
            const targetRot = Math.atan2(moveDir.x, moveDir.z);
            playerRef.current.rotation.y = targetRot;
          }
        }
      } else {
        if (playerRef.current) {
          playerRef.current.position.copy(playerPos.current);
          // Even when not moving, we might be aiming!
          const { shootVector } = useGameStore.getState();
          if (shootVector.x !== 0 || shootVector.y !== 0) {
            const right = new Vector3(1, 0, 0).applyQuaternion(
              camera.quaternion,
            );
            right.y = 0;
            right.normalize();
            const forward = new Vector3(0, 0, -1).applyQuaternion(
              camera.quaternion,
            );
            forward.y = 0;
            forward.normalize();
            const shootDir = forward
              .multiplyScalar(-shootVector.y)
              .add(right.multiplyScalar(shootVector.x))
              .normalize();
            playerRef.current.rotation.y = Math.atan2(shootDir.x, shootDir.z);
          }
        }
      }
    }

    if (playerMoving !== isMoving) setPlayerMoving(isMoving);

    // Camera follow (isometric offset)
    const cameraOffset = new Vector3(15, 20, 15);
    camera.position.lerp(playerPos.current.clone().add(cameraOffset), 0.1);
    camera.lookAt(playerPos.current);

    // Rate-limited Pistol shooting
    const time = state.clock.getElapsedTime();
    if (
      gameStatus === "playing" &&
      isShooting &&
      time - lastFireTimeRef.current > 0.22
    ) {
      lastFireTimeRef.current = time;
      playShootSound();

      // Fire gun facing direction
      const playerRot = playerRef.current?.rotation.y || 0;
      const fireDir = new Vector3(
        Math.sin(playerRot),
        0,
        Math.cos(playerRot),
      ).normalize();

      // Set offset position slightly matches hand elevation
      const firePos = playerPos.current
        .clone()
        .add(new Vector3(0, 0.9, 0))
        .addScaledVector(fireDir, 0.65);

      const idx = nextBulletIdxRef.current;
      const bulletToActivate = bulletPoolRef.current[idx];

      bulletToActivate.position.copy(firePos);
      bulletToActivate.direction.copy(fireDir);
      bulletToActivate.active = true;

      // Play brief high-intensity muzzle flash blast animation
      setMuzzleFlash(true);
      setTimeout(() => {
        setMuzzleFlash(false);
      }, 55);

      // Bring mesh to initial coordinate and trigger visibility instantly without React trigger
      const mesh = bulletMeshesPoolRef.current[idx];
      if (mesh) {
        mesh.position.copy(firePos);
        mesh.rotation.y = playerRot; // Align long laser/tracer box along axis!
        mesh.visible = true;
      }

      nextBulletIdxRef.current = (idx + 1) % MAX_ACTIVE_BULLETS;
    }

    // Direct loop transformation of active bullets (Zero React state impact)
    bulletPoolRef.current.forEach((bullet, idx) => {
      if (!bullet.active) return;

      // Bullets travel quickly
      bullet.position.addScaledVector(bullet.direction, 45 * delta);

      const mesh = bulletMeshesPoolRef.current[idx];
      if (mesh) {
        mesh.position.copy(bullet.position);
      }

      const pos = bullet.position;
      // boundary clearance to garbage collect far-away bullets
      if (
        pos.x > BOUNDARY + 15 ||
        pos.x < -BOUNDARY - 15 ||
        pos.z > BOUNDARY + 15 ||
        pos.z < -BOUNDARY - 15
      ) {
        bullet.active = false;
        if (mesh) mesh.visible = false;
        return;
      }

      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const npcId = npc.id;
        const isNpcAlreadyConverted = npc.converted || convertedMap[npcId];

        if (!isNpcAlreadyConverted) {
          const distance = pos.distanceTo(npc.position);

          // Standard satisfying collision radius (1.1 fits hitbox bounds)
          if (distance < 1.1) {
            bullet.active = false;
            if (mesh) mesh.visible = false;

            const prevHits = npcHitsMap[npcId] || 0;
            const nextHits = prevHits + 1;

            if (nextHits >= 4) {
              // Converted NPC triggers
              npc.converted = true;
              playConvertSound();
              triggerHitParticles(npc.position, bullet.direction, "convert");

              setConvertedMap((prev) => ({ ...prev, [npcId]: true }));
              setNpcHitsMap((prev) => {
                const copy = { ...prev };
                delete copy[npcId];
                return copy;
              });

              // Score update
              const currentScore = useGameStore.getState().score;
              const newScore = currentScore + 1;
              setScore(newScore);
              if (newScore >= totalNPCs) {
                setStatus("won");
              }
            } else {
              // Hit but not yet converted - play impact and set red flash
              triggerHitParticles(npc.position, bullet.direction, "blood");
              playHitSound();
              setNpcHitsMap((prev) => ({ ...prev, [npcId]: nextHits }));
              setFlashMap((prev) => ({ ...prev, [npcId]: true }));
              setTimeout(() => {
                setFlashMap((prev) => ({ ...prev, [npcId]: false }));
              }, 120);
            }
            break;
          }
        }
      }
    });

    // Enemy Bullet loop
    enemyBulletPoolRef.current.forEach((bullet, idx) => {
      if (!bullet.active) return;

      bullet.position.addScaledVector(bullet.direction, 35 * delta); // slightly slower than player bullets

      const mesh = enemyBulletMeshesRef.current[idx];
      if (mesh) {
        mesh.position.copy(bullet.position);
      }

      const pos = bullet.position;
      if (
        pos.x > BOUNDARY + 15 ||
        pos.x < -BOUNDARY - 15 ||
        pos.z > BOUNDARY + 15 ||
        pos.z < -BOUNDARY - 15
      ) {
        bullet.active = false;
        if (mesh) mesh.visible = false;
        return;
      }

      // Check collision with player
      if (
        useGameStore.getState().status === "playing" &&
        pos.distanceTo(playerPos.current) < 1.1
      ) {
        bullet.active = false;
        if (mesh) mesh.visible = false;

        triggerHitParticles(playerPos.current, bullet.direction, "blood");
        playHitSound();

        const currentHealth = useGameStore.getState().health;
        const newHealth = currentHealth - 5;
        useGameStore.getState().setHealth(Math.max(0, newHealth));

        if (newHealth <= 0) {
          useGameStore.getState().setStatus("lost");
        }
      }
    });

    // Animate High-performance Debris Particles
    particlePoolRef.current.forEach((p, idx) => {
      if (!p.active) return;

      // Decay particle life
      p.life -= delta * 2.4; // Exits in ~0.45 seconds
      if (p.life <= 0) {
        p.active = false;
        const mesh = particleMeshesRef.current[idx];
        if (mesh) mesh.visible = false;
        return;
      }

      // Gravitational acceleration fall
      p.velocity.y -= 12.0 * delta;

      // Air resistance
      p.velocity.x *= 1.0 - delta * 1.5;
      p.velocity.z *= 1.0 - delta * 1.5;

      p.position.addScaledVector(p.velocity, delta);
      p.rotation.x += p.velocity.x * delta;
      p.rotation.y += p.velocity.y * delta;
      p.rotation.z += p.velocity.z * delta;

      // Ground collision
      if (p.position.y < 0.05) {
        p.position.y = 0.05;
        p.velocity.y *= -0.3; // bounce
        p.velocity.x *= 0.5; // friction
        p.velocity.z *= 0.5;
        p.rotation.x = 0;
        p.rotation.z = 0;
      }

      const mesh = particleMeshesRef.current[idx];
      if (mesh) {
        mesh.position.copy(p.position);
        mesh.rotation.set(p.rotation.x, p.rotation.y, p.rotation.z);
        mesh.scale.setScalar(p.life * p.size); // Shrinks as it approaches expiry
      }
    });

    // Update NPCs walking vectors
    npcs.forEach((npc, index) => {
      const npcGrp = npcRefs.current[index];
      if (!npcGrp) return;

      const isNpcAlreadyConverted = npc.converted || convertedMap[npc.id];

      if (isNpcAlreadyConverted) {
        // Converted NPC behavior: follow player organically
        const dist = npc.position.distanceTo(playerPos.current);
        if (dist > 3) {
          const dir = playerPos.current.clone().sub(npc.position).normalize();
          npc.position.add(dir.multiplyScalar(SPEED * 0.8 * delta));
          npcGrp.rotation.y = Math.atan2(dir.x, dir.z);
        } else if (dist < 2) {
          const dir = npc.position.clone().sub(playerPos.current).normalize();
          npc.position.add(dir.multiplyScalar(SPEED * 0.5 * delta));
        }
        resolveBuildingCollisions(npc.position, 0.4);
      } else {
        // Unconverted NPC behavior: wander or attack!
        const distToPlayer = npc.position.distanceTo(playerPos.current);
        const canSeePlayer = distToPlayer < 18;

        npc.timer -= delta;

        if (canSeePlayer && useGameStore.getState().status === "playing") {
          // Chase and attack
          const dir = playerPos.current.clone().sub(npc.position).normalize();

          if (distToPlayer > 8) {
            // Move closer
            npc.position.add(dir.multiplyScalar(SPEED * 0.6 * delta));
          }
          npcGrp.rotation.y = Math.atan2(dir.x, dir.z);

          // Shoot logic
          if (time - npc.lastShootTime > 3.0) {
            // 3.0s cooldown
            npc.lastShootTime = time;
            npc.isShooting = true;
            playShootSound();

            // Fire towards player
            const fireDir = dir.clone(); // use pure direction, maybe slight inaccuracy?
            fireDir.x += (Math.random() - 0.5) * 0.5;
            fireDir.z += (Math.random() - 0.5) * 0.5;
            fireDir.normalize();

            const firePos = npc.position
              .clone()
              .add(new Vector3(0, 0.9, 0))
              .addScaledVector(fireDir, 0.65);

            const idx = nextEnemyBulletIdxRef.current;
            const bulletToActivate = enemyBulletPoolRef.current[idx];

            bulletToActivate.position.copy(firePos);
            bulletToActivate.direction.copy(fireDir);
            bulletToActivate.active = true;

            const mesh = enemyBulletMeshesRef.current[idx];
            if (mesh) {
              mesh.position.copy(firePos);
              mesh.rotation.y = npcGrp.rotation.y;
              mesh.visible = true;
            }

            nextEnemyBulletIdxRef.current = (idx + 1) % MAX_ENEMY_BULLETS;

            // stop recoil animation slightly after
            setTimeout(() => {
              if (npcRefs.current[index]) npc.isShooting = false;
            }, 100);
          }
        } else {
          // Wander freely
          if (npc.timer <= 0) {
            npc.timer = 2 + Math.random() * 3;
            npc.velocity
              .set(Math.random() - 0.5, 0, Math.random() - 0.5)
              .normalize()
              .multiplyScalar(2 + Math.random() * 2);
          }

          npc.position.add(npc.velocity.clone().multiplyScalar(delta));
          npcGrp.rotation.y = Math.atan2(npc.velocity.x, npc.velocity.z);
        }

        // Boundaries bounce
        if (npc.position.x > BOUNDARY || npc.position.x < -BOUNDARY)
          npc.velocity.x *= -1;
        if (npc.position.z > BOUNDARY || npc.position.z < -BOUNDARY)
          npc.velocity.z *= -1;

        npc.position.x = MathUtils.clamp(npc.position.x, -BOUNDARY, BOUNDARY);
        npc.position.z = MathUtils.clamp(npc.position.z, -BOUNDARY, BOUNDARY);

        resolveBuildingCollisions(npc.position, 0.4);
      }

      npcGrp.position.copy(npc.position);
    });

    // --- Draw Minimap ---
    const minimapCtx = useGameStore.getState().minimapCtx;
    if (minimapCtx) {
      const cw = minimapCtx.canvas.width;
      const ch = minimapCtx.canvas.height;
      minimapCtx.clearRect(0, 0, cw, ch);

      const scale = cw / (BOUNDARY * 2);
      const cx = cw / 2;
      const cy = ch / 2;

      // Draw bounds
      minimapCtx.lineWidth = 1;
      minimapCtx.strokeStyle = "rgba(255,255,255,0.2)";
      minimapCtx.strokeRect(0, 0, cw, ch);

      // Draw buildings
      minimapCtx.fillStyle = "rgba(255, 255, 255, 0.15)";
      for (const b of BUILDINGS) {
        const bx = cx + b.x * scale;
        const by = cy + b.z * scale;
        const bw = b.w * scale;
        const bd = b.d * scale;
        minimapCtx.fillRect(bx - bw / 2, by - bd / 2, bw, bd);
      }

      // Draw Player
      const px = cx + playerPos.current.x * scale;
      const py = cy + playerPos.current.z * scale;

      // Draw Aim Vector
      const playerRot = playerRef.current?.rotation.y || 0;
      const fwdX = Math.sin(playerRot);
      const fwdZ = Math.cos(playerRot);

      minimapCtx.beginPath();
      minimapCtx.moveTo(px, py);
      minimapCtx.lineTo(px + fwdX * 12 * scale, py + fwdZ * 12 * scale);
      minimapCtx.strokeStyle = "rgba(0, 255, 100, 0.4)";
      minimapCtx.lineWidth = 2;
      minimapCtx.stroke();

      minimapCtx.beginPath();
      minimapCtx.arc(px, py, 3, 0, 2 * Math.PI);
      minimapCtx.fillStyle = "#00ff88";
      minimapCtx.fill();

      // Draw NPCs
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        const nx = cx + npc.position.x * scale;
        const ny = cy + npc.position.z * scale;

        minimapCtx.beginPath();
        minimapCtx.arc(nx, ny, 2, 0, 2 * Math.PI);
        minimapCtx.fillStyle =
          npc.converted || convertedMap[npc.id] ? "#ffffff" : "#ff3333";
        minimapCtx.fill();
      }
    }
  });

  return (
    <>
      <City />

      {/* High-Performance Tracer Render Group Pool (Laser capsule trail boxes!) */}
      <group>
        {Array.from({ length: MAX_ACTIVE_BULLETS }).map((_, i) => (
          <mesh
            key={i}
            ref={(el) => (bulletMeshesPoolRef.current[i] = el as Mesh)}
            visible={false}
          >
            {/* Elegant elongated tracer lines pointing along Z-plane */}
            <boxGeometry args={[0.035, 0.035, 1.3]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>

      {/* Enemy Bullets */}
      <group>
        {Array.from({ length: MAX_ENEMY_BULLETS }).map((_, i) => (
          <mesh
            key={`enemy-bullet-${i}`}
            ref={(el) => (enemyBulletMeshesRef.current[i] = el as Mesh)}
            visible={false}
          >
            <boxGeometry args={[0.04, 0.04, 1.0]} />
            <meshBasicMaterial color="#ff3333" />
          </mesh>
        ))}
      </group>

      {/* Satisfying low-poly exploding splinter square blocks pool */}
      <group>
        {Array.from({ length: MAX_PARTICLES }).map((_, i) => (
          <mesh
            key={`particle-${i}`}
            ref={(el) => (particleMeshesRef.current[i] = el as Mesh)}
            visible={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#111111" />
          </mesh>
        ))}
      </group>

      {/* Player (The Suit equipped with Colt with focus rings) */}
      <group ref={playerRef}>
        <Humanoid
          color="#000000"
          isMoving={playerMoving}
          isShooting={isShooting}
          hasGun={true}
        />

        {/* Sleek tactical focus vector indicators under prime player's feet to make them extra prominent */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.62, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.45}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.0, 0.12, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </mesh>

        {/* Cinematic firearm muzzle flash spark bursts & point lights! */}
        {muzzleFlash && (
          <group position={[0.26, 0.85, 0.65]}>
            {/* Yellow flare sphere */}
            <mesh>
              <sphereGeometry args={[0.24, 6, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Stretched spike boxes */}
            <mesh>
              <boxGeometry args={[0.05, 0.5, 0.05]} />
              <meshBasicMaterial color="#ffaa33" />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <boxGeometry args={[0.05, 0.5, 0.05]} />
              <meshBasicMaterial color="#ffaa33" />
            </mesh>
            {/* Transient high power spotlight overlay flare */}
            <pointLight intensity={10} distance={6} color="#ff9c33" />
          </group>
        )}
      </group>

      {/* NPCs */}
      {npcs.map((npc, i) => {
        const isConverted = convertedMap[npc.id];
        const hits = npcHitsMap[npc.id] || 0;
        const isFlashing = flashMap[npc.id];

        let suitColor = isConverted ? "#000000" : "#cccccc";
        if (isFlashing) {
          suitColor = "#ff3333";
        }

        // Aligning health segments perfectly
        const healthPct = (4 - hits) / 4;
        const barWidth = healthPct * 0.5;
        const posX = barWidth / 2 - 0.25;

        return (
          <group key={npc.id} ref={(el) => (npcRefs.current[i] = el as Group)}>
            <Humanoid
              color={suitColor}
              isMoving={true}
              isShooting={npc.isShooting || false}
              hasGun={true} // Now everyone carries a gun!
            />

            {/* Dynamic segmented health indicator overlay */}
            {!isConverted && hits > 0 && (
              <group position={[0, 1.8, 0]}>
                {/* Dark Base */}
                <mesh>
                  <boxGeometry args={[0.5, 0.045, 0.02]} />
                  <meshBasicMaterial
                    color="#222222"
                    transparent
                    opacity={0.7}
                  />
                </mesh>
                {/* Remaining Lives red chunk */}
                <mesh position={[posX, 0, 0.012]}>
                  <boxGeometry args={[barWidth, 0.048, 0.025]} />
                  <meshBasicMaterial color="#ff2222" />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}
