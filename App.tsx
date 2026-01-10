
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Pause, Terminal, Activity, AlertCircle } from 'lucide-react';
import { detectObjectsFromFrame } from './services/geminiService';
import { DetectedObject } from './types';
import P5Canvas from './components/P5Canvas';

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // We still need a temporary canvas to grab frames for Gemini
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  const captureAndDetect = useCallback(async () => {
    if (!isTracking || isLoading) return;

    // We try to grab the video element created by p5 (it's hidden in the DOM)
    const p5Video = document.querySelector('video');
    const canvas = offscreenCanvasRef.current;
    
    if (!p5Video || !canvas || p5Video.readyState < 2) return;

    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(p5Video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      
      setIsLoading(true);
      const results = await detectObjectsFromFrame(base64Image);
      if (results) setObjects(results);
    } catch (err) {
      console.error("Gemini Scan Fehler:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isTracking, isLoading]);

  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(captureAndDetect, 4000); // Scan every 4s
      captureAndDetect();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, captureAndDetect]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* Background Layer (p5 handles its own camera setup) */}
      <P5Canvas objects={objects} />

      {/* UI Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
        <header className="p-8 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white font-sans">Neural Projector</h1>
              <div className="text-[9px] font-mono text-blue-400 tracking-[0.4em]">SYSTEM_STABLE_v2.8</div>
            </div>
          </div>

          <button 
            onClick={() => setIsTracking(!isTracking)}
            className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black transition-all border-2 pointer-events-auto ${
              isTracking 
                ? 'bg-red-500/10 border-red-500 text-red-500 shadow-lg shadow-red-500/10' 
                : 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-900/40 hover:scale-105 active:scale-95'
            }`}
          >
            {isTracking ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            <span className="tracking-widest uppercase">{isTracking ? 'Abort Session' : 'Initiate Scan'}</span>
          </button>
        </header>

        <div className="flex-1 flex justify-between p-12 items-end">
          {/* Data List */}
          <div className="w-72 bg-black/80 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-3xl pointer-events-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-blue-500">
              <Terminal className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Active_Entities</span>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {objects.length === 0 ? (
                <div className="text-[10px] text-slate-500 uppercase py-10 text-center border border-white/5 rounded-3xl italic">
                  {isTracking ? 'Synchronizing Neural Link...' : 'Hardware Standby'}
                </div>
              ) : (
                objects.map(obj => (
                  <div key={obj.id} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border-l-4 border-blue-500 hover:bg-white/10 transition-all">
                    <span className="text-xs text-white uppercase font-bold tracking-tight">{obj.type}</span>
                    <span className="text-[10px] text-blue-400 font-mono">{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div className="p-8 bg-black/80 border border-white/10 rounded-[3rem] backdrop-blur-xl pointer-events-auto flex gap-8 shadow-2xl items-center">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e]`} />
                <span className="text-[10px] font-mono text-white/70 uppercase">Optic: Active</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-blue-500 shadow-[0_0_8px_#2563eb]' : 'bg-slate-700'}`} />
                <span className="text-[10px] font-mono text-white/70 uppercase">Proc: {isTracking ? 'Running' : 'Idle'}</span>
              </div>
            </div>
            {isLoading && (
              <div className="border-l border-white/10 pl-8">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      <canvas ref={offscreenCanvasRef} className="hidden" />

      {error && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-8 backdrop-blur-xl">
          <div className="bg-slate-900 border border-red-500 p-12 rounded-[3rem] text-center max-w-sm">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black uppercase mb-4 text-white">System Breach</h2>
            <p className="text-sm text-slate-400 font-mono mb-8">{error}</p>
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black uppercase">Force Reboot</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2563eb; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
