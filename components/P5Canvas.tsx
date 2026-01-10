
import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface P5CanvasProps {
  objects: DetectedObject[];
  videoElement: HTMLVideoElement | null;
  isReady: boolean;
}

const P5Canvas: React.FC<P5CanvasProps> = ({ objects }) => {
  const p5Instance = useRef<any>(null);
  const objectsRef = useRef<DetectedObject[]>([]);

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    const sketch = (p: any) => {
      let particles: Particle[] = [];
      const particleCount = 200;

      class Particle {
        x: number; y: number;
        prevX: number; prevY: number;
        speed: number; hue: number;
        
        constructor() { this.init(); }

        init() {
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.prevX = this.x;
          this.prevY = this.y;
          this.speed = p.random(3, 7);
          this.hue = p.random(180, 230);
        }

        update() {
          this.prevX = this.x;
          this.prevY = this.y;

          let vx = this.speed;
          let vy = 0;

          objectsRef.current.forEach(obj => {
            // Da das CSS alles spiegelt, nutzen wir hier die direkten 
            // normalisierten Koordinaten (x: 0 ist links im Video)
            const objX = obj.x * p.width;
            const objY = obj.y * p.height;
            
            const dx = this.x - objX;
            const dy = this.y - objY;
            const distance = p.sqrt(dx * dx + dy * dy);
            const radius = 120;

            if (distance < radius) {
              const force = p.map(distance, 0, radius, 4, 0);
              const angle = p.atan2(dy, dx);
              vx += p.cos(angle) * force * 3;
              vy += p.sin(angle) * force * 8; // Stärkeres vertikales Ausweichen
            }
          });

          this.x += vx;
          this.y += vy;

          if (this.x > p.width) {
            this.x = 0;
            this.prevX = 0;
            this.y = p.random(p.height);
            this.prevY = this.y;
          }
          if (this.y < 0 || this.y > p.height) {
            this.init();
            this.x = 0;
          }
        }

        draw() {
          p.stroke(this.hue, 90, 100, 0.6);
          p.strokeWeight(2);
          p.line(this.prevX, this.prevY, this.x, this.y);
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
      };

      p.draw = () => {
        // Erhöhte Opazität für bessere Sichtbarkeit bei Projektion
        p.background(0, 0, 0, 0.1); 

        particles.forEach(part => {
          part.update();
          part.draw();
        });

        // UI-Overlays für getrackte Objekte
        objectsRef.current.forEach(obj => {
          const objX = obj.x * p.width;
          const objY = obj.y * p.height;
          
          p.push();
          p.translate(objX, objY);
          
          // Glühender Ring
          p.noFill();
          p.stroke(200, 100, 100, 0.8);
          p.strokeWeight(2);
          const s = 60 + p.sin(p.frameCount * 0.1) * 5;
          p.ellipse(0, 0, s, s);
          
          // Label (Text muss zurück-gespiegelt werden, damit er lesbar ist!)
          p.scale(-1, 1); // Text-Spiegelung korrigieren
          p.fill(200, 100, 100, 0.9);
          p.noStroke();
          p.textAlign(p.CENTER);
          p.textSize(12);
          p.text(obj.type.toUpperCase(), 0, -s/2 - 10);
          p.pop();
        });
      };

      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    p5Instance.current = new (window as any).p5(sketch);
    return () => p5Instance.current?.remove();
  }, []);

  return null;
};

export default P5Canvas;
