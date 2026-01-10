
import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Activity, AlertCircle, Cpu, Zap } from 'lucide-react';
import { DetectedObject, ObjectType } from './types';
import P5Canvas from './components/P5Canvas';

declare const cocoSsd: any;

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
        const loadedModel = await cocoSsd.load({
          base: 'lite_mobilenet_v2'
        });
        setModel(loadedModel);
        setIsLoading(false);
      } catch (err) {
        setError("AI Modell konnte nicht geladen werden.");
      }
    }
    initAI();

    async function setupCamera() {
      const video = document.getElementById('webcam') as HTMLVideoElement;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: 640, height: 480 } 
        });
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            setStreamReady(true);
            video.play();
          };
          (videoRef as any).current = video;
        }
      } catch (err) {
        setError("Kamera-Fehler: Bitte Chromium-Berechtigungen prüfen.");
      }
    }
    setupCamera();
  }, []);

  const detectFrame = async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 2) {
      const predictions = await model.detect(videoRef.current);
      const mappedObjects: DetectedObject[] = predictions.map((p: any, index: number) => ({
        id: `local-${index}`,
        type: p.class as ObjectType,
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
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [model, streamReady]);

  return (
    <div className="relative w-full h-full overflow-hidden font-mono text-white pointer-events-none">
      <div className="relative z-20 w-full h-full flex flex-col p-6 pointer-events-none">
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="flex gap-4 items-center">
            <div className="bg-blue-600 p-2 rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.5)]">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter text-white">Edge Projector</h1>
              <div className="text-[10px] text-blue-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                CORE_ACTIVE_MIRRORED
              </div>
            </div>
          </div>
        </header>

        <div className="mt-auto flex justify-between items-end pointer-events-none">
          <div className="w-64 bg-black/80 border border-blue-500/30 p-4 rounded-xl backdrop-blur-md pointer-events-auto shadow-2xl">
            <div className="text-[10px] text-blue-500 mb-3 flex items-center gap-2 border-b border-blue-500/20 pb-2">
              <Zap className="w-3 h-3" />
              <span>SENSORS_OUTPUT</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {objects.length === 0 ? (
                <div className="text-[10px] opacity-40 italic">Scanning table surface...</div>
              ) : (
                objects.map(obj => (
                  <div key={obj.id} className="flex justify-between items-center text-[11px] bg-blue-500/10 p-2 rounded border border-blue-500/10">
                    <span className="font-bold uppercase text-blue-100">{obj.type}</span>
                    <span className="text-blue-400">{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <P5Canvas objects={objects} videoElement={videoRef.current} isReady={streamReady} />

      {isLoading && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 pointer-events-auto">
          <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <h2 className="text-lg font-bold tracking-[0.3em]">INITIALIZING_AI</h2>
        </div>
      )}
    </div>
  );
};

export default App;
