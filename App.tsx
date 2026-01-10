
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Activity, AlertCircle, Cpu, Zap } from 'lucide-react';
import { DetectedObject, ObjectType } from './types';
import P5Canvas from './components/P5Canvas';

// Zugriff auf die global geladenen TF-Skripte
declare const cocoSsd: any;

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(null);

  // 1. Modell laden
  useEffect(() => {
    async function initAI() {
      try {
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2' // Optimiert für Raspberry Pi
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error("AI Modell Fehler:", err);
        setError("AI Modell konnte nicht lokal geladen werden.");
      }
    }
    initAI();
  }, []);

  // 2. Kamera Setup
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setStreamReady(true);
            videoRef.current?.play();
          };
        }
      } catch (err) {
        setError("Kamera-Zugriff fehlgeschlagen. Prüfen Sie das Flachbandkabel.");
      }
    }
    setupCamera();
  }, []);

  // 3. Echtzeit-Erkennungs Loop (Lokal auf CPU/GPU des RPi)
  const detectFrame = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      const predictions = await model.detect(videoRef.current);
      
      const mappedObjects: DetectedObject[] = predictions.map((p: any, index: number) => ({
        id: `local-${index}-${p.class}`,
        type: p.class as ObjectType,
        // TF liefert Pixel-Koordinaten, wir normalisieren auf 0-1
        x: p.bbox[0] / videoRef.current!.videoWidth,
        y: p.bbox[1] / videoRef.current!.videoHeight,
        confidence: p.score
      }));

      setObjects(mappedObjects);
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  };

  useEffect(() => {
    if (model && streamReady) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-mono text-white">
      {/* Native Video Feed - Sichtbar für RPi Performance */}
      <video 
        ref={videoRef} 
        className="absolute inset-0 w-full h-full object-cover z-0 grayscale opacity-30"
        playsInline 
        muted
      />
      
      {/* p5 Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />
      </div>

      {/* UI Overlay */}
      <div className="relative z-20 w-full h-full flex flex-col pointer-events-none p-6">
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="flex gap-4 items-center">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">Edge Projector</h1>
              <div className="text-[10px] text-blue-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                LOCAL_SNN_PROCESSING_ACTIVE
              </div>
            </div>
          </div>

          <div className="bg-black/60 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md">
            <div className="text-[9px] text-blue-400 mb-2 uppercase tracking-widest">System_Health</div>
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-[8px] opacity-50 uppercase">Latency</span>
                <span className="text-xs font-bold text-green-400">~15ms</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] opacity-50 uppercase">Backend</span>
                <span className="text-xs font-bold text-blue-400 uppercase">WASM_TFJS</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mt-auto flex justify-between items-end">
          <div className="w-64 bg-black/60 border border-white/10 p-4 rounded-xl backdrop-blur-xl pointer-events-auto">
            <div className="text-[10px] text-blue-500 mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3" />
              <span>LIVE_DETECTION_STREAM</span>
            </div>
            <div className="space-y-1.5">
              {objects.length === 0 ? (
                <div className="text-[10px] opacity-20 italic">No patterns detected...</div>
              ) : (
                objects.map(obj => (
                  <div key={obj.id} className="flex justify-between items-center text-[11px] bg-white/5 p-2 rounded">
                    <span className="font-bold uppercase tracking-tighter">{obj.type}</span>
                    <span className="text-blue-500">{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-lg font-bold tracking-[0.3em] uppercase">Loading Local AI</h2>
          <p className="text-[10px] opacity-50 mt-2">OPTIMIZING FOR RASPBERRY PI HARDWARE...</p>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[101] bg-black flex items-center justify-center p-6 text-center">
          <div className="border border-red-500 p-8 rounded-xl max-w-sm">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold uppercase text-red-500 mb-2">System Error</h2>
            <p className="text-xs opacity-70 mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="px-8 py-2 bg-red-600 text-white text-xs font-bold uppercase">Restart</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
