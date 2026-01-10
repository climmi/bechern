
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Layers, Play, Pause, Terminal, Maximize, Share2, AlertCircle, CameraOff, Monitor } from 'lucide-react';
import { detectObjectsFromFrame } from './services/geminiService';
import { DetectedObject } from './types';
import P5Canvas from './components/P5Canvas';

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);

  const renderLoop = useCallback(() => {
    if (videoRef.current && displayCanvasRef.current) {
      const video = videoRef.current;
      const canvas = displayCanvasRef.current;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (ctx && video.readyState >= 2) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
    }
    requestRef.current = requestAnimationFrame(renderLoop);
  }, []);

  const setupCamera = async () => {
    setError(null);
    setCameraReady(false);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);

      if (videoDevices.length === 0) {
        setError("Hardware-Fehler: rpicam erkannt, aber Browser findet kein /dev/video Device.");
        return;
      }

      // RPi 4 / AI Camera Optimierte Constraints
      // Wir erzwingen 15fps, da Chromium bei 30fps auf dem Pi oft hängen bleibt
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { max: 15 },
          // Versuche das erste verfügbare Gerät explizit zu nehmen
          deviceId: videoDevices[0].deviceId ? { exact: videoDevices[0].deviceId } : undefined
        }
      };

      console.log("Starte Stream mit Constraints:", constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // WICHTIG: Auf dem Pi braucht play() oft einen Trigger
        await videoRef.current.play();
        setCameraReady(true);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = requestAnimationFrame(renderLoop);
      }
    } catch (e: any) {
      console.error("Kamera Initialisierung fehlgeschlagen:", e);
      setError(`Kamera-Fehler: ${e.message || "Unbekannter Fehler"}. Versuche 'rpicam-hello' zu schließen, falls es noch läuft.`);
    }
  };

  useEffect(() => {
    (window as any).getLatestDetections = () => objects;
    setupCamera();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [renderLoop]);

  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isTracking || isLoading) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (video.readyState < 2) return;

    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];

      setIsLoading(true);
      const results = await detectObjectsFromFrame(base64Image);
      setObjects(results);
    } catch (err) {
      console.error("Gemini API Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isTracking, isLoading]);

  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(captureAndDetect, 4000); // 4 Sek Interval schont die CPU des Pi 4
    }
    return () => clearInterval(interval);
  }, [isTracking, captureAndDetect]);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden" onClick={() => videoRef.current?.play()}>
      <div className="absolute inset-0 z-0">
        <P5Canvas objects={objects} />
      </div>

      <div className={`fixed top-4 right-4 z-50 transition-all ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="relative border-2 border-blue-500 rounded-3xl overflow-hidden shadow-2xl bg-black w-80 h-60">
          {!cameraReady ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 gap-4 p-6 text-center">
              <CameraOff className="w-12 h-12 text-slate-700 mb-2" />
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                Devices: {availableDevices.length > 0 ? availableDevices.map(d => d.label || 'VideoDevice').join(', ') : 'None'}
              </div>
              <button 
                onClick={setupCamera}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-xs font-black transition-all shadow-lg shadow-blue-900/40"
              >
                INITIALIZE_CORE
              </button>
            </div>
          ) : (
            <canvas ref={displayCanvasRef} className="w-full h-full object-cover" />
          )}
          <video ref={videoRef} className="hidden" playsInline muted />
          
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-bold border border-white/10">
            <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
            <span className="tracking-widest uppercase">Live_Feed_V4L2</span>
          </div>
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/30 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-10 h-10 animate-spin text-blue-400" />
                <span className="text-[10px] font-black text-blue-400 tracking-[0.3em]">PROCESSING</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
          <div className="bg-slate-900 border-2 border-red-500 p-10 rounded-[3rem] max-w-lg w-full text-center shadow-[0_0_100px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            <h2 className="text-3xl font-black mb-4 tracking-tighter italic uppercase text-red-500">Hardware_Conflict</h2>
            <p className="text-slate-400 font-mono text-sm leading-relaxed mb-8">{error}</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="py-4 bg-slate-800 rounded-2xl font-bold hover:bg-slate-700 transition-all text-xs uppercase"
              >
                Restart App
              </button>
              <button 
                onClick={setupCamera}
                className="py-4 bg-red-600 rounded-2xl font-bold hover:bg-red-500 transition-all text-xs uppercase shadow-lg shadow-red-900/40"
              >
                Retry Link
              </button>
            </div>
          </div>
        </div>
      )}

      {showUI && (
        <div className="relative z-10 flex flex-col h-screen p-12 pointer-events-none">
          <header className="flex justify-between items-start pointer-events-auto">
            <div className="group cursor-default">
              <div className="flex items-center gap-4 mb-2">
                <div className="h-10 w-2 bg-blue-600 rounded-full" />
                <h1 className="text-7xl font-black tracking-tighter italic text-white uppercase group-hover:text-blue-500 transition-colors">Vision</h1>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <Monitor className="w-3 h-3 text-blue-500/50" />
                <p className="text-blue-500/50 text-[10px] font-mono tracking-[0.5em] uppercase">RPi_v4_AI_Table</p>
              </div>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsTracking(!isTracking); }}
              disabled={!cameraReady}
              className={`flex items-center gap-8 px-14 py-8 rounded-[2.5rem] font-black transition-all border-2 pointer-events-auto disabled:opacity-30 disabled:grayscale ${
                isTracking 
                ? 'bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_50px_rgba(239,68,68,0.2)]' 
                : 'bg-blue-600 border-blue-600 text-white shadow-[0_0_60px_rgba(37,99,235,0.3)] hover:scale-105 active:scale-95'
              }`}
            >
              {isTracking ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 fill-current" />}
              <span className="text-xl tracking-[0.3em] uppercase">{isTracking ? 'Abort' : 'Engage'}</span>
            </button>
          </header>

          <main className="mt-auto pointer-events-auto flex justify-between items-end">
            <div className="w-96 bg-slate-950/60 border border-white/5 rounded-[3rem] p-10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
              <div className="flex items-center gap-4 mb-8">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Terminal className="w-5 h-5 text-blue-500" />
                </div>
                <span className="text-[10px] font-black text-slate-400 tracking-[0.4em] uppercase">Neural_Output</span>
              </div>
              <div className="space-y-5 max-h-64 overflow-y-auto pr-4 font-mono custom-scrollbar">
                {objects.length === 0 ? (
                  <div className="text-slate-700 py-10 text-center border-2 border-dashed border-white/5 rounded-[2rem] text-[10px] uppercase tracking-[0.2em] animate-pulse">
                    Scanning Environment...
                  </div>
                ) : (
                  objects.map(obj => (
                    <div key={obj.id} className="group/item flex flex-col gap-2 p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-blue-500/30">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-400 text-sm font-black uppercase tracking-wider">{obj.type}</span>
                        <span className="text-[11px] font-bold text-slate-500">{(obj.confidence * 100).toFixed(0)}% Match</span>
                      </div>
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-1000" 
                          style={{ width: `${obj.confidence * 100}%` }} 
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end mb-4 mr-6 group">
              <span className="text-[12rem] font-black text-white/[0.03] leading-[0.7] mb-4 select-none group-hover:text-blue-500/10 transition-colors">{objects.length}</span>
              <div className="h-1 w-32 bg-blue-600 mb-4 rounded-full" />
              <span className="text-xs font-black text-blue-500 tracking-[0.8em] uppercase">Live_Entities</span>
            </div>
          </main>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.5); }
      `}</style>
    </div>
  );
};

export default App;
