import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI';
import { GameScene } from './components/Game';
import { useGameStore } from './store';

export default function App() {
  // Remounting the scene on restart resets all in-scene state (NPCs, bullets, pickups)
  const runId = useGameStore((s) => s.runId);
  return (
    <div className="w-full h-full bg-[#dce6ef] flex items-center justify-center p-0 m-0 overflow-hidden font-sans text-white fixed inset-0">
      {/* Container for 9:16 aspect ratio */}
      <div className="relative w-full sm:w-[432px] h-full sm:h-[768px] max-w-full bg-[#dbe5ef] sm:border-[12px] sm:border-[#222a35] sm:rounded-[50px] shadow-2xl flex flex-col overflow-hidden">

        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [15, 20, 15], fov: 40 }}>
            <color attach="background" args={['#dbe5ef']} />
            <fog attach="fog" args={['#dbe5ef', 30, 125]} />
            <GameScene key={runId} />
          </Canvas>

          {/* Soft cool studio glow (top-left key fill) */}
          <div className="absolute -top-40 -left-40 w-[680px] h-[680px] bg-[#eaf2fb] opacity-[0.55] blur-[160px] rounded-full pointer-events-none"></div>
        </div>

        <UI />

        {/* Subtle cool edge vignette (keeps the clean clay look, no heavy noir black) */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0px_0px_120px_rgba(120,140,175,0.22)] z-20"></div>

      </div>
      
      {/* Side Info (Visible only in desktop preview) */}
      <div className="ml-12 max-w-xs hidden xl:block z-10">
        <h1 className="text-5xl font-sans font-black tracking-tight text-[#10141b] mb-6">SOLIPSISM</h1>
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-[#10141b]/50 mb-2">Mission Objective</h3>
            <p className="text-sm leading-relaxed text-[#10141b]/80">Eliminate individuality. Convert all remaining citizens into your likeness. Complete the assimilation to win.</p>
          </div>
          <div className="h-[1px] w-20 bg-[#10141b]/10"></div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 border border-[#10141b]/20 text-[#10141b]/70 text-[10px] tracking-widest uppercase">Clay Render</div>
            <div className="px-3 py-1 border border-[#10141b]/20 text-[#10141b]/70 text-[10px] tracking-widest uppercase">Isometric 3D</div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
