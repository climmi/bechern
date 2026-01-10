
import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface P5CanvasProps {
  objects: DetectedObject[];
  videoElement: HTMLVideoElement | null;
  isReady: boolean;
}

const P5Canvas: React.FC<P5CanvasProps> = ({ objects, videoElement, isReady }) => {
  const p5Instance = useRef<any>(null);
  const objectsRef = useRef<DetectedObject[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    objectsRef.current = objects;
    videoRef.current = videoElement;
  }, [objects, videoElement]);

  useEffect(() => {
    const sketch = (p: any) => {
      p.setup = () => {
        // P2D ist oft stabiler auf RPi als der Standard-Renderer bei Wayland
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);
        canvas.parent('p5-container');
        
        // Optimierung für RPi: willReadFrequently im Context setzen (intern in p5)
        const ctx = canvas.elt.getContext('2d', { willReadFrequently: true });
        
        p.pixelDensity(1); 
        p.noSmooth(); // CPU-Schonung
        p.frameRate(20);
      };

      p.draw = () => {
        p.background(0); 

        // Video-Feed zeichnen
        if (videoRef.current && videoRef.current.readyState >= 2) {
          p.push();
          p.translate(p.width, 0);
          p.scale(-1, 1);
          p.image(videoRef.current, 0, 0, p.width, p.height);
          p.pop();
          
          // HUD-Overlay-Effekt
          p.fill(0, 0, 0, 100);
          p.rect(0, 0, p.width, p.height);
        }

        // Dekoration & Detektionen
        p.strokeWeight(1);
        p.noFill();
        
        objectsRef.current.forEach(obj => {
          const objX = (1 - obj.x) * p.width;
          const objY = obj.y * p.height;
          
          // Scanning Circle
          p.stroke(0, 255, 255, 150);
          p.ellipse(objX, objY, 60, 60);
          
          // Crosshair
          p.line(objX - 40, objY, objX + 40, objY);
          p.line(objX, objY - 40, objX, objY + 40);
          
          // Label
          p.fill(0, 255, 255);
          p.noStroke();
          p.textSize(12);
          p.text(obj.type.toUpperCase(), objX + 35, objY - 35);
          p.text(`${Math.round(obj.confidence * 100)}%`, objX + 35, objY - 20);
        });

        // Ambient Scanning Lines
        p.stroke(0, 255, 255, 30);
        let scanY = (p.frameCount * 2) % p.height;
        p.line(0, scanY, p.width, scanY);
      };

      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p5Instance.current = new (window as any).p5(sketch);
    return () => p5Instance.current?.remove();
  }, []);

  return null;
};

export default P5Canvas;
