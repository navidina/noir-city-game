import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';

export function UI() {
  const { score, totalNPCs, status, setShooting, joystickVector, setJoystickVector } = useGameStore();

  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    handleMove(e);
  };
  
  const handleMove = (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
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

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${nx}px, ${ny}px)`;
    }

    setJoystickVector({ x: nx / maxDistance, y: ny / maxDistance });
  };

  const handleEnd = () => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(0px, 0px)`;
    }
    setJoystickVector({ x: 0, y: 0 });
  };

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => handleMove(e);
    const onTouchEnd = () => handleEnd();
    const onMouseUp = () => handleEnd();
    
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mouseup', onMouseUp);
    
    return () => {
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const keys = { w: false, a: false, s: false, d: false };
    const updateJoy = () => {
      let x = 0; let y = 0;
      if (keys.w) y -= 1;
      if (keys.s) y += 1;
      if (keys.a) x -= 1;
      if (keys.d) x += 1;
      
      const dist = Math.sqrt(x*x + y*y);
      if (dist > 0) {
        setJoystickVector({ x: x/dist, y: y/dist });
      } else {
        setJoystickVector({ x: 0, y: 0 });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
      if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
      if (e.key === 's' || e.key === 'ArrowDown') keys.s = true;
      if (e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
      if (e.key === ' ') setShooting(true);
      updateJoy();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
      if (e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
      if (e.key === 's' || e.key === 'ArrowDown') keys.s = false;
      if (e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
      if (e.key === ' ') setShooting(false);
      updateJoy();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-10 font-sans select-none">
      
      {/* 1. TOP HEADER ROW */}
      <div className="flex justify-between items-start pointer-events-auto">
        {/* Double Frame Blueprint Score Box (Matches reference artwork perfectly) */}
        <div className="p-[2px] border border-white/20 bg-black/50 backdrop-blur-md">
          <div className="border border-white/20 px-4 py-3 min-w-[140px]">
            <p className="text-[9px] uppercase tracking-[0.25em] text-zinc-400 font-mono font-medium mb-1.5">
              Current Identity
            </p>
            <h2 className="text-3xl font-serif italic font-bold tracking-tight text-white flex items-baseline gap-1.5">
              {score.toString().padStart(2, '0')} 
              <span className="text-[10px] font-sans font-normal tracking-[0.3em] text-white/30 uppercase">
                / {totalNPCs}
              </span>
            </h2>
          </div>
        </div>

        {/* Top-Right Pause Circle Button with Thin outline & thick line markers */}
        <button 
          onClick={() => setShowPauseMenu(true)}
          className="h-11 w-11 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-all focus:outline-none"
        >
          <div className="flex gap-1.5 justify-center items-center">
            <div className="w-[3px] h-3.5 bg-white rounded-full"></div>
            <div className="w-[3px] h-3.5 bg-white rounded-full"></div>
          </div>
        </button>
      </div>

      {/* 2. GAME COMPLETION SCREEN OVERLAY */}
      {status === 'won' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-md pointer-events-auto z-50">
          <div className="text-center p-8 border border-white/10 bg-black/90 max-w-[320px] shadow-2xl">
            {/* Top decorative line */}
            <div className="h-[1px] w-28 bg-white/25 mx-auto mb-6"></div>
            <h1 className="text-3xl font-serif italic text-white tracking-widest mb-3 uppercase">
              City Conquered
            </h1>
            <p className="text-[10px] uppercase tracking-[0.35em] text-zinc-400 mb-8 leading-relaxed">
              They all wear the suit now. Consensus achieved.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-8 py-3 border border-white/30 text-[10px] tracking-[0.25em] uppercase text-white hover:bg-white hover:text-black transition-all cursor-pointer font-mono"
            >
              Restart Simulation
            </button>
          </div>
        </div>
      )}

      {/* PAUSE MENU OVERLAY */}
      {showPauseMenu && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto z-50">
          <div className="text-center p-8 border border-white/20 bg-zinc-950/95 max-w-[280px]">
            <div className="h-[1px] w-16 bg-white/25 mx-auto mb-5"></div>
            <h2 className="text-2xl font-serif italic text-white tracking-widest mb-6">SYSTEM PAUSED</h2>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setShowPauseMenu(false)}
                className="w-full py-2.5 bg-white text-black text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-white/90"
              >
                Resume
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-2.5 border border-white/20 text-white text-[10px] uppercase tracking-[0.2em] font-mono hover:bg-white/10"
              >
                Restart Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CENTER / LOWER TEXT PROMPT ACCENTS */}
      {status !== 'won' && (
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
      <div className="flex justify-between items-end mb-3 pointer-events-auto relative z-40">
        
        {/* Semi-transparent Glassmorphic Joystick Base */}
        <div 
          ref={joystickRef}
          onTouchStart={handleTouchStart}
          onMouseDown={handleTouchStart}
          onMouseMove={(e) => { if (e.buttons === 1) handleMove(e) }}
          onTouchMove={(e) => handleMove(e)}
          className="w-24 h-24 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center justify-center relative touch-none select-none"
        >
          {/* Inner ring helper */}
          <div className="absolute inset-4 rounded-full border border-white/5 pointer-events-none" />
          
          {/* Joystick Knob (Dynamic motion) */}
          <div 
            ref={knobRef}
            className="w-10 h-10 rounded-full bg-zinc-100/10 border border-white/35 absolute shadow-lg transition-transform duration-75 active:scale-95"
            style={{ transform: 'translate(0px, 0px)' }}
          />
        </div>

        {/* Custom Double-layered Action shoot weapon button (Perfect Poster Match!) */}
        <button 
          onPointerDown={() => setShooting(true)}
          onPointerUp={() => setShooting(false)}
          onPointerLeave={() => setShooting(false)}
          className="w-22 h-22 rounded-full border border-white/20 flex items-center justify-center active:scale-95 transition-all select-none bg-black/25 p-0 focus:outline-none appearance-none cursor-pointer"
        >
          {/* Outer circle spacing */}
          <div className="w-18 h-18 rounded-full border-2 border-white/45 flex items-center justify-center p-1">
            {/* Solid white central core */}
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center hover:bg-white/95 active:bg-zinc-200 transition-colors">
              {/* Distinctive black center solid diamond */}
              <div className="w-4 h-4 bg-black rotate-45" />
            </div>
          </div>
        </button>

      </div>
    </div>
  );
}
