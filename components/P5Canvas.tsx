
import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface P5CanvasProps {
  objects: DetectedObject[];
  videoElement: HTMLVideoElement | null;
}

const P5Canvas: React.FC<P5CanvasProps> = ({ objects, videoElement }) => {
  const p5Instance = useRef<any>(null);
  const objectsRef = useRef<DetectedObject[]>(objects);
  const videoRef = useRef<HTMLVideoElement | null>(videoElement);
  const stateRef = useRef<Map<string, {x: number, y: number, active: boolean, lastSeen: number}>>(new Map());

  useEffect(() => {
    objectsRef.current = objects;
    const now = Date.now();
    objects.forEach(obj => {
      // Wir spiegeln die X-Koordinate: Gemini liefert 0-1 (un-mirrored), wir brauchen (1-x) für den gespiegelten Feed
      const mirroredX = 1 - obj.x;
      if (!stateRef.current.has(obj.id)) {
        stateRef.current.set(obj.id, { x: mirroredX, y: obj.y, active: true, lastSeen: now });
      } else {
        const s = stateRef.current.get(obj.id)!;
        s.active = true;
        s.x = mirroredX;
        s.y = obj.y;
        s.lastSeen = now;
      }
    });
  }, [objects]);

  useEffect(() => {
    videoRef.current = videoElement;
  }, [videoElement]);

  useEffect(() => {
    const sketch = (p: any) => {
      const LINE_SPACING = 30; 
      const FORCE_RADIUS = 250; 

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
      };

      p.draw = () => {
        p.background(0);

        // 1. LIVE FEED ZEICHNEN (GESPIEGELT)
        // Wir zeichnen das Video direkt ins Canvas, damit es keine Verzögerung gibt.
        if (videoRef.current && videoRef.current.readyState >= 2) {
          p.push();
          p.translate(p.width, 0);
          p.scale(-1, 1); // Spiegelung im Canvas
          
          let vW = videoRef.current.videoWidth;
          let vH = videoRef.current.videoHeight;
          let scale = Math.max(p.width / vW, p.height / vH);
          let nW = vW * scale;
          let nH = vH * scale;
          let offX = (p.width - nW) / 2;
          let offY = (p.height - nH) / 2;
          
          p.tint(255, 0.5); // 50% Deckkraft
          p.image(videoRef.current, offX, offY, nW, nH);
          p.pop();
        }

        const now = Date.now();
        const targetObjects = objectsRef.current;

        // 2. OBJEKT-INTERPOLATION
        stateRef.current.forEach((val, id) => {
          const target = targetObjects.find(o => o.id === id);
          if (target) {
            const mx = 1 - target.x;
            val.x = p.lerp(val.x, mx, 0.1); 
            val.y = p.lerp(val.y, target.y, 0.1);
          } else if (now - val.lastSeen > 4000) {
            stateRef.current.delete(id);
          }
        });

        // 3. INTERAKTIVE ANIMATION
        p.noFill();
        for (let y = 0; y <= p.height; y += LINE_SPACING) {
          p.beginShape();
          for (let x = 0; x <= p.width; x += 40) {
            let dxTotal = 0;
            let dyTotal = 0;
            let combinedStrength = 0;

            stateRef.current.forEach((obj) => {
              const ox = obj.x * p.width;
              const oy = obj.y * p.height;
              const dX = x - ox;
              const dY = y - oy;
              const distance = p.sqrt(dX*dX + dY*dY);

              if (distance < FORCE_RADIUS) {
                const s = p.map(distance, 0, FORCE_RADIUS, 1, 0);
                const angle = p.atan2(dY, dX);
                const push = p.pow(s, 2) * 60;
                dxTotal += p.cos(angle) * push;
                dyTotal += p.sin(angle) * push;
                combinedStrength += s;
              }
            });

            const h = p.lerp(190, 260, p.min(combinedStrength, 1));
            const op = p.map(p.min(combinedStrength, 1), 0, 1, 0.2, 0.9);
            p.stroke(h, 80, 100, op);
            p.strokeWeight(p.map(combinedStrength, 0, 1, 1, 5));
            p.curveVertex(x + dxTotal, y + dyTotal);
          }
          p.endShape();
        }

        // 4. VISUELLE MARKER
        stateRef.current.forEach((obj) => {
          const ox = obj.x * p.width;
          const oy = obj.y * p.height;
          p.noStroke();
          p.fill(200, 100, 100, 0.2);
          p.circle(ox, oy, 60);
          p.fill(200, 100, 100, 0.5);
          p.circle(ox, oy, 15);
        });
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    p5Instance.current = new (window as any).p5(sketch);
    return () => p5Instance.current?.remove();
  }, []);

  return null;
};

export default P5Canvas;
