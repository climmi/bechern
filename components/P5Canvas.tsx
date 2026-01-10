
import React, { useEffect, useRef } from 'react';
import { DetectedObject } from '../types';

interface P5CanvasProps {
  objects: DetectedObject[];
}

const P5Canvas: React.FC<P5CanvasProps> = ({ objects }) => {
  const p5Instance = useRef<any>(null);
  const objectsRef = useRef<DetectedObject[]>(objects);
  const stateRef = useRef<Map<string, {x: number, y: number, type: string, active: boolean, lastSeen: number, confidence: number}>>(new Map());

  // Update logic to keep track of objects and their smooth transitions
  useEffect(() => {
    objectsRef.current = objects;
    const now = Date.now();
    objects.forEach(obj => {
      // Mirroring happens in p5 draw loop via scale
      if (!stateRef.current.has(obj.id)) {
        stateRef.current.set(obj.id, { 
          x: obj.x, 
          y: obj.y, 
          type: obj.type,
          active: true, 
          lastSeen: now,
          confidence: obj.confidence
        });
      } else {
        const s = stateRef.current.get(obj.id)!;
        s.active = true;
        s.x = obj.x;
        s.y = obj.y;
        s.type = obj.type;
        s.confidence = obj.confidence;
        s.lastSeen = now;
      }
    });
  }, [objects]);

  useEffect(() => {
    const sketch = (p: any) => {
      let capture: any;
      const LINE_SPACING = 35;
      const FORCE_RADIUS = 250;

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent('p5-container');
        
        // Use native p5 capture for better reliability on Raspberry Pi
        capture = p.createCapture(p.VIDEO);
        capture.size(640, 480);
        capture.hide(); // Hide the raw dom element
        
        p.colorMode(p.HSB, 360, 100, 100, 1);
        p.textFont('monospace');
      };

      p.draw = () => {
        p.background(0);

        // 1. RENDER CAMERA FEED (MIRRORED BACKGROUND)
        if (capture && capture.loadedmetadata) {
          p.push();
          p.translate(p.width, 0);
          p.scale(-1, 1);
          
          let vW = capture.width;
          let vH = capture.height;
          let scale = Math.max(p.width / vW, p.height / vH);
          let nW = vW * scale;
          let nH = vH * scale;
          let offX = (p.width - nW) / 2;
          let offY = (p.height - nH) / 2;
          
          p.tint(255, 0.35); // Dim background for UI visibility
          p.image(capture, offX, offY, nW, nH);
          p.pop();
        }

        const now = Date.now();
        const targetObjects = objectsRef.current;

        // 2. INTERPOLATE STATES & CLEANUP
        stateRef.current.forEach((val, id) => {
          const target = targetObjects.find(o => o.id === id);
          if (target) {
            val.x = p.lerp(val.x, target.x, 0.15); 
            val.y = p.lerp(val.y, target.y, 0.15);
            val.lastSeen = now;
          } else if (now - val.lastSeen > 2000) {
            stateRef.current.delete(id);
          }
        });

        // 3. DRAW DYNAMIC GRID
        p.noFill();
        for (let y = 0; y <= p.height + LINE_SPACING; y += LINE_SPACING) {
          p.beginShape();
          for (let x = -50; x <= p.width + 50; x += 60) {
            let dxTotal = 0;
            let dyTotal = 0;
            let combinedStrength = 0;

            stateRef.current.forEach((obj) => {
              // Note: We mirror the X for visual alignment with the mirrored video
              const ox = (1 - obj.x) * p.width;
              const oy = obj.y * p.height;
              const dX = x - ox;
              const dY = y - oy;
              const distance = p.sqrt(dX*dX + dY*dY);

              if (distance < FORCE_RADIUS) {
                const s = p.map(distance, 0, FORCE_RADIUS, 1, 0);
                const push = p.pow(s, 2) * 60;
                const angle = p.atan2(dY, dX);
                dxTotal += p.cos(angle) * push;
                dyTotal += p.sin(angle) * push;
                combinedStrength += s;
              }
            });

            const hue = p.lerp(200, 280, p.constrain(combinedStrength, 0, 1));
            const opacity = p.map(p.constrain(combinedStrength, 0, 1), 0, 1, 0.1, 0.6);
            
            p.stroke(hue, 80, 100, opacity);
            p.strokeWeight(p.map(p.constrain(combinedStrength, 0, 1), 0, 1, 0.5, 2));
            p.curveVertex(x + dxTotal, y + dyTotal);
          }
          p.endShape();
        }

        // 4. DRAW OBJECT INDICATORS (Bounding Boxes & Labels)
        stateRef.current.forEach((obj) => {
          const ox = (1 - obj.x) * p.width;
          const oy = obj.y * p.height;
          const pulse = p.sin(p.frameCount * 0.1) * 5;
          const size = 120 + pulse;

          p.push();
          p.translate(ox, oy);
          
          // Outer Glow
          p.noFill();
          p.stroke(210, 80, 100, 0.4);
          p.strokeWeight(1);
          p.rect(-size/2, -size/2, size, size, 15);
          
          // Corner Markers
          p.stroke(210, 80, 100, 0.8);
          p.strokeWeight(3);
          const cs = 15; // corner size
          // Top Left
          p.line(-size/2, -size/2, -size/2 + cs, -size/2);
          p.line(-size/2, -size/2, -size/2, -size/2 + cs);
          // Top Right
          p.line(size/2, -size/2, size/2 - cs, -size/2);
          p.line(size/2, -size/2, size/2, -size/2 + cs);
          // Bottom Left
          p.line(-size/2, size/2, -size/2 + cs, size/2);
          p.line(-size/2, size/2, -size/2, size/2 - cs);
          // Bottom Right
          p.line(size/2, size/2, size/2 - cs, size/2);
          p.line(size/2, size/2, size/2, size/2 - cs);

          // Label
          p.fill(210, 80, 100, 0.9);
          p.noStroke();
          p.rect(-size/2, -size/2 - 25, p.textWidth(obj.type.toUpperCase()) + 20, 20, 5);
          p.fill(0);
          p.textSize(10);
          p.textStyle(p.BOLD);
          p.text(obj.type.toUpperCase(), -size/2 + 10, -size/2 - 11);

          // Confidence Bar
          p.stroke(210, 80, 100, 0.3);
          p.line(-size/2, size/2 + 10, size/2, size/2 + 10);
          p.stroke(210, 80, 100, 1);
          p.line(-size/2, size/2 + 10, -size/2 + (size * obj.confidence), size/2 + 10);

          p.pop();
        });
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };
    };

    p5Instance.current = new (window as any).p5(sketch);
    return () => p5Instance.current?.remove();
  }, []); // Only init once, p5 handles its own capture

  return null;
};

export default P5Canvas;
