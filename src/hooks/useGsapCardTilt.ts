"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";

interface TiltOptions {
  maxRotation?: number;
}

export function useGsapCardTilt<T extends HTMLElement>(options: TiltOptions = {}) {
  const cardRef = useRef<T>(null);
  const { maxRotation = 8 } = options;

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Use gsap.quickTo for smooth 60fps damped spring physics
    const xTo = gsap.quickTo(card, "rotateY", { duration: 0.45, ease: "power3.out" });
    const yTo = gsap.quickTo(card, "rotateX", { duration: 0.45, ease: "power3.out" });

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -maxRotation;
      const rotateY = ((x - centerX) / centerX) * maxRotation;

      yTo(rotateX);
      xTo(rotateY);

      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;
      card.style.setProperty("--mouse-x", `${xPercent.toFixed(1)}%`);
      card.style.setProperty("--mouse-y", `${yPercent.toFixed(1)}%`);
    };

    const handleMouseLeave = () => {
      yTo(0);
      xTo(0);
      card.style.setProperty("--mouse-x", "50%");
      card.style.setProperty("--mouse-y", "50%");
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [maxRotation]);

  return cardRef;
}
