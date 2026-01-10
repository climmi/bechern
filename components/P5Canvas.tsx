
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
      const particleCount = 60; // Weiter reduziert für RPi Stabilität

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
          this.speed = p.random(1.5, 3.5);
        }

        update() {
          this.prevX = this.x;
          this.prevY = this.y;

          let vx = this.speed;
          let vy = 0;

          objectsRef.current.forEach(obj => {
            // Video ist scaleX(-1), daher Korrektur der X-Achse
            const objX = (1 - obj.x) * p.width; 
            const objY = obj.y * p.height;
            
            const dx = this.x - objX;
            const dy = this.y - objY;
            const distance = p.sqrt(dx * dx + dy * dy);
            const radius = 80;

            if (distance < radius) {
              const force = p.map(distance, 0, radius, 3, 0);
              const angle = p.atan2(dy, dx);
              vx += p.cos(angle) * force;
              vy += p.sin(angle) * force * 2;
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
        }

        draw() {
          p.stroke(180, 70, 100, 0.5);
          p.strokeWeight(2);
          p.line(this.prevX, this.prevY, this.x, this.y);
        }
      }

      p.setup = () => {
        // Standard-Renderer (2D Canvas API) ist auf dem RPi oft stabiler
        // als P2D (WebGL) wenn ein Video-Element darunter liegt.
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.pixelDensity(1); 
        p.colorMode(p.HSB, 360, 100, 100, 1);
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
      };

      p.draw = () => {
        // p.clear() macht den Canvas transparent, damit das Video sichtbar bleibt
        p.clear(); 
        
        // Da wir kein p.background() nutzen können (da es opacity nicht im clear-Sinne unterstützt),
        // zeichnen wir die Partikel direkt. Falls "Trails" gewünscht sind, müssten wir
        // einen zweiten Offscreen-Canvas nutzen, was den RPi aber überlastet.
        
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
          p.stroke(200, 100, 100, 0.8);
          p.strokeWeight(2);
          p.ellipse(0, 0, 60, 60);
          
          p.fill(200, 100, 100, 1);
          p.noStroke();
          p.textSize(12);
          p.text(obj.type.toUpperCase(), 10, -35);
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
