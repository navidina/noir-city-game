import { Canvas } from '@react-three/fiber';
import { UI } from './components/UI';
import { GameScene } from './components/Game';

export default function App() {
  return (
    <div className="w-full h-full bg-[#dfdad2] flex items-center justify-center p-0 m-0 overflow-hidden font-sans text-white fixed inset-0">
      {/* Container for 9:16 aspect ratio */}
      <div className="relative w-full sm:w-[432px] h-full sm:h-[768px] max-w-full bg-[#d6d0c2] sm:border-[12px] sm:border-[#2d2b27] sm:rounded-[50px] shadow-2xl flex flex-col overflow-hidden">
        
        <div className="absolute inset-0">
          <Canvas shadows camera={{ position: [15, 20, 15], fov: 40 }}>
            <color attach="background" args={['#d6d0c2']} />
            <fog attach="fog" args={['#d6d0c2', 30, 90]} />
            <GameScene />
          </Canvas>
          
          {/* Dramatic Daylight Flare Overlay */}
          <div className="absolute -top-45 -left-45 w-[650px] h-[650px] bg-amber-100 opacity-[0.14] blur-[150px] rounded-full pointer-events-none"></div>
        </div>

        <UI />

        {/* Cinematic Vignette */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0px_0px_150px_rgba(0,0,0,1)] z-20"></div>
        
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-20" style={{ background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))', backgroundSize: '100% 2px, 3px 100%' }}></div>
        
      </div>
      
      {/* Side Info (Visible only in desktop preview) */}
      <div className="ml-12 max-w-xs hidden xl:block z-10">
        <h1 className="text-4xl font-serif italic mb-6">SOLIPSISM</h1>
        <div className="space-y-6">
          <div>
            <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2">Mission Objective</h3>
            <p className="text-sm leading-relaxed text-white/70">Eliminate individuality. Convert all remaining 92 citizens of Sector 4 into your likeness. Complete the assimilation to win.</p>
          </div>
          <div className="h-[1px] w-20 bg-white/10"></div>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 border border-white/20 text-[10px] tracking-widest">DAYLIGHT MODE</div>
            <div className="px-3 py-1 border border-white/20 text-[10px] tracking-widest uppercase">Isometric 3D</div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
