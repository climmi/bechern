
import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface P5CanvasProps {
  objects: DetectedObject[];
}

const P5Canvas: React.FC<P5CanvasProps> = ({ objects }) => {
  const p5Instance = useRef<any>(null);
  const objectsRef = useRef<DetectedObject[]>(objects);
  // Ref für flüssige Bewegungs-Interpolation (Lerp)
  const smoothedObjects = useRef<Map<string, {x: number, y: number}>>(new Map());

  useEffect(() => {
    objectsRef.current = objects;
  }, [objects]);

  useEffect(() => {
    const sketch = (p: any) => {
      const LINE_SPACING = 20; // Abstand zwischen den horizontalen Linien
      const RESOLUTION = 10;   // Detailgrad der Linien-Segmente (niedriger = feiner)
      const FORCE_RADIUS = 180; // Einflussbereich der Objekte auf die Linien

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        p.colorMode(p.HSB, 360, 100, 100, 1);
        p.noFill();
      };

      p.draw = () => {
        p.background(0); // Kein Motion Blur hier für schärfere Linien

        const targetObjects = objectsRef.current;
        
        // 1. Interpolation der Positionen für smoothe Bewegungen
        targetObjects.forEach(target => {
          if (!smoothedObjects.current.has(target.id)) {
            smoothedObjects.current.set(target.id, { x: target.x, y: target.y });
          }
          const current = smoothedObjects.current.get(target.id)!;
          current.x = p.lerp(current.x, target.x, 0.1);
          current.y = p.lerp(current.y, target.y, 0.1);
        });

        // Bereinige alte Objekte (einfache Logik: wenn nicht in targetObjects, löschen)
        // In einer Produktion-App würde man hier ein Timeout nutzen
        if (targetObjects.length === 0) {
          smoothedObjects.current.clear();
        }

        // 2. Zeichnen des Linien-Systems
        for (let y = 0; y <= p.height; y += LINE_SPACING) {
          p.beginShape();
          
          // Farbe der Linie
          p.stroke(200, 70, 60, 0.4); 
          p.strokeWeight(1);

          for (let x = 0; x <= p.width; x += RESOLUTION) {
            let offsetX = 0;
            let offsetY = 0;
            let maxDistortion = 0;

            // Prüfe Einfluss jedes Objekts auf diesen Punkt (x, y)
            smoothedObjects.current.forEach((objPos) => {
              const objX = objPos.x * p.width;
              const objY = objPos.y * p.height;
              
              const dx = x - objX;
              const dy = y - objY;
              const distSq = dx * dx + dy * dy;
              const dist = p.sqrt(distSq);

              if (dist < FORCE_RADIUS) {
                // Berechne Abstoßungskraft (Gauß-ähnlich)
                const strength = p.map(dist, 0, FORCE_RADIUS, 1, 0);
                const angle = p.atan2(dy, dx);
                
                // Wir schieben die Linie weg vom Zentrum
                const push = strength * 40; 
                offsetX += p.cos(angle) * push;
                offsetY += p.sin(angle) * push;
                
                if (strength > maxDistortion) maxDistortion = strength;
              }
            });

            // Wenn stark verformt, mache die Linie heller/leuchtender
            if (maxDistortion > 0.1) {
              const hue = p.lerp(200, 180, maxDistortion);
              p.stroke(hue, 80, 100, p.map(maxDistortion, 0, 1, 0.4, 1));
              p.strokeWeight(p.map(maxDistortion, 0, 1, 1, 2.5));
            }

            p.curveVertex(x + offsetX, y + offsetY);
          }
          p.endShape();
        }

        // 3. Optional: Kleiner Kern-Glow für die Objekte selbst
        smoothedObjects.current.forEach((objPos) => {
          const ox = objPos.x * p.width;
          const oy = objPos.y * p.height;
          p.noStroke();
          p.fill(200, 100, 100, 0.1);
          p.circle(ox, oy, 40);
          p.fill(200, 100, 100, 0.3);
          p.circle(ox, oy, 10);
        });
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    // @ts-ignore
    p5Instance.current = new window.p5(sketch);

    return () => {
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
    };
  }, []);

  return null; 
};

export default P5Canvas;
