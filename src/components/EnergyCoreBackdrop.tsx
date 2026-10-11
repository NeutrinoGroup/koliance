"use client";

import React, { useEffect, useRef } from "react";

interface EnergyCoreBackdropProps {
  className?: string;
  blurAmount?: number; // In pixels, default: 5 (crisp 3D facet definition with soft bloom)
  opacity?: number; // 0 to 1, default: 0.68
  size?: number; // Core radius scale, default: 210
}

/**
 * EnergyCoreBackdrop — 3D Crystalline Amethyst Atom Core and Orbital Rings
 * Rendered onto HTML5 Canvas with hardware-accelerated subtle depth bloom.
 * Serves as an atmospheric ambient backdrop layer behind Hero typography and controls.
 */
export function EnergyCoreBackdrop({
  className = "",
  blurAmount = 5,
  opacity = 0.68,
  size = 210,
}: EnergyCoreBackdropProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = container.clientWidth || 800);
    let height = (canvas.height = container.clientHeight || 500);

    const handleResize = () => {
      if (!canvas || !container) return;
      width = canvas.width = container.clientWidth || 800;
      height = canvas.height = container.clientHeight || 500;
    };
    window.addEventListener("resize", handleResize);

    // 3D Vertices for a multifaceted geodesic crystal core (Icosahedron)
    const phi = (1 + Math.sqrt(5)) / 2;
    const radius = Math.min(width * 0.28, height * 0.36, size);

    // 12 base icosahedron vertices
    const rawVertices: Array<[number, number, number]> = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
    ];

    // Normalize and scale to radius
    const vertices: Array<[number, number, number]> = rawVertices.map(([x, y, z]) => {
      const len = Math.sqrt(x * x + y * y + z * z);
      return [(x / len) * radius, (y / len) * radius, (z / len) * radius];
    });

    // 20 triangular faces of the icosahedron
    const faces: Array<[number, number, number]> = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    // Unique edges
    const edgeSet = new Set<string>();
    const edges: Array<[number, number]> = [];
    faces.forEach(([a, b, c]) => {
      [[a, b], [b, c], [c, a]].forEach(([p1, p2]) => {
        const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push([p1, p2]);
        }
      });
    });

    // Orbital particles along 3 multi-axis plasma rings
    const ringParticles: Array<{
      ring: number;
      angle: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    const ringColors = [
      "#ffffff",
      "#00F2FE",
      "#38bdf8",
      "#a855f7",
      "#836EF9",
      "#c084fc",
    ];

    for (let i = 0; i < 140; i++) {
      ringParticles.push({
        ring: i % 3,
        angle: (i / 35) * Math.PI * 2 + Math.random() * 0.2,
        speed: 0.007 + (i % 3) * 0.003 + Math.random() * 0.002,
        size: Math.random() * 2.5 + 1.2,
        color: ringColors[i % ringColors.length],
      });
    }

    // Background floating stardust particles
    const bgStars: Array<{ x: number; y: number; s: number; a: number; da: number }> = [];
    for (let i = 0; i < 35; i++) {
      bgStars.push({
        x: Math.random(),
        y: Math.random(),
        s: Math.random() * 1.6 + 0.6,
        a: Math.random() * 0.5 + 0.2,
        da: 0.004 * (Math.random() > 0.5 ? 1 : -1),
      });
    }

    let rotX = 0.25;
    let rotY = 0;
    let rotZ = 0.1;
    let mouseTiltX = 0;
    let mouseTiltY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseTiltX = (e.clientX - cx) * 0.00025;
      mouseTiltY = (e.clientY - cy) * 0.00025;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let isVisible = true;
    let animationId: number;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible;
        isVisible = entry.isIntersecting;
        if (!wasVisible && isVisible) {
          cancelAnimationFrame(animationId);
          animationId = requestAnimationFrame(render);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    const ringConfigs = [
      { tiltX: 1.15, tiltZ: 0.35, rx: radius * 1.9, ry: radius * 0.65 },
      { tiltX: -0.85, tiltZ: 0.65, rx: radius * 2.2, ry: radius * 0.75 },
      { tiltX: 0.45, tiltZ: -0.95, rx: radius * 2.45, ry: radius * 0.82 },
    ];

    const render = () => {
      if (!isVisible) return;

      ctx.clearRect(0, 0, width, height);

      rotX += 0.0035 + mouseTiltY * 0.04;
      rotY += 0.006 + mouseTiltX * 0.04;
      rotZ += 0.0012;

      const centerX = width / 2;
      const centerY = height / 2;

      // 1. Subtle background stardust
      for (const star of bgStars) {
        star.a += star.da;
        if (star.a > 0.75 || star.a < 0.2) star.da = -star.da;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.a})`;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Ambient Nebula Halo
      const outerHalo = ctx.createRadialGradient(
        centerX,
        centerY,
        10,
        centerX,
        centerY,
        radius * 3.0
      );
      outerHalo.addColorStop(0, "rgba(131, 110, 249, 0.42)");
      outerHalo.addColorStop(0.3, "rgba(0, 242, 254, 0.2)");
      outerHalo.addColorStop(0.65, "rgba(131, 110, 249, 0.07)");
      outerHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = outerHalo;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 3.0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Project 3D vertices
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);

      const projected = vertices.map(([x, y, z]) => {
        const x1 = x * cosY + z * sinY;
        const y1 = y;
        const z1 = -x * sinY + z * cosY;

        const x2 = x1;
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;

        const x3 = x2 * cosZ - y2 * sinZ;
        const y3 = x2 * sinZ + y2 * cosZ;
        const z3 = z2;

        const scale = 480 / (480 + z3);
        return {
          x: centerX + x3 * scale,
          y: centerY + y3 * scale,
          z: z3,
        };
      });

      // 4. Draw Faceted Crystal Polygons (Depth sorted)
      const sortedFaces = faces
        .map(([ia, ib, ic]) => {
          const pa = projected[ia];
          const pb = projected[ib];
          const pc = projected[ic];
          const avgZ = (pa.z + pb.z + pc.z) / 3;
          return { pa, pb, pc, avgZ };
        })
        .sort((a, b) => a.avgZ - b.avgZ);

      for (const face of sortedFaces) {
        const { pa, pb, pc, avgZ } = face;
        const normZ = (avgZ + radius) / (radius * 2);

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.lineTo(pc.x, pc.y);
        ctx.closePath();

        const fillAlpha = Math.max(0.12, normZ * 0.42);
        ctx.fillStyle = `rgba(131, 110, 249, ${fillAlpha})`;
        ctx.fill();

        ctx.strokeStyle = `rgba(192, 132, 252, ${Math.max(0.2, normZ * 0.65)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // 5. Draw Glowing Crystal Edges
      for (const [i, j] of edges) {
        const p1 = projected[i];
        const p2 = projected[j];
        const avgZ = (p1.z + p2.z) / 2;
        const alpha = Math.max(0.22, ((avgZ + radius) / (radius * 2)) * 0.85);

        ctx.strokeStyle = `rgba(167, 139, 250, ${alpha})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }

      // 6. Draw Crystal Node Vertices
      for (const p of projected) {
        const alpha = Math.max(0.25, (p.z + radius) / (radius * 2));
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 242, 254, ${alpha})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }

      // 7. Core Nuclear Flare
      const coreFlare = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.05
      );
      coreFlare.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      coreFlare.addColorStop(0.12, "rgba(255, 255, 255, 0.9)");
      coreFlare.addColorStop(0.28, "rgba(0, 242, 254, 0.8)");
      coreFlare.addColorStop(0.48, "rgba(131, 110, 249, 0.6)");
      coreFlare.addColorStop(0.75, "rgba(131, 110, 249, 0.18)");
      coreFlare.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreFlare;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // 8. Draw 3 Multi-Axis Orbital Plasma Rings
      for (let r = 0; r < ringConfigs.length; r++) {
        const ring = ringConfigs[r];
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(rotY * 0.35 + ring.tiltZ);
        ctx.scale(1, ring.tiltX > 0 ? 0.38 : -0.38);

        ctx.beginPath();
        ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(131, 110, 249, 0.22)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 9. Draw Radiant Ring Particles & Plasma Trails
      for (const p of ringParticles) {
        p.angle += p.speed;
        const ring = ringConfigs[p.ring];
        const rawX = Math.cos(p.angle) * ring.rx;
        const rawY = Math.sin(p.angle) * ring.ry;

        const ringAngle = rotY * 0.35 + ring.tiltZ;
        const scaledY = rawY * (ring.tiltX > 0 ? 0.38 : -0.38);

        const px = centerX + rawX * Math.cos(ringAngle) - scaledY * Math.sin(ringAngle);
        const py = centerY + rawX * Math.sin(ringAngle) + scaledY * Math.cos(ringAngle);

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={`relative pointer-events-none select-none transform-gpu ${className}`}
      style={{
        filter: `blur(${blurAmount}px)`,
        opacity,
        willChange: "transform, filter",
      }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
