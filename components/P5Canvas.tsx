
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
    if (!isReady) return;

    const sketch = (p: any) => {
      let particles: any[] = [];
      const numParticles = 100;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
        
        for (let i = 0; i < numParticles; i++) {
          particles.push({
            pos: p.createVector(p.random(p.width), p.random(p.height)),
            vel: p.createVector(p.random(-1, 1), p.random(-1, 1)),
            acc: p.createVector(0, 0),
            maxSpeed: 3,
            hue: p.random(180, 240)
          });
        }
      };

      p.draw = () => {
        p.clear(); // Erhält Transparenz für das darunterliegende Video

        particles.forEach(pt => {
          // Flow-Verhalten (Noise)
          let angle = p.noise(pt.pos.x * 0.005, pt.pos.y * 0.005, p.frameCount * 0.01) * p.TWO_PI * 2;
          /* Fix: Use (window as any).p5.Vector.fromAngle or p.constructor.Vector.fromAngle if global p5 is available, 
             but typically in instance mode we use the instance's createVector or static calls on the library. 
             Since p5 is a global variable from the script tag in this context: */
          let steer = (window as any).p5.Vector.fromAngle(angle);
          steer.setMag(0.1);
          pt.acc.add(steer);

          // Reaktion auf Objekte
          objectsRef.current.forEach(obj => {
            const objX = obj.x * p.width;
            const objY = obj.y * p.height;
            const target = p.createVector(objX, objY);
            
            /* Fix: Use the p5 global class for static Vector methods */
            const dist = (window as any).p5.Vector.dist(pt.pos, target);
            
            if (dist < 150) {
              /* Fix: Use the p5 global class for static Vector methods */
              let diff = (window as any).p5.Vector.sub(pt.pos, target);
              diff.normalize();
              diff.mult(0.5);
              pt.acc.add(diff);
              pt.maxSpeed = 6;
            } else {
              pt.maxSpeed = 3;
            }
          });

          pt.vel.add(pt.acc);
          pt.vel.limit(pt.maxSpeed);
          pt.pos.add(pt.vel);
          pt.acc.mult(0);

          // Screen Wrap
          if (pt.pos.x < 0) pt.pos.x = p.width;
          if (pt.pos.x > p.width) pt.pos.x = 0;
          if (pt.pos.y < 0) pt.pos.y = p.height;
          if (pt.pos.y > p.height) pt.pos.y = 0;

          // Zeichnen
          p.stroke(pt.hue, 80, 100, 0.8);
          p.strokeWeight(3);
          p.point(pt.pos.x, pt.pos.y);
        });

        // Debug Marker (Sichtbar machen, ob die AI überhaupt etwas sieht)
        objectsRef.current.forEach(obj => {
          const objX = obj.x * p.width;
          const objY = obj.y * p.height;
          p.noFill();
          p.stroke(45, 100, 100, 0.8); // Orange/Gelb
          p.strokeWeight(2);
          p.rectMode(p.CORNER);
          p.circle(objX, objY, 60);
          p.noStroke();
          p.fill(255);
          p.textSize(16);
          p.text(obj.type, objX + 35, objY);
        });
      };

      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);
    };

    const inst = new (window as any).p5(sketch);
    p5Instance.current = inst;
    
    return () => inst.remove();
  }, [isReady]);

  return <div id="p5-container" className="fixed inset-0 z-10 pointer-events-none" />;
};

export default P5Canvas;
