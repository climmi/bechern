
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
    const sketch = (p: any) => {
      let particles: Particle[] = [];
      const particleCount = 150; // Anzahl der fließenden Linien

      class Particle {
        x: number;
        y: number;
        prevX: number;
        prevY: number;
        speed: number;
        hue: number;

        constructor() {
          this.init();
        }

        init() {
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.prevX = this.x;
          this.prevY = this.y;
          this.speed = p.random(2, 5);
          this.hue = p.random(190, 220); // Blau-Töne
        }

        update() {
          this.prevX = this.x;
          this.prevY = this.y;

          // Grundbewegung von links nach rechts
          let vx = this.speed;
          let vy = 0;

          // Umströmungs-Logik für jedes Objekt
          objectsRef.current.forEach(obj => {
            // Umkehrung von X wegen Projektions-Spiegelung
            const objX = (1 - obj.x) * p.width;
            const objY = obj.y * p.height;
            
            const dx = this.x - objX;
            const dy = this.y - objY;
            const distance = p.sqrt(dx * dx + dy * dy);
            const radius = 100; // Bereich des Umströmens

            if (distance < radius) {
              // Kraft berechnen (Abstoßung)
              const force = p.map(distance, 0, radius, 2.5, 0);
              const angle = p.atan2(dy, dx);
              
              vx += p.cos(angle) * force * 5;
              vy += p.sin(angle) * force * 5;
            }
          });

          this.x += vx;
          this.y += vy;

          // Wenn Partikel den Bildschirm verlässt, links neu starten
          if (this.x > p.width) {
            this.x = 0;
            this.prevX = 0;
            this.y = p.random(p.height);
            this.prevY = this.y;
          }
          if (this.y < 0 || this.y > p.height) {
            this.init();
            this.x = 0;
            this.prevX = 0;
          }
        }

        draw() {
          p.stroke(this.hue, 80, 100, 0.4);
          p.strokeWeight(2);
          p.line(this.prevX, this.prevY, this.x, this.y);
        }
      }

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
        
        for (let i = 0; i < particleCount; i++) {
          particles.push(new Particle());
        }
      };

      p.draw = () => {
        // Subtiler Trail-Effekt für flüssige Bewegung
        p.fill(0, 0, 0, 0.15);
        p.noStroke();
        p.rect(0, 0, p.width, p.height);

        // Grid im Hintergrund
        p.stroke(210, 50, 100, 0.05);
        p.strokeWeight(1);
        for(let x = 0; x < p.width; x += 80) p.line(x, 0, x, p.height);

        // Partikel aktualisieren und zeichnen
        particles.forEach(part => {
          part.update();
          part.draw();
        });

        // Highlights auf den Objekten zeichnen
        objectsRef.current.forEach(obj => {
          const objX = (1 - obj.x) * p.width;
          const objY = obj.y * p.height;
          
          p.push();
          p.translate(objX, objY);
          
          // Digitaler Kern des Objekts
          p.noFill();
          p.stroke(200, 100, 100, 0.8);
          p.strokeWeight(1);
          p.ellipse(0, 0, 20, 20);
          
          // Ecken-Markierung
          p.stroke(200, 100, 100, 0.5);
          const s = 40;
          p.line(-s, -s, -s+10, -s); p.line(-s, -s, -s, -s+10);
          p.line(s, s, s-10, s); p.line(s, s, s, s-10);

          p.fill(200, 100, 100, 0.8);
          p.noStroke();
          p.textSize(10);
          p.text(obj.type.toUpperCase(), -s, -s - 5);
          
          p.pop();
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
