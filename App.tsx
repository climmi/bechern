
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Cpu, Zap, AlertCircle } from 'lucide-react';
import { DetectedObject, ObjectType } from './types';
import P5Canvas from './components/P5Canvas';

declare const cocoSsd: any;
declare const tf: any;

const App: React.FC = () => {
  const [objects, setObjects] = useState<DetectedObject[]>([]);
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    async function initAI() {
      try {
        await tf.setBackend('cpu'); 
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        setError("AI Modell-Ladefehler.");
      }
    }
    initAI();

    async function setupCamera() {
      const video = document.getElementById('webcam-hidden') as HTMLVideoElement;
      if (!video) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }, 
            frameRate: { max: 15 } 
          }
        });
        video.srcObject = stream;
        
        video.onloadedmetadata = () => {
          video.play().then(() => {
            setStreamReady(true);
            (videoRef as any).current = video;
          }).catch(() => setError("Bitte klicken zum Starten."));
        };
      } catch (err: any) {
        setError("Kamera-Fehler: " + err.message);
      }
    }
    setupCamera();
  }, []);

  const detectFrame = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const predictions = await model.detect(videoRef.current);
        const mappedObjects: DetectedObject[] = predictions.map((p: any, index: number) => ({
          id: `obj-${index}`,
          type: p.class as ObjectType,
          x: p.bbox[0] / videoRef.current!.videoWidth,
          y: p.bbox[1] / videoRef.current!.videoHeight,
          confidence: p.score
        }));
        setObjects(mappedObjects);
      } catch (e) {
        // Silent catch
      }
    }
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(detectFrame);
    }, 100); // 10 FPS Ziel für RPi 4 Stabilität
  };

  useEffect(() => {
    if (model && streamReady) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full font-mono text-white pointer-events-none">
      <div className="relative z-30 w-full h-full flex flex-col p-6">
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="flex gap-4 items-center bg-black/60 p-3 rounded-xl border border-white/10 backdrop-blur-md">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter italic">RPi Vision</h1>
              <div className="text-[9px] text-blue-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                CORE_STABLE
              </div>
            </div>
          </div>
        </header>

        <div className="mt-auto pointer-events-none">
          <div className="w-48 bg-black/80 border border-blue-500/30 p-3 rounded-lg pointer-events-auto">
            <div className="text-[9px] text-blue-500 mb-2 flex items-center gap-2 border-b border-blue-500/10 pb-1">
              <Zap className="w-3 h-3" />
              <span>DETECTION_LOG</span>
            </div>
            <div className="space-y-1">
              {objects.length > 0 ? (
                objects.slice(0, 3).map(obj => (
                  <div key={obj.id} className="flex justify-between items-center text-[9px] bg-blue-500/10 p-1 rounded">
                    <span className="font-bold uppercase tracking-widest">{obj.type}</span>
                    <span className="text-blue-500">{Math.round(obj.confidence * 100)}%</span>
                  </div>
                ))
              ) : (
                <div className="text-[10px] opacity-30 italic animate-pulse">Scanning environment...</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />

      {isLoading && !error && (
        <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center p-6 pointer-events-auto">
          <div className="relative">
            <RefreshCw className="w-12 h-12 text-blue-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold">AI</div>
          </div>
          <h2 className="text-xs font-bold tracking-[0.3em] opacity-70 uppercase mt-4">System Start</h2>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
          <p className="text-xs text-red-500 font-bold uppercase tracking-widest mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-8 px-8 py-3 bg-white text-black font-black text-xs uppercase hover:bg-blue-600 hover:text-white transition-all">Restart Engine</button>
        </div>
      )}
    </div>
  );
};

export default App;
