
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Layers, Play, Pause, Terminal, Maximize, Share2, AlertCircle, CameraOff } from 'lucide-react';
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
    const constraintsList = [
      { video: { width: 640, height: 480 } },
      { video: { width: 1280, height: 720 } },
      { video: true } // Letzter Versuch: Alles was geht
    ];

    for (const constraints of constraintsList) {
      try {
        console.log("Versuche Kamera mit:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
          requestRef.current = requestAnimationFrame(renderLoop);
          return; // Erfolg!
        }
      } catch (e) {
        console.warn("Constraint fehlgeschlagen:", constraints, e);
      }
    }
    
    // Wenn alle fehlschlagen, Geräte auflisten für Debug
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideo = devices.some(d => d.kind === 'videoinput');
    setError(hasVideo 
      ? "Kamera erkannt, aber Zugriff verweigert. Prüfe Browser-Berechtigungen." 
      : "Keine Kamera Hardware gefunden. Steckt das Kabel richtig?");
  };

  useEffect(() => {
    (window as any).getLatestDetections = () => objects;
    setupCamera();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
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
      const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

      setIsLoading(true);
      const results = await detectObjectsFromFrame(base64Image);
      setObjects(results);
    } catch (err) {
      console.error("API Error", err);
    } finally {
      setIsLoading(false);
    }
  }, [isTracking, isLoading]);

  useEffect(() => {
    let interval: number;
    if (isTracking) {
      interval = window.setInterval(captureAndDetect, 3000); // 3 Sek für RPi Stabilität
    }
    return () => clearInterval(interval);
  }, [isTracking, captureAndDetect]);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden" onClick={() => videoRef.current?.play()}>
      <div className="absolute inset-0 z-0">
        <P5Canvas objects={objects} />
      </div>

      {/* Debug-Vorschau */}
      <div className={`fixed top-4 right-4 z-50 transition-all ${showUI ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="relative border-2 border-blue-600 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-slate-950 w-72 h-52">
          {!cameraReady ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900">
              <CameraOff className="w-10 h-10 text-slate-700 animate-pulse" />
              <button 
                onClick={setupCamera}
                className="px-4 py-2 bg-blue-600 rounded-lg text-xs font-bold hover:bg-blue-500 transition-colors"
              >
                RETRY_CAMERA
              </button>
            </div>
          ) : (
            <canvas ref={displayCanvasRef} className="w-full h-full object-cover" />
          )}
          <video ref={videoRef} className="hidden" playsInline muted />
          
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-mono border border-white/10">
            <div className={`w-2 h-2 rounded-full ${cameraReady ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500'}`} />
            <span className="tracking-widest">CAM_STREAM_01</span>
          </div>
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-900/20 backdrop-blur-[2px]">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                <span className="text-[9px] font-black text-blue-400 tracking-widest">ANALYZING</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-full max-w-md">
          <div className="bg-red-950/90 border-2 border-red-500 p-8 rounded-[2rem] backdrop-blur-xl shadow-2xl text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black mb-2">SYSTEM_FAILURE</h2>
            <p className="text-red-200/70 text-sm font-mono mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-red-600 rounded-xl font-bold hover:bg-red-500 transition-all"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        </div>
      )}

      {showUI && (
        <div className="relative z-10 flex flex-col h-screen p-12 pointer-events-none">
          <header className="flex justify-between items-start pointer-events-auto">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-4 w-1 bg-blue-600" />
                <h1 className="text-6xl font-black tracking-tighter italic text-white uppercase">Vision</h1>
              </div>
              <p className="text-blue-500 text-[10px] font-mono tracking-[0.5em] ml-5">RPi_AI_CORE_V1.0</p>
            </div>

            <button 
              onClick={(e) => { e.stopPropagation(); setIsTracking(!isTracking); }}
              className={`flex items-center gap-6 px-12 py-6 rounded-[2rem] font-black transition-all border-2 pointer-events-auto ${
                isTracking 
                ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' 
                : 'bg-blue-600 border-blue-600 text-white shadow-[0_0_40px_rgba(37,99,235,0.4)]'
              }`}
            >
              {isTracking ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 fill-current" />}
              <span className="text-lg tracking-[0.2em]">{isTracking ? 'STOP_SCAN' : 'START_SCAN'}</span>
            </button>
          </header>

          <main className="mt-auto pointer-events-auto flex justify-between items-end">
            <div className="w-80 bg-black/40 border border-white/5 rounded-[2.5rem] p-8 backdrop-blur-3xl shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="w-5 h-5 text-blue-500" />
                <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">Target_Inference</span>
              </div>
              <div className="space-y-4 max-h-52 overflow-y-auto pr-2 font-mono">
                {objects.length === 0 ? (
                  <div className="text-slate-700 py-6 text-center border border-dashed border-white/10 rounded-2xl text-[10px] uppercase tracking-tighter">
                    Awaiting Signal...
                  </div>
                ) : (
                  objects.map(obj => (
                    <div key={obj.id} className="flex flex-col gap-1 border-l-2 border-blue-500/30 pl-4 py-1">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-400 text-xs font-black uppercase">{obj.type}</span>
                        <span className="text-[10px] text-slate-500">{(obj.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-[2px] bg-slate-800">
                        <div className="h-full bg-blue-500" style={{ width: `${obj.confidence * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-end mr-4">
              <span className="text-9xl font-black text-white/5 leading-[0.8] mb-2">{objects.length}</span>
              <div className="h-[2px] w-24 bg-blue-600 mb-2" />
              <span className="text-[10px] font-black text-blue-500 tracking-[0.6em] uppercase">Objects</span>
            </div>
          </main>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
