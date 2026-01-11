
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
  const detectionFrameRef = useRef<number>(0);

  useEffect(() => {
    async function initAI() {
      try {
        await tf.ready();
        // Auf RPi 4 ist CPU oft stabiler als experimentelles WebGL/WASM-Proxy
        await tf.setBackend('cpu'); 
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error("AI Init Error:", err);
        setError("KI konnte nicht initialisiert werden. Verbindung prüfen.");
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
          width: 640, 
          height: 480,
          frameRate: 15
        },
        audio: false
      });
      
      video.srcObject = stream;
      videoRef.current = video;
      
      video.onloadeddata = () => {
        video.play();
        setStreamReady(true);
        setUserInteracted(true);
      };
    } catch (err: any) {
      console.error("Camera Access Error:", err);
      setError("Kamera konnte nicht aktiviert werden.");
    }
  };

  const runDetection = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      try {
        const predictions = await model.detect(videoRef.current);
        const mappedObjects: DetectedObject[] = predictions
          .filter((p: any) => p.score > 0.4)
          .map((p: any, index: number) => {
            // Coco-SSD liefert [x, y, width, height]
            // Wir berechnen das Zentrum normalisiert (0 bis 1)
            const centerX = (p.bbox[0] + p.bbox[2] / 2) / videoRef.current!.videoWidth;
            const centerY = (p.bbox[1] + p.bbox[3] / 2) / videoRef.current!.videoHeight;
            
            return {
              id: `obj-${index}`,
              type: p.class as ObjectType,
              x: centerX,
              y: centerY,
              confidence: p.score
            };
          });
        setObjects(mappedObjects);
      } catch (e) {
        // Silent error for skipped frames
      }
    }
    detectionFrameRef.current = requestAnimationFrame(() => {
      // Kleiner Delay um den Pi 4 nicht zu überlasten
      setTimeout(runDetection, 100);
    });
  };

  useEffect(() => {
    if (model && streamReady) {
      runDetection();
    }
    return () => cancelAnimationFrame(detectionFrameRef.current);
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full font-mono text-white pointer-events-none">
      {!userInteracted ? (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <div className="mb-12 text-center">
            <h1 className="text-6xl font-black tracking-tighter text-blue-500 mb-2">VISION</h1>
            <p className="text-[10px] opacity-40 uppercase tracking-[0.6em]">System Architecture v2.4</p>
          </div>
          
          <button 
            onClick={startSystem}
            disabled={isLoading}
            className="group relative flex flex-col items-center gap-6 p-12 rounded-full border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all active:scale-95 disabled:opacity-30"
          >
            <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(37,99,235,0.4)]">
              {isLoading ? <RefreshCw className="w-10 h-10 animate-spin text-white" /> : <Play className="w-12 h-12 fill-white ml-2" />}
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
              {isLoading ? "Loading Engine..." : "Initialize Core"}
            </span>
          </button>
        </div>
      ) : (
        <div className="relative z-30 w-full h-full flex flex-col p-8">
          <div className="flex justify-between items-start pointer-events-auto">
            <div className="bg-black/80 p-4 border-l-4 border-blue-500 rounded-r-lg backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <span className="text-xs font-bold uppercase tracking-widest">Neural Link Active</span>
              </div>
            </div>
          </div>

          <div className="mt-auto pointer-events-none flex flex-col gap-4">
            <div className="bg-black/80 border border-white/10 p-6 rounded-lg w-80 pointer-events-auto backdrop-blur-xl">
              <div className="text-[10px] text-blue-400 font-bold mb-4 flex items-center gap-2">
                <Zap className="w-3 h-3" /> OBJECT_STREAM
              </div>
              <div className="space-y-2">
                {objects.length > 0 ? (
                  objects.map(obj => (
                    <div key={obj.id} className="flex items-center justify-between text-xs bg-white/5 p-3 border border-white/5">
                      <span className="font-bold uppercase tracking-wider">{obj.type}</span>
                      <span className="text-blue-400">{(obj.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] opacity-20 py-4 italic text-center border border-dashed border-white/10">Waiting for entities...</div>
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
        <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8 pointer-events-auto text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">SYSTEM_FAILURE</h2>
          <p className="text-sm text-white/50 mb-8 max-w-sm">{error}</p>
          <button onClick={() => window.location.reload()} className="px-10 py-4 bg-white text-black font-black text-xs uppercase tracking-widest">Manual Override</button>
        </div>
      )}
    </div>
  );
};

export default App;