
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
      let particles: Particle[] = [];
      const particleCount = 40;

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
          this.speed = p.random(1, 3);
        }

        update() {
          this.prevX = this.x;
          this.prevY = this.y;
          let vx = this.speed;
          let vy = 0;

          objectsRef.current.forEach(obj => {
            const objX = (1 - obj.x) * p.width; 
            const objY = obj.y * p.height;
            const dx = this.x - objX;
            const dy = this.y - objY;
            const distance = p.sqrt(dx * dx + dy * dy);
            if (distance < 100) {
              const angle = p.atan2(dy, dx);
              vx += p.cos(angle) * 4;
              vy += p.sin(angle) * 4;
            }
          });

          this.x += vx;
          this.y += vy;
          if (this.x > p.width) this.init();
        }

        draw() {
          p.stroke(200, 100, 100, 0.4);
          p.strokeWeight(1.5);
          p.line(this.prevX, this.prevY, this.x, this.y);
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.pixelDensity(1); 
        p.colorMode(p.HSB, 360, 100, 100, 1);
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
      };

      p.draw = () => {
        p.background(5, 5, 5); // Fast schwarz

        // KRITISCH: Zeichne das Video direkt in den p5-Canvas
        // Das umgeht alle Overlay-Probleme des Browsers
        if (videoRef.current && videoRef.current.readyState >= 2) {
          p.push();
          p.translate(p.width, 0);
          p.scale(-1, 1); // Spiegeln
          // Zeichne das Videobild
          p.image(videoRef.current, 0, 0, p.width, p.height);
          p.pop();
          
          // Verdunkle das Video etwas für bessere Sichtbarkeit der UI
          p.fill(0, 0, 0, 0.4);
          p.rect(0, 0, p.width, p.height);
        }

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
          p.ellipse(0, 0, 80, 80);
          
          p.fill(0, 0, 100, 1);
          p.noStroke();
          p.textSize(14);
          p.textStyle(p.BOLD);
          p.text(obj.type.toUpperCase(), 10, -45);
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
