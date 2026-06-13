import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import {
  Vector3,
  MathUtils,
  Group,
  MeshBasicMaterial,
  Mesh,
  Color,
} from "three";
import { useGameStore, WEAPONS, WeaponType } from "../store";
import { pickUpgrades } from "../upgrades";
import { Humanoid } from "./Humanoid";
import { City } from "./City";
import { resolveBuildingCollisions, BUILDINGS } from "../utils/buildings";

const BOUNDARY = 45;
const SPEED = 8;
const MAX_ACTIVE_BULLETS = 70;
const MAX_PARTICLES = 250;

// Reusable vectors for high-performance useFrame loop (avoids GC pauses)
const _cameraOffset = new Vector3(21, 29, 21);
const _forward = new Vector3();
const _right = new Vector3();
const _moveDir = new Vector3();
const _fireDir = new Vector3();
const _rightVec = new Vector3();
const _chestOffset = new Vector3(0, 0.9, 0);
const _firePosRight = new Vector3();
const _firePosLeft = new Vector3();
const _npcDir = new Vector3();
const _npcFireDir = new Vector3();
const _npcFirePos = new Vector3();
const _cameraTarget = new Vector3();
const _tmpVec = new Vector3();

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
  if (useGameStore.getState().muted) return;
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
  if (useGameStore.getState().muted) return;
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
  if (useGameStore.getState().muted) return;
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

function FloatingText({
  text,
  color,
  position,
  onComplete,
}: {
  text: string;
  color: string;
  position: [number, number, number];
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (groupRef.current) {
      groupRef.current.position.y += delta * 2.0;
      const progress = timeRef.current / 1.0;
      groupRef.current.scale.setScalar(Math.max(0, 1 - progress));
    }
    if (timeRef.current > 1.0) {
      onComplete();
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <Text
        fontSize={0.6}
        color={color}
        outlineWidth={0.04}
        outlineColor="#000000"
        fontWeight="bold"
      >
        {text}
      </Text>
    </group>
  );
}

export function GameScene() {
  const { camera } = useThree();
  const { joystickVector, isShooting, score, totalNPCs, setScore, setStatus } =
    useGameStore();

  const playerRef = useRef<Group>(null);
  const playerPos = useRef(new Vector3(0, 0, 0));
  const [playerMoving, setPlayerMoving] = useState(false);
  const [playerRunning, setPlayerRunning] = useState(false);
  const [muzzleFlash, setMuzzleFlash] = useState(false);

  // Conversions, hit counts and flashing damage states
  const [convertedMap, setConvertedMap] = useState<Record<number, boolean>>({});
  const [deadMap, setDeadMap] = useState<Record<number, boolean>>({});
  const [npcHitsMap, setNpcHitsMap] = useState<Record<number, number>>({});
  const [flashMap, setFlashMap] = useState<Record<number, boolean>>({});

  type FloatingMsg = { id: number; text: string; color: string; position: [number, number, number] };
  const [floatingMsgs, setFloatingMsgs] = useState<FloatingMsg[]>([]);
  const nextMsgIdRef = useRef(0);
  const showMsg = (pos: Vector3, text: string, color: string) => {
    const id = nextMsgIdRef.current++;
    setFloatingMsgs(prev => [...prev, { id, text, color, position: [pos.x, pos.y + 1.5, pos.z] }]);
  };

  const cameraShakeRef = useRef(0);

  type Pickup = { id: number; position: Vector3; active: boolean; type: "health" | "recruit" | "weapon_tommy" | "weapon_shotgun"; targetNpcId?: number };
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const nextPickupIdRef = useRef(0);
  const pickupsRef = useRef<Pickup[]>([]); // Mirrors state for useFrame access

  useEffect(() => {
    pickupsRef.current = pickups;
  }, [pickups]);

  type NPCType = "normal" | "rusher" | "boss";

  interface NPCData {
    id: number;
    position: Vector3;
    velocity: Vector3;
    converted: boolean;
    dead: boolean;
    timer: number;
    lastShootTime: number;
    isShooting: boolean;
    isMoving: boolean;
    hp: number;
    maxHp: number;
    type: NPCType;
    scale: number;
    weaponType: WeaponType;
  }

  const [npcs, setNpcs] = useState<NPCData[]>([]);
  const nextNpcIdRef = useRef(0);

  const { wave, setWave, setTotalNPCs } = useGameStore();
  const status = useGameStore((s) => s.status);
  const [intermission, setIntermission] = useState(false);
  // Sequences the wave-clear flow: banner -> upgrade pick -> next wave spawn
  const intermissionPhaseRef = useRef<"idle" | "banner" | "upgrade">("idle");

  const spawnWave = (currentWave: number) => {
    const spawnCount = 10 + currentWave * 5;
    setTotalNPCs(spawnCount);

    const newNpcs: NPCData[] = [];
    for (let i = 0; i < spawnCount; i++) {
      const id = nextNpcIdRef.current++;

      let type: NPCType = "normal";
      let hp = 4;
      let scale = 1;
      let speedMult = 1;

      // Randomly assign types based on wave progress
      const rand = Math.random();
      if (currentWave >= 3 && rand < 0.1) {
        type = "boss";
        hp = 20;
        scale = 1.6;
        speedMult = 0.6; // Bosses are slow
      } else if (currentWave >= 2 && rand < 0.35) {
        type = "rusher";
        hp = 2; // Dies faster
        scale = 0.9; // Slightly smaller
        speedMult = 1.9; // Rushers are fast
      }

      let wType: WeaponType = "pistol";
      const wRand = Math.random();
      if (type === "boss") {
         wType = wRand < 0.5 ? "tommy" : "shotgun";
      } else if (type === "normal") {
         if (wRand < 0.15) wType = "tommy";
         else if (wRand < 0.3) wType = "shotgun";
      }

      // Spawn away from the player so enemies never pop in on top of them
      let sx = 0;
      let sz = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        sx = (Math.random() - 0.5) * 80;
        sz = (Math.random() - 0.5) * 80;
        const dx = sx - playerPos.current.x;
        const dz = sz - playerPos.current.z;
        if (dx * dx + dz * dz > 18 * 18) break;
      }

      newNpcs.push({
        id,
        position: new Vector3(sx, 0, sz),
        velocity: new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
          .normalize()
          .multiplyScalar((2 + Math.random() * 2) * speedMult),
        converted: false,
        dead: false,
        timer: Math.random() * 5,
        lastShootTime: Math.random() * 2,
        isShooting: false,
        isMoving: false,
        hp: hp,
        maxHp: hp,
        type: type,
        scale: scale,
        weaponType: wType,
      });
    }

    setNpcs((prev) => [...prev, ...newNpcs]);
  };

  useEffect(() => {
    if (status !== "playing" || intermission) return;

    // Determine how many enemies are still alive and unconverted
    const aliveEnemies = npcs.filter(
      (n) => !deadMap[n.id] && !convertedMap[n.id],
    ).length;

    if (npcs.length === 0) {
      // Initial wave starts immediately
      useGameStore.getState().setBanner("WAVE 1");
      setTimeout(() => {
        if (useGameStore.getState().banner === "WAVE 1")
          useGameStore.getState().setBanner(null);
      }, 1800);
      spawnWave(1);
    } else if (aliveEnemies === 0) {
      // Wave cleared: short banner, then the player picks 1 of 3 upgrades
      setIntermission(true);
      intermissionPhaseRef.current = "banner";
      useGameStore.getState().setBanner("WAVE CLEARED");
      setTimeout(() => {
        const s = useGameStore.getState();
        if (s.status !== "playing" && s.status !== "paused") return;
        s.setBanner(null);
        intermissionPhaseRef.current = "upgrade";
        s.setUpgradeChoices(pickUpgrades(3));
        s.setStatus("upgrading");
      }, 1400);
    }
  }, [npcs, convertedMap, deadMap, wave, status, intermission, setWave, setTotalNPCs]);

  // Resume after the player picked an upgrade: announce and spawn the next wave
  useEffect(() => {
    if (
      intermission &&
      status === "playing" &&
      intermissionPhaseRef.current === "upgrade" &&
      !useGameStore.getState().upgradeChoices
    ) {
      intermissionPhaseRef.current = "idle";
      const nextWave = wave + 1;
      setWave(nextWave);
      const label = `WAVE ${nextWave}`;
      useGameStore.getState().setBanner(label);
      setTimeout(() => {
        if (useGameStore.getState().banner === label)
          useGameStore.getState().setBanner(null);
      }, 1800);
      spawnWave(nextWave);
      setIntermission(false);
    }
  }, [status, intermission, wave, setWave]);

  // High-performance bullet pool
  const bulletMeshesPoolRef = useRef<(Mesh | null)[]>([]);
  const bulletPoolRef = useRef<
    {
      position: Vector3;
      direction: Vector3;
      active: boolean;
      damage: number;
    }[]
  >(
    Array.from({ length: MAX_ACTIVE_BULLETS }, () => ({
      position: new Vector3(),
      direction: new Vector3(),
      active: false,
      damage: 1,
    })),
  );
  const nextBulletIdxRef = useRef(0);
  const lastFireTimeRef = useRef(0);
  const comboRef = useRef(0);
  const lastKillTimeRef = useRef(-10);
  const dashUntilRef = useRef(-1);
  const dashReadyRef = useRef(0);
  const dashDirRef = useRef(new Vector3(0, 0, 1));
  const pickupGroupRefs = useRef<Record<number, Group | null>>({});

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
      _tmpVec.set(0, 0.5 + Math.random() * 0.8, 0);
      p.position.copy(targetPos).add(_tmpVec);

      // Blow back in bullet trajectory + vertical burst + dispersion spray
      _tmpVec.copy(shooterDir).normalize();
      if (type === "convert") {
        // Spherical burst for conversion
        _tmpVec
          .set(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
          )
          .normalize();
      } else {
        _tmpVec.x += (Math.random() - 0.5) * 1.5;
        _tmpVec.y += Math.random() * 1.2 + 0.2;
        _tmpVec.z += (Math.random() - 0.5) * 1.5;
        _tmpVec.normalize();
      }

      const speed =
        type === "convert"
          ? 6.0 + Math.random() * 8.0
          : 4.5 + Math.random() * 5.0;
      p.velocity.copy(_tmpVec).multiplyScalar(speed);

      p.active = true;
      p.life = 1.0;
      p.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );

      if (type === "blood") {
        // Clean impact debris: coral spark + pale clay chips (no gore)
        p.color = Math.random() > 0.45 ? "#ff5a4d" : "#cdd6e0";
      } else if (type === "convert") {
        p.color = Math.random() > 0.5 ? "#3d9bff" : "#cfe6ff";
      } else {
        p.color = "#ff5a4d";
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

    // Freeze the entire simulation when not actively playing (menu, pause, game over)
    if (gameStatus !== "playing") {
      camera.position.lerp(
        _cameraTarget.copy(playerPos.current).add(_cameraOffset),
        0.1,
      );
      camera.lookAt(playerPos.current);
      return;
    }

    let isMoving = false;
    let isRunning = false;

    if (gameStatus === "playing") {
      const joystickIntensity = Math.min(1, Math.hypot(jx, jy));
      if (joystickIntensity > 0.01) {
        isMoving = true;
        isRunning = joystickIntensity > 0.8;

        _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        _right.y = 0;
        _right.normalize();
        _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
        _forward.y = 0;
        _forward.normalize();

        _moveDir
          .copy(_forward)
          .multiplyScalar(-jy)
          .add(_right.multiplyScalar(jx))
          .normalize();

        // Increase speed if running; scaled by upgrade stats
        const currentSpeed =
          (isRunning ? SPEED * 1.6 : SPEED * joystickIntensity * 0.8) *
          useGameStore.getState().stats.speedMult;

        // Update position
        playerPos.current.add(
          _cameraTarget.copy(_moveDir).multiplyScalar(currentSpeed * delta),
        );

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
            _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
            _right.y = 0;
            _right.normalize();
            _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
            _forward.y = 0;
            _forward.normalize();
            _fireDir
              .copy(_forward)
              .multiplyScalar(-shootVector.y)
              .add(_right.multiplyScalar(shootVector.x))
              .normalize();
            playerRef.current.rotation.y = Math.atan2(_fireDir.x, _fireDir.z);
          } else {
            const targetRot = Math.atan2(_moveDir.x, _moveDir.z);
            playerRef.current.rotation.y = targetRot;
          }
        }
      } else {
        if (playerRef.current) {
          playerRef.current.position.copy(playerPos.current);
          // Even when not moving, we might be aiming!
          const { shootVector } = useGameStore.getState();
          if (shootVector.x !== 0 || shootVector.y !== 0) {
            _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
            _right.y = 0;
            _right.normalize();
            _forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
            _forward.y = 0;
            _forward.normalize();
            _fireDir
              .copy(_forward)
              .multiplyScalar(-shootVector.y)
              .add(_right.multiplyScalar(shootVector.x))
              .normalize();
            playerRef.current.rotation.y = Math.atan2(_fireDir.x, _fireDir.z);
          }
        }
      }
    }

    // Dash: short burst toward movement (or facing) direction, with i-frames
    const tNow = state.clock.getElapsedTime();
    {
      const gs = useGameStore.getState();
      if (gs.dashRequested) {
        gs.setDashRequested(false);
        if (tNow >= dashReadyRef.current) {
          dashUntilRef.current = tNow + 0.18;
          dashReadyRef.current = tNow + gs.stats.dashCooldown;
          gs.setDashReadyAt(Date.now() + gs.stats.dashCooldown * 1000);
          if (isMoving) {
            dashDirRef.current.copy(_moveDir);
          } else {
            const rot = playerRef.current?.rotation.y || 0;
            dashDirRef.current.set(Math.sin(rot), 0, Math.cos(rot));
          }
          cameraShakeRef.current = Math.max(cameraShakeRef.current, 0.15);
        }
      }
      if (tNow < dashUntilRef.current) {
        playerPos.current.addScaledVector(
          dashDirRef.current,
          SPEED * 3.2 * delta,
        );
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
        resolveBuildingCollisions(playerPos.current, 0.4);
        if (playerRef.current)
          playerRef.current.position.copy(playerPos.current);
        gs.setPlayerPosition([
          playerPos.current.x,
          playerPos.current.y,
          playerPos.current.z,
        ]);
        isMoving = true;
        isRunning = true;
      }
    }

    // Pickup magnet + collection (works even while standing still)
    {
      const magnetR = useGameStore.getState().stats.magnetRadius;
      pickupsRef.current.forEach((p) => {
        if (!p.active) return;

        const dSq = playerPos.current.distanceToSquared(p.position);
        if (dSq < magnetR * magnetR && dSq > 0.04) {
          _tmpVec.copy(playerPos.current).sub(p.position).normalize();
          p.position.addScaledVector(_tmpVec, 9 * delta);
          const grp = pickupGroupRefs.current[p.id];
          if (grp) grp.position.set(p.position.x, 0.5, p.position.z);
        }

        if (dSq < 2.0 * 2.0) {
          p.active = false;

          if (p.type === "health") {
            const state = useGameStore.getState();
            state.setHealth(Math.min(state.maxHealth, state.health + 30));
            showMsg(p.position, "+30 HP", "#ffffff");
          } else if (p.type === "weapon_tommy") {
            const state = useGameStore.getState();
            state.setWeapon("tommy");
            state.setAmmo(WEAPONS.tommy.ammoCapacity);
            state.setReserveAmmo(WEAPONS.tommy.reserve);
            state.setReloading(false);
            showMsg(p.position, "TOMMY GUN", "#ff8a5e");
          } else if (p.type === "weapon_shotgun") {
            const state = useGameStore.getState();
            state.setWeapon("shotgun");
            state.setAmmo(WEAPONS.shotgun.ammoCapacity);
            state.setReserveAmmo(WEAPONS.shotgun.reserve);
            state.setReloading(false);
            showMsg(p.position, "SHOTGUN", "#ff5a4d");
          } else if (p.type === "recruit" && p.targetNpcId !== undefined) {
            const targetNpc = npcs.find((n) => n.id === p.targetNpcId);
            if (targetNpc) {
              targetNpc.dead = false;
              targetNpc.converted = true;
              targetNpc.hp = targetNpc.maxHp;
              setDeadMap((prev) => ({ ...prev, [targetNpc.id]: false }));
              setConvertedMap((prev) => ({ ...prev, [targetNpc.id]: true }));
              setNpcHitsMap((prev) => {
                const copy = { ...prev };
                delete copy[targetNpc.id];
                return copy;
              });
              playConvertSound();
              triggerHitParticles(
                targetNpc.position,
                new Vector3(0, 1, 0),
                "convert",
              );
              showMsg(targetNpc.position, "+1 RECRUIT", "#3d9bff");

              const currentScore = useGameStore.getState().score;
              setScore(currentScore + 1);
            }
          }

          setPickups((prev) =>
            prev.map((old) =>
              old.id === p.id ? { ...old, active: false } : old,
            ),
          );
        }
      });
    }

    if (playerMoving !== isMoving) setPlayerMoving(isMoving);
    if (playerRunning !== isRunning) setPlayerRunning(isRunning);

    // Camera follow (isometric offset)
    camera.position.lerp(
      _cameraTarget.copy(playerPos.current).add(_cameraOffset),
      0.1,
    );
    camera.lookAt(playerPos.current);

    if (cameraShakeRef.current > 0) {
      camera.position.x += (Math.random() - 0.5) * cameraShakeRef.current;
      camera.position.y += (Math.random() - 0.5) * cameraShakeRef.current;
      camera.position.z += (Math.random() - 0.5) * cameraShakeRef.current;
      cameraShakeRef.current -= delta * 5.0;
      if (cameraShakeRef.current < 0) cameraShakeRef.current = 0;
    }

    // Rate-limited weapon shooting
    const time = state.clock.getElapsedTime();
    const gState = useGameStore.getState();
    const currentWeaponStats = WEAPONS[gState.weapon];

    const startReload = () => {
      gState.setReloading(true);
      showMsg(playerPos.current, "RELOADING...", "#86c4ff");
      setTimeout(() => {
        const s = useGameStore.getState();
        const cap = WEAPONS[s.weapon].ammoCapacity;
        const take = Math.min(cap - s.ammo, s.reserveAmmo);
        s.setAmmo(s.ammo + take);
        if (Number.isFinite(s.reserveAmmo)) {
          s.setReserveAmmo(s.reserveAmmo - take);
        }
        s.setReloading(false);
      }, (currentWeaponStats.reloadTime * 1000) / gState.stats.reloadMult);
    };

    // Manual reload request (R key / reload button)
    if (gState.reloadRequested) {
      gState.setReloadRequested(false);
      if (
        !gState.isReloading &&
        gState.ammo < currentWeaponStats.ammoCapacity &&
        gState.reserveAmmo > 0
      ) {
        startReload();
      }
    }

    // Check automatic reloading; special weapons fall back to the pistol when dry
    if (gState.ammo <= 0 && !gState.isReloading) {
      if (gState.weapon !== "pistol" && gState.reserveAmmo <= 0) {
        gState.setWeapon("pistol");
        gState.setAmmo(WEAPONS.pistol.ammoCapacity);
        gState.setReserveAmmo(Infinity);
        showMsg(playerPos.current, "OUT OF AMMO", "#ff5a4d");
      } else {
        startReload();
      }
    }

    if (
      gameStatus === "playing" &&
      isShooting &&
      !gState.isReloading &&
      gState.ammo > 0 &&
      time - lastFireTimeRef.current >
        currentWeaponStats.fireDelay / gState.stats.fireRateMult
    ) {
      lastFireTimeRef.current = time;
      
      const ammoToConsume = 1;
      gState.setAmmo(gState.ammo - ammoToConsume);

      if (gState.weapon === 'shotgun') {
        cameraShakeRef.current = 0.5; // Huge recoil
      } else if (gState.weapon === 'tommy') {
        cameraShakeRef.current = 0.12; // Small rapid recoil
      } else {
        cameraShakeRef.current = 0.2; // Standard recoil shake
      }
      playShootSound();

      // Fire gun facing direction
      const playerRot = playerRef.current?.rotation.y || 0;
      _fireDir.set(Math.sin(playerRot), 0, Math.cos(playerRot)).normalize();

      _rightVec.set(_fireDir.z, 0, -_fireDir.x);

      let rightOffset = 0.28;
      if (gState.weapon !== 'pistol') {
        rightOffset = 0.12; // Hold closer to center for rifles
      }

      // Right gun offset
      _firePosRight
        .copy(playerPos.current)
        .addScaledVector(_tmpVec.set(0, 1.35, 0), 1) // shoulder height
        .addScaledVector(_rightVec, rightOffset) // pushed to right shoulder 
        .addScaledVector(_fireDir, gState.weapon === 'shotgun' ? 1.05 : 0.89); // pushed forward

      // Left gun offset
      _firePosLeft
        .copy(playerPos.current)
        .addScaledVector(_tmpVec.set(0, 1.35, 0), 1) // shoulder height
        .addScaledVector(_rightVec, -0.28) // pushed to left shoulder
        .addScaledVector(_fireDir, 0.89); // pushed forward

      const playerBulletDamage =
        currentWeaponStats.damage * gState.stats.damageMult;
      const emitBullet = (pos: Vector3, dir: Vector3) => {
        const idx = nextBulletIdxRef.current;
        const bulletToActivate = bulletPoolRef.current[idx];
        bulletToActivate.position.copy(pos);
        bulletToActivate.direction.copy(dir);
        bulletToActivate.active = true;
        bulletToActivate.damage = playerBulletDamage;

        const mesh = bulletMeshesPoolRef.current[idx];
        if (mesh) {
          mesh.position.copy(pos);
          mesh.rotation.y = Math.atan2(dir.x, dir.z);
          mesh.visible = true;
        }

        nextBulletIdxRef.current = (idx + 1) % MAX_ACTIVE_BULLETS;
      };

      if (gState.weapon === 'pistol') {
        emitBullet(_firePosRight, _fireDir);
        emitBullet(_firePosLeft, _fireDir);
      } else if (gState.weapon === 'tommy') {
        const spreadDir = _fireDir.clone();
        spreadDir.x += (Math.random() - 0.5) * currentWeaponStats.spread;
        spreadDir.z += (Math.random() - 0.5) * currentWeaponStats.spread;
        spreadDir.normalize();
        emitBullet(_firePosRight, spreadDir);
      } else if (gState.weapon === 'shotgun') {
        for(let i=0; i<currentWeaponStats.bulletsPerShot; i++) {
          const spreadDir = _fireDir.clone();
          spreadDir.x += (Math.random() - 0.5) * currentWeaponStats.spread;
          spreadDir.z += (Math.random() - 0.5) * currentWeaponStats.spread;
          spreadDir.normalize();
          emitBullet(_firePosRight, spreadDir);
        }
      }

      // Play brief high-intensity muzzle flash blast animation
      setMuzzleFlash(true);
      setTimeout(() => {
        setMuzzleFlash(false);
      }, 55);
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
        if (npc.dead) continue;

        const npcId = npc.id;
        const isNpcAlreadyConverted = npc.converted || convertedMap[npcId];

        if (!isNpcAlreadyConverted) {
          // Use 2D distance since bullets are spawned at shoulder height
          const distSq =
            (pos.x - npc.position.x) ** 2 + (pos.z - npc.position.z) ** 2;

          // Standard satisfying collision radius (1.1 fits hitbox bounds)
          if (distSq < 1.1 * 1.1) {
            bullet.active = false;
            if (mesh) mesh.visible = false;

            // Crit roll: doubled damage with a callout
            let dmg = bullet.damage || 1;
            if (Math.random() < useGameStore.getState().stats.critChance) {
              dmg *= 2;
              showMsg(npc.position, "CRIT!", "#ff8a5e");
            }

            const prevHits = npcHitsMap[npcId] || 0;
            const nextHits = prevHits + dmg;

            if (nextHits >= npc.maxHp) {
              npc.dead = true;
              setDeadMap((prev) => ({ ...prev, [npcId]: true }));
              triggerHitParticles(npc.position, bullet.direction, "blood");

              // Kill combo: chained takedowns reward floating combo callouts
              if (time - lastKillTimeRef.current < 2.5) {
                comboRef.current += 1;
              } else {
                comboRef.current = 1;
              }
              lastKillTimeRef.current = time;
              useGameStore.getState().addKill();
              if (comboRef.current >= 2) {
                showMsg(npc.position, `COMBO x${comboRef.current}`, "#ff8a5e");
              }

              // Blood Contract: heal on kill
              const ls = useGameStore.getState().stats.lifeSteal;
              if (ls > 0) {
                const st = useGameStore.getState();
                st.setHealth(Math.min(st.maxHealth, st.health + ls));
              }

              // Always drop recruit pickup when originally killed
              const pId1 = nextPickupIdRef.current++;
              setPickups(prev => [...prev, { id: pId1, position: npc.position.clone(), active: true, type: "recruit", targetNpcId: npc.id }]);

              // Chance to drop health
              if (Math.random() < 0.25) {
                const pId2 = nextPickupIdRef.current++;
                const healthPos = npc.position.clone();
                healthPos.x += (Math.random() - 0.5) * 1.5;
                healthPos.z += (Math.random() - 0.5) * 1.5;
                setPickups(prev => [...prev, { id: pId2, position: healthPos, active: true, type: "health" }]);
              }

              // Weapon drops
              if (npc.weaponType !== 'pistol' && Math.random() < 0.75) {
                const wId = nextPickupIdRef.current++;
                const wPos = npc.position.clone();
                wPos.x += (Math.random() - 0.5) * 1.5;
                wPos.z += (Math.random() - 0.5) * 1.5;
                setPickups(prev => [...prev, { id: wId, position: wPos, active: true, type: `weapon_${npc.weaponType}` as any }]);
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
      const distSqToPlayer =
        (pos.x - playerPos.current.x) ** 2 + (pos.z - playerPos.current.z) ** 2;
      if (
        useGameStore.getState().status === "playing" &&
        time >= dashUntilRef.current && // dashing grants i-frames
        distSqToPlayer < 1.1 * 1.1
      ) {
        bullet.active = false;
        if (mesh) mesh.visible = false;

        triggerHitParticles(playerPos.current, bullet.direction, "blood");
        playHitSound();
        cameraShakeRef.current = 0.5;
        useGameStore.getState().bumpDamageFlash();
        showMsg(playerPos.current, "-5 HP", "#ff5a4d");

        const currentHealth = useGameStore.getState().health;
        const newHealth = currentHealth - 5;
        useGameStore.getState().setHealth(Math.max(0, newHealth));

        if (newHealth <= 0) {
          useGameStore.getState().setStatus("lost");
        }
      }

      // Check collision with converted NPCs
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (npc.dead) continue;

        const isNpcAlreadyConverted = npc.converted || convertedMap[npc.id];
        if (isNpcAlreadyConverted) {
          const distSqToConverted =
            (pos.x - npc.position.x) ** 2 + (pos.z - npc.position.z) ** 2;
          if (distSqToConverted < 1.1 * 1.1) {
            bullet.active = false;
            if (mesh) mesh.visible = false;

            npc.hp -= 1;
            showMsg(npc.position, "-1", "#ff8a5e");

            if (npc.hp <= 0) {
              npc.dead = true;
              setDeadMap((prev) => ({ ...prev, [npc.id]: true }));
              triggerHitParticles(npc.position, bullet.direction, "blood");
            } else {
              triggerHitParticles(npc.position, bullet.direction, "blood");
              setFlashMap((prev) => ({ ...prev, [npc.id]: true }));
              setTimeout(() => {
                setFlashMap((prev) => ({ ...prev, [npc.id]: false }));
              }, 120);
            }
            playHitSound();
            break;
          }
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

      if (npc.dead) {
        npcGrp.visible = false;
        return;
      } else {
        npcGrp.visible = true;
      }

      const isNpcAlreadyConverted = npc.converted || convertedMap[npc.id];

      if (isNpcAlreadyConverted) {
        // Converted NPC behavior: seek unconverted and convert!
        let closestTargetDistSq = 999999;
        let closestTargetPos: Vector3 | null = null;
        let closestTargetId: number | "player" | null = null;

        for (let i = 0; i < npcs.length; i++) {
          const other = npcs[i];
          if (!other.converted && !convertedMap[other.id] && !other.dead) {
            const dSq = npc.position.distanceToSquared(other.position);
            if (dSq < closestTargetDistSq) {
              closestTargetDistSq = dSq;
              closestTargetPos = other.position;
              closestTargetId = other.id;
            }
          }
        }

        if (closestTargetPos && useGameStore.getState().status === "playing") {
          _npcDir.copy(closestTargetPos).sub(npc.position).normalize();

          const stopDist = npc.type === "rusher" ? 1.5 : 64;
          if (closestTargetDistSq > stopDist) {
            const spd = SPEED * (npc.type === "rusher" ? 1.2 : 0.8);
            npc.position.add(
              _tmpVec.copy(_npcDir).multiplyScalar(spd * delta),
            );
          }
          npcGrp.rotation.y = Math.atan2(_npcDir.x, _npcDir.z);

          // Shoot logic
          if (npc.type !== "rusher") {
            const wStats = WEAPONS[npc.weaponType || 'pistol'];
            let shootInterval = wStats.fireDelay * 3.0; // They shoot slower than player
            if (npc.type === "boss") shootInterval *= 0.5;

            if (time - npc.lastShootTime > shootInterval) {
              npc.lastShootTime = time;
              npc.isShooting = true;
              playShootSound();

              for (let b = 0; b < wStats.bulletsPerShot; b++) {
                _npcFireDir.copy(_npcDir);
                _npcFireDir.x += (Math.random() - 0.5) * wStats.spread * 2;
                _npcFireDir.z += (Math.random() - 0.5) * wStats.spread * 2;
                _npcFireDir.normalize();

                _npcFirePos
                  .copy(npc.position)
                  .addScaledVector(_tmpVec.set(0, 1.35, 0), 1)
                  .addScaledVector(
                    _rightVec.set(_npcFireDir.z, 0, -_npcFireDir.x),
                    0.28,
                  )
                  .addScaledVector(_npcFireDir, 0.89);

                const idx = nextBulletIdxRef.current;
                const bulletToActivate = bulletPoolRef.current[idx];

                bulletToActivate.position.copy(_npcFirePos);
                bulletToActivate.direction.copy(_npcFireDir);
                bulletToActivate.active = true;
                bulletToActivate.damage = wStats.damage;

                const mesh = bulletMeshesPoolRef.current[idx];
                if (mesh) {
                  mesh.position.copy(_npcFirePos);
                  mesh.rotation.y = Math.atan2(_npcFireDir.x, _npcFireDir.z);
                  mesh.visible = true;
                }

                nextBulletIdxRef.current = (idx + 1) % MAX_ACTIVE_BULLETS;
              }

              setTimeout(() => {
                if (npcRefs.current[index]) npc.isShooting = false;
              }, 100);
            }
          } else if (closestTargetDistSq <= stopDist && time - npc.lastShootTime > 1.0) {
            // Melee attack
            npc.lastShootTime = time;
            if (closestTargetId !== null && closestTargetId !== "player") {
              const targetNpc = npcs.find(n => n.id === closestTargetId);
              if (targetNpc) {
                triggerHitParticles(closestTargetPos, _npcDir, "blood");
                setFlashMap((prev) => ({ ...prev, [targetNpc.id]: true }));
                setTimeout(() => {
                  setFlashMap((prev) => ({ ...prev, [targetNpc.id]: false }));
                }, 120);
                
                const prevHits = npcHitsMap[targetNpc.id] || 0;
                const nextHits = prevHits + 1;
                if (nextHits >= targetNpc.maxHp) {
                  targetNpc.dead = true;
                  setDeadMap((prev) => ({ ...prev, [targetNpc.id]: true }));
                  triggerHitParticles(targetNpc.position, _npcDir, "blood");

                  const pId1 = nextPickupIdRef.current++;
                  setPickups(prev => [...prev, { id: pId1, position: targetNpc.position.clone(), active: true, type: "recruit", targetNpcId: targetNpc.id }]);

                  if (Math.random() < 0.25) {
                    const pId2 = nextPickupIdRef.current++;
                    const healthPos = targetNpc.position.clone();
                    healthPos.x += (Math.random() - 0.5) * 1.5;
                    healthPos.z += (Math.random() - 0.5) * 1.5;
                    setPickups(prev => [...prev, { id: pId2, position: healthPos, active: true, type: "health" }]);
                  }

                  // Weapon drops
                  if (targetNpc.weaponType !== 'pistol' && Math.random() < 0.75) {
                    const wId = nextPickupIdRef.current++;
                    const wPos = targetNpc.position.clone();
                    wPos.x += (Math.random() - 0.5) * 1.5;
                    wPos.z += (Math.random() - 0.5) * 1.5;
                    setPickups(prev => [...prev, { id: wId, position: wPos, active: true, type: `weapon_${targetNpc.weaponType}` as any }]);
                  }
                } else {
                  setNpcHitsMap((prev) => ({ ...prev, [targetNpc.id]: nextHits }));
                }
              }
            }
          }
        } else {
          // Wander freely
          npc.timer -= delta;
          if (npc.timer <= 0) {
            npc.timer = 2 + Math.random() * 3;
            npc.velocity
              .set(Math.random() - 0.5, 0, Math.random() - 0.5)
              .normalize()
              .multiplyScalar(2 + Math.random() * 2);
          }
          npc.position.add(_tmpVec.copy(npc.velocity).multiplyScalar(delta));
          npcGrp.rotation.y = Math.atan2(npc.velocity.x, npc.velocity.z);
        }

        resolveBuildingCollisions(npc.position, 0.4);
      } else {
        // Unconverted NPC behavior: attack player or converted NPCs
        let closestTargetDistSq = npc.position.distanceToSquared(
          playerPos.current,
        );
        let closestTargetPos = playerPos.current;
        let closestTargetId: number | "player" = "player";

        for (let i = 0; i < npcs.length; i++) {
          const other = npcs[i];
          if (
            other.id !== npc.id &&
            (other.converted || convertedMap[other.id]) &&
            !other.dead
          ) {
            const dSq = npc.position.distanceToSquared(other.position);
            if (dSq < closestTargetDistSq) {
              closestTargetDistSq = dSq;
              closestTargetPos = other.position;
              closestTargetId = other.id;
            }
          }
        }

        const canSeeTarget = closestTargetDistSq < 22 * 22; // Slightly longer sight
        npc.timer -= delta;

        if (canSeeTarget && useGameStore.getState().status === "playing") {
          _npcDir.copy(closestTargetPos).sub(npc.position).normalize();

          const stopDist = npc.type === "rusher" ? 1.5 : 64;
          if (closestTargetDistSq > stopDist) {
            const spd = SPEED * (npc.type === "rusher" ? 1.3 : 0.6);
            npc.position.add(
              _tmpVec.copy(_npcDir).multiplyScalar(spd * delta),
            );
          }
          npcGrp.rotation.y = Math.atan2(_npcDir.x, _npcDir.z);

          // Shoot logic
          if (npc.type !== "rusher") {
            const wStats = WEAPONS[npc.weaponType || 'pistol'];
            let shootInterval = wStats.fireDelay * 4.0; 
            if (npc.type === "boss") shootInterval *= 0.8;

            if (time - npc.lastShootTime > shootInterval) {
              npc.lastShootTime = time;
              npc.isShooting = true;
              playShootSound();

              for (let b = 0; b < wStats.bulletsPerShot; b++) {
                _npcFireDir.copy(_npcDir);
                _npcFireDir.x += (Math.random() - 0.5) * Math.max(wStats.spread * 2, 0.2);
                _npcFireDir.z += (Math.random() - 0.5) * Math.max(wStats.spread * 2, 0.2);
                _npcFireDir.normalize();

                _npcFirePos
                  .copy(npc.position)
                  .addScaledVector(_tmpVec.set(0, 1.35, 0), 1) // shoulder height
                  .addScaledVector(
                    _rightVec.set(_npcFireDir.z, 0, -_npcFireDir.x),
                    0.28,
                  ) // offset for right arm
                  .addScaledVector(_npcFireDir, 0.89); // bullet origin

                const idx = nextEnemyBulletIdxRef.current;
                const bulletToActivate = enemyBulletPoolRef.current[idx];

                bulletToActivate.position.copy(_npcFirePos);
                bulletToActivate.direction.copy(_npcFireDir);
                bulletToActivate.active = true;

                const mesh = enemyBulletMeshesRef.current[idx];
                if (mesh) {
                  mesh.position.copy(_npcFirePos);
                  mesh.rotation.y = Math.atan2(_npcFireDir.x, _npcFireDir.z);
                  mesh.visible = true;
                }

                nextEnemyBulletIdxRef.current = (idx + 1) % MAX_ENEMY_BULLETS;
              }

              setTimeout(() => {
                if (npcRefs.current[index]) npc.isShooting = false;
              }, 100);
            }
          } else if (closestTargetDistSq <= stopDist && time - npc.lastShootTime > 1.0) {
            // Melee attack players or allies
            npc.lastShootTime = time;
            if (closestTargetId === "player" && time >= dashUntilRef.current) {
              triggerHitParticles(playerPos.current, _npcDir, "blood");
              playHitSound();
              cameraShakeRef.current = 1.0;
              useGameStore.getState().bumpDamageFlash();
              showMsg(playerPos.current, "-20 HP", "#ff5a4d");

              const currentHealth = useGameStore.getState().health;
              const newHealth = currentHealth - 20; // High melee damage
              useGameStore.getState().setHealth(Math.max(0, newHealth));

              if (newHealth <= 0) {
                useGameStore.getState().setStatus("lost");
              }
            } else {
              const targetNpc = npcs.find(n => n.id === closestTargetId);
              if (targetNpc) {
                targetNpc.hp -= 2; // Deal 2 damage to hit NPC
                triggerHitParticles(closestTargetPos, _npcDir, "blood");
                
                if (targetNpc.hp <= 0) {
                  targetNpc.dead = true;
                  setDeadMap((prev) => ({ ...prev, [targetNpc.id]: true }));
                } else {
                  setFlashMap((prev) => ({ ...prev, [targetNpc.id]: true }));
                  setTimeout(() => {
                    setFlashMap((prev) => ({ ...prev, [targetNpc.id]: false }));
                  }, 120);
                }
                playHitSound();
              }
            }
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

          npc.position.add(_tmpVec.copy(npc.velocity).multiplyScalar(delta));
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
      minimapCtx.strokeStyle = "rgba(16,20,27,0.18)";
      minimapCtx.strokeRect(0, 0, cw, ch);

      // Draw buildings
      minimapCtx.fillStyle = "rgba(16, 20, 27, 0.16)";
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
      minimapCtx.strokeStyle = "rgba(61, 155, 255, 0.55)";
      minimapCtx.lineWidth = 2;
      minimapCtx.stroke();

      minimapCtx.beginPath();
      minimapCtx.arc(px, py, 3, 0, 2 * Math.PI);
      minimapCtx.fillStyle = "#3d9bff";
      minimapCtx.fill();

      // Draw NPCs
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        if (npc.dead || deadMap[npc.id]) continue;

        const nx = cx + npc.position.x * scale;
        const ny = cy + npc.position.z * scale;

        minimapCtx.beginPath();
        minimapCtx.arc(nx, ny, 2, 0, 2 * Math.PI);
        minimapCtx.fillStyle =
          npc.converted || convertedMap[npc.id] ? "#3d9bff" : "#ff5a4d";
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
            <meshBasicMaterial color="#ff5a4d" />
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
            <meshBasicMaterial color="#3d9bff" />
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
          color="#141a24"
          isMoving={playerMoving}
          isRunning={playerRunning}
          isShooting={isShooting}
          hasGun={true}
          weaponType={useGameStore.getState().weapon}
          dualWield={useGameStore.getState().weapon === 'pistol'}
          isReloading={useGameStore.getState().isReloading}
        />

        {/* Electric-blue energy focus rings under the player's feet */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.62, 32]} />
          <meshBasicMaterial
            color="#3d9bff"
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.0, 0.12, 16]} />
          <meshBasicMaterial
            color="#86c4ff"
            transparent
            opacity={0.6}
            depthWrite={false}
          />
        </mesh>

        {/* Cinematic firearm muzzle flash spark bursts & point lights! */}
        {muzzleFlash && (
          <group>
            {/* Right gun blast */}
            <group position={[0.28, 1.35, 0.89]}>
              {/* Yellow flare sphere */}
              <mesh>
                <sphereGeometry args={[0.24, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              {/* Stretched spike boxes */}
              <mesh>
                <boxGeometry args={[0.05, 0.5, 0.05]} />
                <meshBasicMaterial color="#ff8a5e" />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.05, 0.5, 0.05]} />
                <meshBasicMaterial color="#ff8a5e" />
              </mesh>
              {/* Transient high power spotlight overlay flare */}
              <pointLight intensity={5} distance={6} color="#ff7a5e" />
            </group>

            {/* Left gun blast */}
            <group position={[-0.28, 1.35, 0.89]}>
              <mesh>
                <sphereGeometry args={[0.24, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh>
                <boxGeometry args={[0.05, 0.5, 0.05]} />
                <meshBasicMaterial color="#ff8a5e" />
              </mesh>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <boxGeometry args={[0.05, 0.5, 0.05]} />
                <meshBasicMaterial color="#ff8a5e" />
              </mesh>
              <pointLight intensity={5} distance={6} color="#ff7a5e" />
            </group>
          </group>
        )}
      </group>

      {/* Floating Texts */}
      {floatingMsgs.map((msg) => (
        <FloatingText
          key={msg.id}
          position={msg.position}
          text={msg.text}
          color={msg.color}
          onComplete={() => {
            setFloatingMsgs((prev) => prev.filter((m) => m.id !== msg.id));
          }}
        />
      ))}

      {/* Pickups */}
      {pickups.map((p) => {
        if (!p.active) return null;
        
        if (p.type === "health") {
          return (
            <group
              key={p.id}
              ref={(el) => (pickupGroupRefs.current[p.id] = el)}
              position={[p.position.x, 0.5, p.position.z]}
            >
              <mesh
                ref={(el) => {
                  if (el) {
                    const time = performance.now() * 0.003;
                    el.rotation.y = time;
                    el.position.y = Math.sin(time * 2) * 0.1;
                  }
                }}
              >
                <boxGeometry args={[0.4, 0.4, 0.4]} />
                <meshBasicMaterial color="#f4f6f9" />
              </mesh>
              {/* coral medical cross for health */}
              <mesh ref={(el) => { if (el) { el.position.y = Math.sin(performance.now() * 0.003 * 2) * 0.1; } }} position={[0, 0, 0.21]}>
                <boxGeometry args={[0.25, 0.08, 0.02]} />
                <meshBasicMaterial color="#ff5a4d" />
              </mesh>
              <mesh ref={(el) => { if (el) { el.position.y = Math.sin(performance.now() * 0.003 * 2) * 0.1; } }} position={[0, 0, 0.21]}>
                <boxGeometry args={[0.08, 0.25, 0.02]} />
                <meshBasicMaterial color="#ff5a4d" />
              </mesh>
            </group>
          );
        }

        if (p.type === "weapon_tommy" || p.type === "weapon_shotgun") {
          const isTommy = p.type === "weapon_tommy";
          const color = isTommy ? "#ff8a5e" : "#ff5a4d";
          return (
             <group
              key={p.id}
              ref={(el) => (pickupGroupRefs.current[p.id] = el)}
              position={[p.position.x, 0.5, p.position.z]}
            >
               <group
                ref={(el) => {
                  if (el) {
                    const time = performance.now() * 0.003;
                    el.rotation.y = time * 2;
                    el.position.y = Math.sin(time * 3) * 0.15;
                  }
                }}
              >
                {isTommy ? (
                  <>
                    <mesh position={[0, 0, 0]}>
                      <boxGeometry args={[0.5, 0.1, 0.1]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                    <mesh position={[-0.1, -0.1, 0]}>
                      <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                  </>
                ) : (
                  <>
                    <mesh position={[0, 0, 0]}>
                      <boxGeometry args={[0.6, 0.08, 0.08]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                    <mesh position={[0, -0.06, 0]}>
                      <boxGeometry args={[0.4, 0.06, 0.09]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                    <mesh position={[-0.15, -0.12, 0]}>
                      <boxGeometry args={[0.08, 0.15, 0.08]} />
                      <meshBasicMaterial color={color} />
                    </mesh>
                  </>
                )}
              </group>
            </group>
          );
        }

        // Recruit type
        return (
          <group
            key={p.id}
            ref={(el) => (pickupGroupRefs.current[p.id] = el)}
            position={[p.position.x, 0.5, p.position.z]}
          >
            <mesh
              ref={(el) => {
                if (el) {
                  const time = performance.now() * 0.003;
                  el.rotation.y = time;
                  el.rotation.z = time * 0.5;
                  el.position.y = Math.sin(time * 2) * 0.2;
                }
              }}
            >
              <octahedronGeometry args={[0.3]} />
              <meshBasicMaterial color="#3d9bff" wireframe={true} />
            </mesh>
            <mesh
              ref={(el) => {
                if (el) {
                  const time = performance.now() * 0.003;
                  el.rotation.y = -time;
                  el.rotation.z = -time * 0.5;
                  el.position.y = Math.sin(time * 2) * 0.2;
                }
              }}
            >
              <octahedronGeometry args={[0.2]} />
              <meshBasicMaterial color="#86c4ff" />
            </mesh>
          </group>
        );
      })}

      {/* NPCs */}
      {npcs.map((npc, i) => {
        const isConverted = convertedMap[npc.id];
        const hits = npcHitsMap[npc.id] || 0;
        const isFlashing = flashMap[npc.id];
        const isDead = deadMap[npc.id];

        // Citizens are pale clay; converted allies wear the dark navy suit;
        // rushers/bosses carry a muted coral tint; coral flash on hit.
        let suitColor = isConverted ? "#141a24" : "#d4dbe3";
        if (npc.type === "rusher") suitColor = isConverted ? "#141a24" : "#e08a80";
        if (npc.type === "boss") suitColor = isConverted ? "#141a24" : "#cf6a5e";

        if (isFlashing) {
          suitColor = "#ff5a4d";
        }

        // Aligning health segments perfectly
        const healthPct = (npc.maxHp - hits) / npc.maxHp;
        const barWidth = healthPct * 0.5;
        const posX = barWidth / 2 - 0.25;

        // Ally Health calculation
        const allyHealthPct = npc.hp / npc.maxHp;
        const allyBarWidth = allyHealthPct * 0.4;
        const allyPosX = allyBarWidth / 2 - 0.2;

        return (
          <group
            key={npc.id}
            ref={(el) => (npcRefs.current[i] = el as Group)}
            visible={!isDead}
            scale={npc.scale}
          >
            <Humanoid
              color={suitColor}
              isMoving={true}
              isRunning={npc.type === "rusher"}
              isShooting={(npc.type !== "rusher" && npc.isShooting) || false}
              hasGun={npc.type !== "rusher"} // Rushers don't carry guns
              weaponType={npc.weaponType}
            />

            {/* Dynamic segmented health indicator overlay */}
            {!isConverted && hits > 0 && (
              <group position={[0, 1.8, 0]}>
                {/* Dark Base */}
                <mesh>
                  <boxGeometry args={[0.5, 0.045, 0.02]} />
                  <meshBasicMaterial
                    color="#5a6472"
                    transparent
                    opacity={0.7}
                  />
                </mesh>
                {/* Remaining health coral chunk */}
                <mesh position={[posX, 0, 0.012]}>
                  <boxGeometry args={[barWidth, 0.048, 0.025]} />
                  <meshBasicMaterial color="#ff5a4d" />
                </mesh>
              </group>
            )}

            {isConverted && (
              <group position={[0, 1.8, 0]}>
                {/* Health Bar Base for Converted (Allies) */}
                <mesh>
                  <boxGeometry args={[0.4, 0.045, 0.02]} />
                  <meshBasicMaterial
                    color="#5a6472"
                    transparent
                    opacity={0.7}
                  />
                </mesh>
                {/* Electric-blue ally HP fill */}
                <mesh position={[allyPosX, 0, 0.012]}>
                  <boxGeometry args={[allyBarWidth, 0.048, 0.025]} />
                  <meshBasicMaterial
                    color="#3d9bff"
                  />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </>
  );
}
