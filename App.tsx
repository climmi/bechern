
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Pause, Terminal, AlertCircle, CameraOff, Activity } from 'lucide-react';
import { detectObjectsFromFrame } from './services/geminiService';
import { DetectedObject } from './types';
import P5Canvas from './components/P5Canvas';

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const setupCamera = async () => {
    setError(null);
    try {
      const constraints = {
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          frameRate: { ideal: 24 } 
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wichtig für Autoplay auf dem Pi
        videoRef.current.setAttribute('autoplay', '');
        videoRef.current.setAttribute('muted', '');
        videoRef.current.setAttribute('playsinline', '');
        
        await videoRef.current.play();
        setCameraReady(true);
        console.log("Kamera erfolgreich gestartet");
      }
    } catch (e: any) {
      console.error("Kamera-Fehler:", e);
      setError(`Kamera konnte nicht gestartet werden: ${e.message}`);
    }
  };

  useEffect(() => {
    setupCamera();
  }, []);

  const captureAndDetect = useCallback(async () => {
    // Falls Tracking aus ist oder wir gerade laden, nichts tun
    if (!isTracking || isLoading || !videoRef.current || videoRef.current.readyState < 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.4).split(',')[1];
      
      setIsLoading(true);
      const results = await detectObjectsFromFrame(base64Image);
      setObjects(results);
    } catch (err) {
      console.error("Gemini Scan Fehler:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isTracking, isLoading]);

  // Effekt für den periodischen Scan
  useEffect(() => {
    let interval: number;
    if (isTracking && cameraReady) {
      // Initiale Ausführung sofort
      captureAndDetect();
      interval = window.setInterval(captureAndDetect, 4000); // Alle 4 Sekunden für Stabilität auf Pi 4
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking, cameraReady, captureAndDetect]);

  return (
    <div className="relative w-full h-full bg-black">
      {/* P5 Canvas steuert das gesamte Rendering inkl. Live-Video */}
      <P5Canvas objects={objects} videoElement={videoRef.current} />

      {/* UI Layer */}
      <div className="relative z-10 w-full h-full flex flex-col pointer-events-none">
        
        <header className="p-8 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent pointer-events-auto">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter">AI Projector</h1>
              <div className="text-[9px] font-mono text-blue-400 tracking-[0.4em]">SYSTEM_STABLE_LINK</div>
            </div>
          </div>

          <button 
            onClick={() => setIsTracking(!isTracking)}
            className={`flex items-center gap-4 px-10 py-5 rounded-2xl font-black transition-all border-2 pointer-events-auto ${
              isTracking 
                ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' 
                : 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-900/40 hover:scale-105 active:scale-95'
            }`}
          >
            {isTracking ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            <span className="tracking-widest uppercase">{isTracking ? 'Abort Scan' : 'Initiate Scan'}</span>
          </button>
        </header>

        <div className="flex-1 flex justify-between p-12 items-end">
          {/* Object List Panel */}
          <div className="w-72 bg-black/80 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-2xl pointer-events-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-4 text-blue-500">
              <Terminal className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-widest">Neural_Data</span>
            </div>
            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
              {objects.length === 0 ? (
                <div className="text-[10px] text-slate-500 uppercase py-8 text-center border border-white/5 rounded-2xl">
                  {isTracking ? 'Processing...' : 'System Idle'}
                </div>
              ) : (
                objects.map(obj => (
                  <div key={obj.id} className="flex justify-between items-center p-4 bg-white/5 rounded-xl border-l-4 border-blue-500">
                    <span className="text-xs text-white uppercase font-bold">{obj.type}</span>
                    <span className="text-[10px] text-blue-500 font-mono">{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Kleine Info Box */}
          <div className="p-8 bg-black/40 border border-white/5 rounded-[3rem] backdrop-blur-md pointer-events-auto">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
                <span className="text-[10px] font-mono text-white/50 tracking-tighter uppercase">Cam_Source: {cameraReady ? 'Active' : 'Offline'}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
                <span className="text-[10px] font-mono text-white/50 tracking-tighter uppercase">Processor: {isTracking ? 'Running' : 'Standby'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Das Video-Element wird HIER versteckt, da p5 es im Canvas zeichnet */}
      <video 
        ref={videoRef} 
        className="fixed top-[-9999px] left-[-9999px] opacity-0 pointer-events-none" 
        autoPlay 
        playsInline 
        muted 
      />
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-8">
          <div className="bg-slate-900 border-2 border-red-500 p-12 rounded-[4rem] text-center max-w-sm">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black uppercase mb-4 text-red-500">Hardware Link Error</h2>
            <p className="text-sm text-slate-400 font-mono mb-8">{error}</p>
            <button onClick={() => window.location.reload()} className="w-full py-5 bg-red-600 rounded-2xl font-black uppercase">Restart Core</button>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #2563eb; border-radius: 10px; }
        body { background-color: #000; }
      `}</style>
    </div>
  );
};

export default App;
