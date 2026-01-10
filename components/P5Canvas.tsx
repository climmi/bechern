
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
      const particleCount = 80; // Weniger Partikel für stabilere FPS auf RPi

      class Particle {
        x: number; y: number;
        prevX: number; prevY: number;
        speed: number;
        
        constructor() { this.init(); }

        init() {
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.prevX = this.x;
          this.prevY = this.y;
          this.speed = p.random(2, 4);
        }

        update() {
          this.prevX = this.x;
          this.prevY = this.y;

          let vx = this.speed;
          let vy = 0;

          objectsRef.current.forEach(obj => {
            // Da das Video per CSS gespiegelt ist, ist x=0 für TFJS links, 
            // aber für den Nutzer rechts. (1-obj.x) korrigiert das.
            const objX = (1 - obj.x) * p.width; 
            const objY = obj.y * p.height;
            
            const dx = this.x - objX;
            const dy = this.y - objY;
            const distance = p.sqrt(dx * dx + dy * dy);
            const radius = 90;

            if (distance < radius) {
              const force = p.map(distance, 0, radius, 4, 0);
              const angle = p.atan2(dy, dx);
              vx += p.cos(angle) * force * 1.5;
              vy += p.sin(angle) * force * 3;
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
          p.stroke(200, 80, 100, 0.4);
          p.strokeWeight(1);
          p.line(this.prevX, this.prevY, this.x, this.y);
        }
      }

      p.setup = () => {
        // P2D Modus ist auf dem RPi meist stabiler als der Standardmodus
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight, p.P2D);
        canvas.parent('p5-container');
        
        // KRITISCH FÜR RPi: Deaktiviere Retina/HighDPI Skalierung
        p.pixelDensity(1); 
        
        p.colorMode(p.HSB, 360, 100, 100, 1);
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
      };

      p.draw = () => {
        // Klare Strategie: p5 löscht den Hintergrund, das Video liegt darunter
        p.clear(); 
        
        // Hintergrund mit leichter Transparenz für Trails
        p.fill(0, 0, 0, 0.1);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);

        particles.forEach(part => {
          part.update();
          part.draw();
        });

        objectsRef.current.forEach(obj => {
          const objX = (1 - obj.x) * p.width;
          const objY = obj.y * p.height;
          
          p.push();
          p.translate(objX, objY);
          p.noFill();
          p.stroke(190, 100, 100, 0.7);
          p.strokeWeight(1);
          const s = 60 + p.sin(p.frameCount * 0.05) * 5;
          p.ellipse(0, 0, s, s);
          
          p.fill(190, 100, 100, 1);
          p.noStroke();
          p.textSize(10);
          p.textAlign(p.CENTER);
          p.text(obj.type.toUpperCase(), 0, -s/2 - 5);
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
