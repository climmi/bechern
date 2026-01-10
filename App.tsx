
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, Layers, Play, Pause, Terminal, Maximize, Share2 } from 'lucide-react';
import { detectObjectsFromFrame } from './services/geminiService';
import { DetectedObject } from './types';
import P5Canvas from './components/P5Canvas';

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    (window as any).getLatestDetections = () => objects;
  }, [objects]);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', 
            width: { ideal: 640 }, 
            height: { ideal: 480 } 
          } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setError("Kamera-Fehler: Hardware prüfen.");
      }
    }
    setupCamera();
  }, []);

  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isTracking || isLoading) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    setIsLoading(true);
    try {
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
      // Update auf 1 Sekunde (1000ms) gesetzt
      interval = window.setInterval(captureAndDetect, 1000); 
    }
    return () => clearInterval(interval);
  }, [isTracking, captureAndDetect]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'h') setShowUI(prev => !prev);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="relative min-h-screen bg-black text-white font-sans overflow-hidden cursor-none">
      <P5Canvas objects={objects} />

      {showUI && (
        <div className="relative z-10 flex flex-col h-screen p-8 pointer-events-none animate-in fade-in duration-500">
          <div className="flex justify-between items-start pointer-events-auto">
            <div>
              <h1 className="text-5xl font-black tracking-tighter text-blue-500 italic">
                SPATIAL VISION <span className="text-white not-italic">v1.1</span>
              </h1>
              <p className="text-blue-300/50 text-xs font-mono mt-2 tracking-widest uppercase">
                1Hz High-Speed Tracking Enabled
              </p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setIsTracking(!isTracking)}
                className={`group flex items-center gap-3 px-8 py-4 rounded-full font-black transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] border-2 ${
                  isTracking ? 'bg-red-600 border-red-400' : 'bg-blue-600 border-blue-400'
                }`}
              >
                {isTracking ? <Pause className="fill-white" /> : <Play className="fill-white" />}
                {isTracking ? 'SYSTEM HALT' : 'INITIATE SCAN'}
              </button>
            </div>
          </div>

          <div className="mt-auto flex justify-between items-end pointer-events-auto">
            <div className="w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500'}`} />
                  <span className="text-xs font-bold tracking-widest text-gray-400">COORDINATE STREAM (1Hz)</span>
                </div>
                {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />}
              </div>

              <div className="space-y-4">
                {objects.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-white/10 rounded-xl">
                    <p className="text-xs text-gray-600 uppercase tracking-tighter italic">Waiting for physical input...</p>
                  </div>
                ) : (
                  objects.map((obj) => (
                    <div key={obj.id} className="group bg-white/5 p-3 rounded-xl border border-white/5 hover:border-blue-500/50 transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-blue-400 font-black text-xs uppercase">{obj.type}</span>
                        <span className="text-[10px] text-gray-500 font-mono">ID: {obj.id.slice(0,4)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-gray-400">
                        <div className="bg-black/40 p-1 rounded">X: {obj.x.toFixed(4)}</div>
                        <div className="bg-black/40 p-1 rounded">Y: {obj.y.toFixed(4)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between">
                <div className="flex gap-2 text-gray-500">
                  <Maximize className="w-4 h-4" />
                  <Share2 className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Press 'H' to hide UI</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[60px] font-black leading-none text-white/5 select-none">
                {objects.length.toString().padStart(2, '0')}
              </div>
              <div className="text-xs font-bold text-blue-500 tracking-[0.3em] uppercase tracking-tighter">Active Entities</div>
            </div>
          </div>
        </div>
      )}

      <video ref={videoRef} className="hidden" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;
