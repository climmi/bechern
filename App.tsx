
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Play, AlertCircle, Zap } from 'lucide-react';
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
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const detectionTimeoutRef = useRef<any>(null);

  useEffect(() => {
    async function initAI() {
      try {
        await tf.ready();
        await tf.setBackend('cpu'); 
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setError("AI Engine konnte nicht geladen werden.");
      }
    }
    initAI();
  }, []);

  const startSystem = async () => {
    const video = document.getElementById('webcam-feed') as HTMLVideoElement;
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
      videoRef.current = video;
      
      // Warten bis Video wirklich spielt
      video.onplaying = () => {
        setStreamReady(true);
        setUserInteracted(true);
      };

      await video.play();
    } catch (err: any) {
      console.error(err);
      setError("Kamera-Zugriff verweigert. Bitte in den Browsereinstellungen erlauben.");
    }
  };

  const detectFrame = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const predictions = await model.detect(videoRef.current);
        const mappedObjects: DetectedObject[] = predictions
          .filter((p: any) => p.score > 0.4)
          .map((p: any, index: number) => ({
            id: `obj-${index}`,
            type: p.class as ObjectType,
            x: p.bbox[0] / videoRef.current!.videoWidth,
            y: p.bbox[1] / videoRef.current!.videoHeight,
            confidence: p.score
          }));
        setObjects(mappedObjects);
      } catch (e) {
        // Ignoriere einzelne Frame-Fehler
      }
    }
    detectionTimeoutRef.current = setTimeout(() => {
      requestAnimationFrame(detectFrame);
    }, 200); 
  };

  useEffect(() => {
    if (model && streamReady) {
      detectFrame();
    }
    return () => clearTimeout(detectionTimeoutRef.current);
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full font-sans text-white pointer-events-none">
      {!userInteracted ? (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black italic tracking-tighter text-blue-500 mb-2">VISION.OS</h1>
            <p className="text-[10px] opacity-40 uppercase tracking-[0.5em]">RPi AI Vision Console</p>
          </div>
          
          <button 
            onClick={startSystem}
            disabled={isLoading}
            className="group relative flex flex-col items-center gap-4 p-10 rounded-full border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
              {isLoading ? <RefreshCw className="w-6 h-6 animate-spin text-white" /> : <Play className="w-8 h-8 fill-white ml-1" />}
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
              {isLoading ? "KI Lädt..." : "System Starten"}
            </span>
          </button>
        </div>
      ) : (
        <div className="relative z-30 w-full h-full flex flex-col p-6">
          <header className="flex justify-between items-start pointer-events-auto">
            <div className="bg-black/50 p-3 border border-white/10 rounded">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Live</span>
              </div>
            </div>
          </header>

          <div className="mt-auto pointer-events-none flex flex-col gap-2">
            <div className="bg-black/70 border border-blue-500/20 p-4 rounded w-64 pointer-events-auto">
              <div className="text-[10px] text-blue-400 font-bold mb-3 flex items-center gap-2">
                <Zap className="w-3 h-3" /> TRACKING_LOG
              </div>
              <div className="space-y-1.5">
                {objects.length > 0 ? (
                  objects.map(obj => (
                    <div key={obj.id} className="flex items-center justify-between text-[11px] bg-white/5 p-2 rounded-sm border-l border-blue-500">
                      <span className="font-bold">{obj.type}</span>
                      <span className="opacity-50">{(obj.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[9px] opacity-30 py-2 italic text-center">Keine Objekte erkannt</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {streamReady && (
        <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />
      )}

      {error && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-8 pointer-events-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2 uppercase">Initialisierungs-Fehler</h2>
          <p className="text-sm text-white/60 mb-8">{error}</p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-blue-600 text-white font-bold text-xs uppercase rounded">Neu Starten</button>
        </div>
      )}
    </div>
  );
};

export default App;