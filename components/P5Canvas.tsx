
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

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    // Wir warten explizit darauf, dass isReady true ist UND das Element im DOM ist
    if (!isReady) return;

    const sketch = (p: any) => {
      let flowLines: any[] = [];
      const lineCount = 80; // Reduziert für RPi Performance

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
        
        for (let i = 0; i < lineCount; i++) {
          flowLines.push({
            x: p.random(p.width),
            y: p.random(p.height),
            px: 0,
            py: 0,
            speed: p.random(1, 3),
            hue: p.random(180, 220)
          });
        }
        p.clear();
      };

      p.draw = () => {
        p.clear(); // Kritisch für Transparenz über dem Video

        flowLines.forEach(line => {
          line.px = line.x;
          line.py = line.y;

          let angle = p.noise(line.x * 0.01, line.y * 0.01, p.frameCount * 0.01) * p.TWO_PI;
          
          objectsRef.current.forEach(obj => {
            const objX = (1 - obj.x) * p.width;
            const objY = obj.y * p.height;
            const d = p.dist(line.x, line.y, objX, objY);
            
            if (d < 150) {
              const avoidance = p.atan2(line.y - objY, line.x - objX);
              angle = p.lerp(angle, avoidance, 0.2);
              line.speed = p.lerp(line.speed, 6, 0.1);
            } else {
              line.speed = p.lerp(line.speed, 2, 0.05);
            }
          });

          line.x += p.cos(angle) * line.speed;
          line.y += p.sin(angle) * line.speed;

          if (line.x < 0 || line.x > p.width || line.y < 0 || line.y > p.height) {
            line.x = p.random(p.width);
            line.y = p.random(p.height);
            line.px = line.x;
            line.py = line.y;
          }

          p.stroke(line.hue, 80, 100, 0.7);
          p.strokeWeight(2);
          p.line(line.px, line.py, line.x, line.y);
        });

        // Debug-Overlay für AI
        objectsRef.current.forEach(obj => {
          const objX = (1 - obj.x) * p.width;
          const objY = obj.y * p.height;
          p.noFill();
          p.stroke(0, 100, 100, 0.5);
          p.circle(objX, objY, 80);
          p.fill(255);
          p.noStroke();
          p.textSize(12);
          p.text(obj.type.toUpperCase(), objX + 45, objY);
        });
      };

      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    // Timeout um sicherzugehen, dass das DOM-Element bereit ist
    const timeout = setTimeout(() => {
      p5Instance.current = new (window as any).p5(sketch);
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, [isReady]);

  return null;
};

export default P5Canvas;