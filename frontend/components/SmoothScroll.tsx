'use client';

import { useEffect } from "react";

import Lenis from "lenis";

export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      lerp: 0.085,
      smoothWheel: true,
      syncTouch: true,
      wheelMultiplier: 0.9,
    });

    let frameId = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      frameId = window.requestAnimationFrame(raf);
    };

    frameId = window.requestAnimationFrame(raf);

    return () => {
      window.cancelAnimationFrame(frameId);
      lenis.destroy();
    };
  }, []);

  return null;
}
