
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Cpu, Zap, AlertCircle, Play } from 'lucide-react';
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
  const [userInteracted, setUserInteracted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number>(null);

  useEffect(() => {
    async function initAI() {
      try {
        // CPU Backend ist für RPi 4 stabiler als WebGL bei gleichzeitiger Canvas-Anzeige
        await tf.setBackend('cpu'); 
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        setError("KI-Ladefehler. Bitte Seite neu laden.");
      }
    }
    initAI();
  }, []);

  const startSystem = async () => {
    setUserInteracted(true);
    const video = document.getElementById('webcam-hidden') as HTMLVideoElement;
    if (!video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: 640, 
          height: 480, 
          frameRate: { max: 15 } 
        }
      });
      video.srcObject = stream;
      
      await video.play();
      setStreamReady(true);
      (videoRef as any).current = video;
    } catch (err: any) {
      setError("Kamera-Zugriff verweigert oder nicht gefunden.");
    }
  };

  const detectFrame = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const predictions = await model.detect(videoRef.current);
        const mappedObjects: DetectedObject[] = predictions.map((p: any, index: number) => ({
          id: `obj-${index}-${Date.now()}`,
          type: p.class as ObjectType,
          x: p.bbox[0] / videoRef.current!.videoWidth,
          y: p.bbox[1] / videoRef.current!.videoHeight,
          confidence: p.score
        }));
        setObjects(mappedObjects);
      } catch (e) {
        console.error("Detection Error", e);
      }
    }
    // Höhere Verzögerung für RPi-Thermomanagement
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(detectFrame);
    }, 150); 
  };

  useEffect(() => {
    if (model && streamReady) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full font-mono text-white pointer-events-none">
      {!userInteracted ? (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <button 
            onClick={startSystem}
            className="group flex flex-col items-center gap-6 p-12 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
          >
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(37,99,235,0.5)] group-hover:scale-110 transition-transform">
              <Play className="w-10 h-10 fill-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-black tracking-widest uppercase mb-2">System Starten</h2>
              <p className="text-[10px] text-blue-400 opacity-70">RASPBERRY PI VISION ENGINE v1.0</p>
            </div>
          </button>
        </div>
      ) : (
        <div className="relative z-30 w-full h-full flex flex-col p-6">
          <header className="flex justify-between items-start pointer-events-auto">
            <div className="flex gap-4 items-center bg-black/80 p-3 rounded-xl border border-white/10 backdrop-blur-md">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tighter italic">Vision Active</h1>
                <div className="text-[9px] text-blue-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  CPU_RENDER_MODE
                </div>
              </div>
            </div>
          </header>

          <div className="mt-auto pointer-events-none">
            <div className="w-48 bg-black/90 border border-blue-500/30 p-3 rounded-lg pointer-events-auto">
              <div className="text-[9px] text-blue-500 mb-2 flex items-center gap-2 border-b border-blue-500/10 pb-1">
                <Zap className="w-3 h-3" />
                <span>TELEMETRY</span>
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
                  <div className="text-[10px] opacity-30 italic animate-pulse">Analyzing frames...</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />

      {isLoading && !error && userInteracted && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <h2 className="text-xs font-bold tracking-[0.3em] opacity-70 uppercase">Loading AI Model</h2>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
          <p className="text-xs text-red-500 font-bold uppercase tracking-widest mb-2">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-8 px-8 py-3 bg-white text-black font-black text-xs uppercase transition-all">Retry</button>
        </div>
      )}
    </div>
  );
};

export default App;
