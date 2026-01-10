
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
        // Auf dem RPi ist WebGL oft instabil. Wir versuchen CPU oder WASM (falls verfügbar).
        // Standardmäßig nutzen wir CPU für absolute Stabilität, falls WebGL schwarz wird.
        await tf.setBackend('cpu'); 
        console.log("TFJS Backend:", tf.getBackend());

        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setError("AI Modell konnte nicht geladen werden.");
      }
    }
    initAI();

    async function setupCamera() {
      const video = document.getElementById('webcam') as HTMLVideoElement;
      if (!video) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, frameRate: 15 } // Niedrigere FPS für RPi Stabilität
        });
        video.srcObject = stream;
        
        video.onloadeddata = () => {
          video.play().then(() => {
            setStreamReady(true);
            (videoRef as any).current = video;
          }).catch(e => setError("Klicken Sie zum Starten."));
        };
      } catch (err: any) {
        setError(`Kamera-Zugriff verweigert.`);
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
        // Silent error to prevent loop crash
      }
    }
    // RPi braucht mehr Luft zum Atmen, daher leicht verzögert
    setTimeout(() => {
      requestRef.current = requestAnimationFrame(detectFrame);
    }, 50); 
  };

  useEffect(() => {
    if (model && streamReady) {
      requestRef.current = requestAnimationFrame(detectFrame);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full font-mono text-white pointer-events-none">
      <div className="relative z-30 w-full h-full flex flex-col p-6 pointer-events-none">
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="flex gap-4 items-center">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter text-white">Edge Projector</h1>
              <div className="text-[9px] text-blue-400 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                STABLE_MODE
              </div>
            </div>
          </div>
        </header>

        <div className="mt-auto pointer-events-none">
          <div className="w-48 bg-black/80 border border-blue-500/20 p-3 rounded-lg backdrop-blur-sm pointer-events-auto">
            <div className="text-[9px] text-blue-500 mb-2 flex items-center gap-2 border-b border-blue-500/10 pb-1">
              <Zap className="w-3 h-3" />
              <span>SENSOR_LOG</span>
            </div>
            <div className="space-y-1">
              {objects.slice(0, 3).map(obj => (
                <div key={obj.id} className="flex justify-between items-center text-[9px] bg-blue-500/5 p-1 rounded">
                  <span className="font-bold uppercase opacity-80">{obj.type}</span>
                  <span className="text-blue-500">{Math.round(obj.confidence * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />

      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <RefreshCw className="w-10 h-10 text-blue-600 animate-spin mb-4" />
          <h2 className="text-sm font-bold tracking-widest opacity-50 uppercase">Booting Systems...</h2>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-[110] bg-black/95 flex flex-col items-center justify-center p-6 pointer-events-auto">
          <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">{error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 border border-white text-[10px] uppercase">Restart</button>
        </div>
      )}
    </div>
  );
};

export default App;
