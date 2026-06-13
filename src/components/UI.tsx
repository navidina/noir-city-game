import { useEffect, useRef, useState } from "react";
import { useGameStore, WEAPONS } from "../store";

function TopLeftHUD() {
  const { score, totalNPCs, wave, health, maxHealth, weapon, ammo, reserveAmmo, isReloading, kills } = useGameStore();
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const setMinimapCtx = useGameStore((s) => s.setMinimapCtx);

  useEffect(() => {
    if (minimapCanvasRef.current) {
      setMinimapCtx(minimapCanvasRef.current.getContext("2d", { alpha: true }));
    }
  }, [setMinimapCtx]);

  const weaponStats = WEAPONS[weapon];
  const lowHealth = health / maxHealth < 0.3;

  return (
    <div className="flex flex-col items-start gap-3 pointer-events-auto">
      {/* HUD Container */}
      <div className="px-2 py-1 w-[160px]">
        {/* Simple Score */}
        <div className="flex justify-between items-baseline mb-1">
          <h2 className="text-2xl font-sans font-black tracking-tight text-white flex justify-start items-baseline gap-1.5 drop-shadow-md">
            {score.toString()}
            <span className="text-sm font-sans font-normal text-white/80 uppercase">
              / {totalNPCs}
            </span>
          </h2>
          <span className="text-sm font-bold text-[#ff5a4d] uppercase tracking-widest drop-shadow-md">
            WAVE {wave}
          </span>
        </div>

        {/* Kills counter */}
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-mono">
            Kills
          </span>
          <span className="text-[10px] font-bold text-white/90 font-mono drop-shadow-md">
            {kills}
          </span>
        </div>

        {/* Health Bar Component */}
        <div className={`w-full h-1.5 bg-black/40 border overflow-hidden relative mb-1.5 ${lowHealth ? "border-[#ff5a4d]/70 animate-pulse" : "border-white/25"}`}>
          <div
            className="h-full transition-all duration-300 bg-[#ff5a4d]"
            style={{ width: `${Math.max(0, (health / maxHealth) * 100)}%` }}
          />
        </div>

        {/* Ammo Bar Component */}
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="text-[10px] font-bold text-[#3d9bff] capitalize tracking-wider drop-shadow-md">
            {weaponStats.name}
          </span>
          <span className="text-[10px] font-bold text-white drop-shadow-md">
            {isReloading
              ? "RELOAD"
              : `${ammo}/${Number.isFinite(reserveAmmo) ? reserveAmmo : "∞"}`}
          </span>
        </div>
        <div className="w-full h-1 bg-black/40 border border-white/25 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 ${isReloading ? "bg-[#86c4ff] animate-pulse" : "bg-[#3d9bff]"}`}
            style={{ width: `${Math.max(0, (ammo / weaponStats.ammoCapacity) * 100)}%` }}
          />
        </div>
      </div>

      {/* Minimap Overlay */}
      <canvas
        ref={minimapCanvasRef}
        width={90}
        height={90}
        className="border border-[#10141b]/15 bg-white/35 backdrop-blur-md rounded-md"
      />
    </div>
  );
}

function UpgradeScreen() {
  const choices = useGameStore((s) => s.upgradeChoices);
  const chooseUpgrade = useGameStore((s) => s.chooseUpgrade);
  const wave = useGameStore((s) => s.wave);

  if (!choices) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto z-50">
      <div className="text-center p-6 max-w-[340px] w-full">
        <div className="h-[1px] w-28 bg-white/25 mx-auto mb-5"></div>
        <h2 className="text-xl font-sans font-black text-white tracking-tight uppercase mb-1">
          Wave {wave} Cleared
        </h2>
        <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-400 mb-6 font-mono">
          Assimilation protocol — choose an upgrade
        </p>

        <div className="flex flex-col gap-3">
          {choices.map((u) => (
            <button
              key={u.id}
              onClick={() => chooseUpgrade(u.id)}
              className="group w-full text-left px-5 py-4 border border-white/20 bg-zinc-950/90 hover:bg-white hover:text-black transition-all cursor-pointer flex items-center gap-4"
            >
              <span className="text-2xl font-sans font-black text-[#3d9bff] group-hover:text-black w-8 text-center shrink-0">
                {u.icon}
              </span>
              <span>
                <span className="block text-[12px] uppercase tracking-[0.2em] font-bold text-white group-hover:text-black">
                  {u.name}
                </span>
                <span className="block text-[9px] uppercase tracking-[0.15em] text-zinc-400 group-hover:text-zinc-700 font-mono mt-1">
                  {u.desc}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashButton() {
  const dashReadyAt = useGameStore((s) => s.dashReadyAt);
  const setDashRequested = useGameStore((s) => s.setDashRequested);
  const [, tick] = useState(0);

  // Re-render periodically while cooling down so the indicator refreshes
  useEffect(() => {
    if (dashReadyAt <= Date.now()) return;
    const i = setInterval(() => tick((x) => x + 1), 100);
    return () => clearInterval(i);
  }, [dashReadyAt]);

  const ready = Date.now() >= dashReadyAt;

  return (
    <button
      onTouchStart={(e) => {
        e.preventDefault();
        setDashRequested(true);
      }}
      onClick={() => setDashRequested(true)}
      className={`h-14 w-14 mb-1 backdrop-blur-md border rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none text-[10px] font-mono tracking-widest ${
        ready
          ? "bg-white/20 border-white/50 text-white"
          : "bg-black/40 border-white/10 text-white/30"
      }`}
    >
      DASH
    </button>
  );
}

function GameOverScreen() {
  const { wave, kills, score, restart } = useGameStore();
  const [best, setBest] = useState<{ wave: number; kills: number }>({
    wave: 0,
    kills: 0,
  });

  useEffect(() => {
    try {
      const prev = JSON.parse(localStorage.getItem("solipsism-best") || "{}");
      const newBest = {
        wave: Math.max(prev.wave || 0, wave),
        kills: Math.max(prev.kills || 0, kills),
      };
      localStorage.setItem("solipsism-best", JSON.stringify(newBest));
      setBest(newBest);
    } catch {}
  }, [wave, kills]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#10141b]/85 backdrop-blur-md pointer-events-auto z-50">
      <div className="text-center p-8 border border-[#ff5a4d]/25 bg-[#0d1118]/92 max-w-[320px] shadow-2xl">
        <div className="h-[1px] w-28 bg-[#ff5a4d]/50 mx-auto mb-6"></div>
        <h1 className="text-3xl font-sans font-black text-[#ff5a4d] tracking-tight mb-3 uppercase">
          Simulation Failed
        </h1>
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 mb-6 leading-relaxed">
          You were overtaken by the system.
        </p>

        {/* Run stats */}
        <div className="grid grid-cols-3 gap-2 mb-6 text-white font-mono">
          <div>
            <div className="text-lg font-bold">{wave}</div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">Wave</div>
          </div>
          <div>
            <div className="text-lg font-bold">{kills}</div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">Kills</div>
          </div>
          <div>
            <div className="text-lg font-bold">{score}</div>
            <div className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">Recruits</div>
          </div>
        </div>
        <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-500 mb-8 font-mono">
          Best — Wave {best.wave} / {best.kills} Kills
        </p>

        <button
          onClick={restart}
          className="px-8 py-3 border border-white/30 text-[10px] tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-all cursor-pointer font-mono"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

function StartMenu() {
  const setStatus = useGameStore((s) => s.setStatus);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto z-50">
      <div className="text-center p-8 max-w-[320px]">
        <div className="h-[1px] w-28 bg-white/25 mx-auto mb-6"></div>
        <h1 className="text-5xl font-sans font-black text-white tracking-tight mb-3 uppercase">
          Solipsism
        </h1>
        <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 mb-8 leading-relaxed">
          Shoot everyone. Become everyone.
        </p>

        <div className="text-left text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-mono mb-8 space-y-2">
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Move</span>
            <span>Left Stick / WASD</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Aim + Fire</span>
            <span>Right Stick / Arrows</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Dash</span>
            <span>Shift / Dash Button</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Reload</span>
            <span>R</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Pause</span>
            <span>Esc</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-white/80">Recruit</span>
            <span>Grab the green shard</span>
          </div>
        </div>

        <button
          onClick={() => setStatus("playing")}
          className="px-10 py-3 bg-white text-black text-[11px] tracking-[0.3em] uppercase font-mono hover:bg-white/85 transition-all cursor-pointer animate-pulse"
        >
          Begin
        </button>
      </div>
    </div>
  );
}

export function UI() {
  const {
    status,
    setStatus,
    restart,
    banner,
    health,
    maxHealth,
    muted,
    toggleMuted,
    setShooting,
    setJoystickVector,
    setShootVector,
  } = useGameStore();

  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const shootJoystickRef = useRef<HTMLDivElement>(null);
  const shootKnobRef = useRef<HTMLDivElement>(null);

  // Damage flash vignette driven by the store
  const damageTick = useGameStore((s) => s.damageTick);
  const [dmgFlash, setDmgFlash] = useState(false);
  useEffect(() => {
    if (!damageTick) return;
    setDmgFlash(true);
    const t = setTimeout(() => setDmgFlash(false), 180);
    return () => clearTimeout(t);
  }, [damageTick]);

  const lowHealth = status === "playing" && health / maxHealth < 0.3;

  const handleTouchStart = (
    e: React.TouchEvent | React.MouseEvent,
    type: "move" | "shoot",
  ) => {
    e.preventDefault();
    if (type === "move") handleMove(e, "move");
    if (type === "shoot") handleMove(e, "shoot");
  };

  const handleMove = (
    e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent,
    type: "move" | "shoot" = "move",
  ) => {
    const parentRef = type === "move" ? joystickRef : shootJoystickRef;
    const childRef = type === "move" ? knobRef : shootKnobRef;

    if (!parentRef.current) return;
    const rect = parentRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let clientX, clientY;
    if ("touches" in e) {
      // Find the touch that is closest to this joystick, or just loop through touches
      // A better way is to see which touch target is within the joystick area, but
      // for dual stick, tracking identifiers is best. Simplest approach for now is basic touch tracking.
      let bestTouch = e.touches[0];
      let minDistance = Infinity;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const dist =
          Math.pow(t.clientX - centerX, 2) + Math.pow(t.clientY - centerY, 2);
        if (dist < minDistance) {
          minDistance = dist;
          bestTouch = t;
        }
      }
      clientX = bestTouch.clientX;
      clientY = bestTouch.clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = rect.width / 2;

    let nx = dx;
    let ny = dy;
    if (distance > maxDistance) {
      nx = (dx / distance) * maxDistance;
      ny = (dy / distance) * maxDistance;
    }

    if (childRef.current) {
      childRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    }

    if (type === "move") {
      setJoystickVector({ x: nx / maxDistance, y: ny / maxDistance });
    } else {
      setShootVector({ x: nx / maxDistance, y: ny / maxDistance });
      setShooting(true); // Automatically set shooting when aiming
    }
  };

  const handleEnd = (
    e?: TouchEvent | MouseEvent | React.TouchEvent | React.MouseEvent,
    type?: "move" | "shoot",
  ) => {
    // If it's a specific end event from a component
    if (type) {
      if (type === "move") {
        if (knobRef.current)
          knobRef.current.style.transform = `translate(0px, 0px)`;
        setJoystickVector({ x: 0, y: 0 });
      } else {
        if (shootKnobRef.current)
          shootKnobRef.current.style.transform = `translate(0px, 0px)`;
        setShootVector({ x: 0, y: 0 });
        setShooting(false);
      }
      return;
    }

    // Global end handler
    if (e && "touches" in e) {
      const touches = (e as TouchEvent).touches;
      if (touches.length === 0) {
        if (knobRef.current)
          knobRef.current.style.transform = `translate(0px, 0px)`;
        setJoystickVector({ x: 0, y: 0 });
        if (shootKnobRef.current)
          shootKnobRef.current.style.transform = `translate(0px, 0px)`;
        setShootVector({ x: 0, y: 0 });
        setShooting(false);
      } else if (touches.length === 1) {
        // Find which joystick the remaining touch is closest to
        const touch = touches[0];

        let distMove = Infinity;
        if (joystickRef.current) {
          const rect = joystickRef.current.getBoundingClientRect();
          distMove =
            Math.pow(touch.clientX - (rect.left + rect.width / 2), 2) +
            Math.pow(touch.clientY - (rect.top + rect.height / 2), 2);
        }

        let distShoot = Infinity;
        if (shootJoystickRef.current) {
          const rect = shootJoystickRef.current.getBoundingClientRect();
          distShoot =
            Math.pow(touch.clientX - (rect.left + rect.width / 2), 2) +
            Math.pow(touch.clientY - (rect.top + rect.height / 2), 2);
        }

        if (distMove < distShoot) {
          // Keep move, reset shoot
          if (shootKnobRef.current)
            shootKnobRef.current.style.transform = `translate(0px, 0px)`;
          setShootVector({ x: 0, y: 0 });
          setShooting(false);
        } else {
          // Keep shoot, reset move
          if (knobRef.current)
            knobRef.current.style.transform = `translate(0px, 0px)`;
          setJoystickVector({ x: 0, y: 0 });
        }
      }
    } else {
      // Mouse/global fallback
      if (knobRef.current)
        knobRef.current.style.transform = `translate(0px, 0px)`;
      setJoystickVector({ x: 0, y: 0 });
      if (shootKnobRef.current)
        shootKnobRef.current.style.transform = `translate(0px, 0px)`;
      setShootVector({ x: 0, y: 0 });
      setShooting(false);
    }
  };

  useEffect(() => {
    // Note: global touchmove is omitted to avoid conflict with dual touches in simple setup,
    // we handle touchMove directly on the joystick containers.
    const onTouchEnd = (e: TouchEvent) => handleEnd(e);
    const onMouseUp = (e: MouseEvent) => handleEnd(e);

    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      up: false,
      down: false,
      left: false,
      right: false,
    };
    const updateJoy = () => {
      let x = 0;
      let y = 0;
      if (keys.w) y -= 1;
      if (keys.s) y += 1;
      if (keys.a) x -= 1;
      if (keys.d) x += 1;

      const dist = Math.sqrt(x * x + y * y);
      if (dist > 0) {
        setJoystickVector({ x: x / dist, y: y / dist });
      } else {
        setJoystickVector({ x: 0, y: 0 });
      }

      // Shoot joystick via arrow keys
      let sx = 0;
      let sy = 0;
      if (keys.up) sy -= 1;
      if (keys.down) sy += 1;
      if (keys.left) sx -= 1;
      if (keys.right) sx += 1;

      const sDist = Math.sqrt(sx * sx + sy * sy);
      if (sDist > 0) {
        setShootVector({ x: sx / sDist, y: sy / sDist });
        setShooting(true);
      } else {
        setShootVector({ x: 0, y: 0 });
        // Spacebar is the only alternative for shooting now
        if (!(keys as any).space) setShooting(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "w") keys.w = true;
      if (e.key === "a") keys.a = true;
      if (e.key === "s") keys.s = true;
      if (e.key === "d") keys.d = true;
      if (e.key === "ArrowUp") keys.up = true;
      if (e.key === "ArrowLeft") keys.left = true;
      if (e.key === "ArrowDown") keys.down = true;
      if (e.key === "ArrowRight") keys.right = true;
      if (e.key === "r" || e.key === "R") {
        useGameStore.getState().setReloadRequested(true);
      }
      if (e.key === "Shift") {
        useGameStore.getState().setDashRequested(true);
      }
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        const st = useGameStore.getState();
        if (st.status === "playing") st.setStatus("paused");
        else if (st.status === "paused") st.setStatus("playing");
      }
      if (e.key === " ") {
        // Spacebar just overrides isShooting if we aren't using arrow keys
        (keys as any).space = true;
        setShooting(true);
      }
      updateJoy();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "w") keys.w = false;
      if (e.key === "a") keys.a = false;
      if (e.key === "s") keys.s = false;
      if (e.key === "d") keys.d = false;
      if (e.key === "ArrowUp") keys.up = false;
      if (e.key === "ArrowLeft") keys.left = false;
      if (e.key === "ArrowDown") keys.down = false;
      if (e.key === "ArrowRight") keys.right = false;
      if (e.key === " ") {
        (keys as any).space = false;
        if (!keys.up && !keys.down && !keys.left && !keys.right) {
          setShooting(false);
        }
      }
      updateJoy();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const inGame = status === "playing" || status === "paused";

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10 font-sans select-none">
      {/* Damage flash vignette */}
      <div
        className="absolute inset-0 pointer-events-none bg-[#ff5a4d] transition-opacity duration-150 z-30"
        style={{ opacity: dmgFlash ? 0.2 : 0 }}
      />
      {/* Low health warning vignette */}
      {lowHealth && (
        <div className="absolute inset-0 pointer-events-none animate-pulse z-30 shadow-[inset_0_0_90px_rgba(255,90,77,0.45)]" />
      )}

      {/* 1. TOP HEADER ROW */}
      {inGame && (
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Top-Left Container */}
          <TopLeftHUD />

          {/* Top-Right Container */}
          <div className="flex flex-col items-end gap-3 pointer-events-auto">
            {/* Pause Button */}
            <button
              onClick={() => setStatus("paused")}
              className="h-11 w-11 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none"
            >
              <div className="flex gap-1.5 justify-center items-center">
                <div className="w-[3px] h-3.5 bg-white rounded-full"></div>
                <div className="w-[3px] h-3.5 bg-white rounded-full"></div>
              </div>
            </button>

            {/* Mute Button */}
            <button
              onClick={toggleMuted}
              className="h-11 w-11 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none text-white text-sm font-mono"
            >
              {muted ? "×" : "♪"}
            </button>
          </div>
        </div>
      )}

      {/* WAVE / EVENT BANNER */}
      {banner && status === "playing" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="text-center">
            <div className="h-[1px] w-20 bg-white/40 mx-auto mb-3"></div>
            <h1 className="text-4xl font-sans font-black text-white tracking-tight uppercase drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] animate-pulse">
              {banner}
            </h1>
            <div className="h-[1px] w-20 bg-white/40 mx-auto mt-3"></div>
          </div>
        </div>
      )}

      {/* START MENU */}
      {status === "menu" && <StartMenu />}

      {/* UPGRADE SELECTION */}
      {status === "upgrading" && <UpgradeScreen />}

      {/* 2. GAME COMPLETION SCREEN OVERLAY */}
      {status === "won" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto z-50">
          <div className="text-center p-8 border border-white/10 bg-black/90 max-w-[320px] shadow-2xl">
            {/* Top decorative line */}
            <div className="h-[1px] w-28 bg-white/25 mx-auto mb-6"></div>
            <h1 className="text-3xl font-sans font-black text-white tracking-tight mb-3 uppercase">
              City Conquered
            </h1>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 mb-8 leading-relaxed">
              They all wear the suit now. Consensus achieved.
            </p>
            <button
              onClick={restart}
              className="px-8 py-3 border border-white/30 text-[10px] tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-all cursor-pointer font-mono"
            >
              Restart Simulation
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER (LOST) SCREEN OVERLAY */}
      {status === "lost" && <GameOverScreen />}

      {/* PAUSE MENU OVERLAY */}
      {status === "paused" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto z-50">
          <div className="text-center p-8 border border-white/20 bg-zinc-950/95 max-w-[280px]">
            <div className="h-[1px] w-16 bg-white/25 mx-auto mb-5"></div>
            <h2 className="text-2xl font-sans font-black text-white tracking-tight mb-6">
              SYSTEM PAUSED
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setStatus("playing")}
                className="w-full py-2.5 bg-white text-black text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-white/90"
              >
                Resume
              </button>
              <button
                onClick={restart}
                className="w-full py-2.5 border border-white/20 text-white text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-white/10"
              >
                Restart Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CENTER / LOWER TEXT PROMPT ACCENTS */}
      {status === "playing" && (
        <div className="text-center w-full pointer-events-none mt-auto mb-8">
          {/* Framed typography exactly matching the poster */}
          <div className="flex flex-col items-center justify-center gap-1.5 opacity-65">
            <div className="h-[1px] w-12 bg-white/30"></div>
            <p className="text-[10px] font-sans font-medium uppercase tracking-[0.35em] text-white">
              The City Is Not Yet You.
            </p>
            <div className="h-[1px] w-12 bg-white/30"></div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-mono mt-1">
              Shoot everyone. Become everyone.
            </p>
          </div>
        </div>
      )}

      {/* 4. BOTTOM CONTROLS ROW */}
      {inGame && (
        <div className="flex justify-between items-end mb-3 pointer-events-auto relative z-40">
          {/* Semi-transparent Glassmorphic Movement Joystick Base */}
          <div
            ref={joystickRef}
            onTouchStart={(e) => handleTouchStart(e, "move")}
            onMouseDown={(e) => handleTouchStart(e, "move")}
            onMouseMove={(e) => {
              if (e.buttons === 1) handleMove(e, "move");
            }}
            onTouchMove={(e) => handleMove(e, "move")}
            onMouseUp={(e) => handleEnd(e, "move")}
            onTouchEnd={(e) => handleEnd(e, "move")}
            className="w-24 h-24 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center justify-center relative touch-none select-none"
          >
            {/* Inner ring helper */}
            <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />

            {/* Joystick Knob (Dynamic motion) */}
            <div
              ref={knobRef}
              className="w-10 h-10 rounded-full bg-zinc-100/10 border border-white/35 absolute shadow-lg transition-transform duration-75 active:scale-95"
              style={{ transform: "translate(0px, 0px)" }}
            />
          </div>

          {/* Center action buttons for touch play */}
          <div className="flex items-end gap-3">
            <button
              onTouchStart={() => useGameStore.getState().setReloadRequested(true)}
              onClick={() => useGameStore.getState().setReloadRequested(true)}
              className="h-11 w-11 mb-1 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none text-[9px] font-mono text-white tracking-widest"
            >
              R
            </button>
            <DashButton />
          </div>

          {/* Aiming / Shooting Joystick Base */}
          <div
            ref={shootJoystickRef}
            onTouchStart={(e) => handleTouchStart(e, "shoot")}
            onMouseDown={(e) => handleTouchStart(e, "shoot")}
            onMouseMove={(e) => {
              if (e.buttons === 1) handleMove(e, "shoot");
            }}
            onTouchMove={(e) => handleMove(e, "shoot")}
            onMouseUp={(e) => handleEnd(e, "shoot")}
            onTouchEnd={(e) => handleEnd(e, "shoot")}
            className="w-24 h-24 rounded-full border border-white/15 bg-black/25 backdrop-blur-md flex items-center justify-center relative touch-none select-none"
          >
            {/* Inner ring helper */}
            <div className="absolute inset-2 rounded-full border-2 border-white/30 pointer-events-none" />

            {/* Shoot Knob */}
            <div
              ref={shootKnobRef}
              className="w-10 h-10 rounded-full bg-white flex items-center justify-center absolute shadow-lg transition-transform duration-75 active:scale-95"
              style={{ transform: "translate(0px, 0px)" }}
            >
              <div className="w-3 h-3 bg-black rotate-45 pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
