"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 to `end` over `duration` ms with smoothstep easing.
 */
export function useCountUp(end: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (end === 0) {
      setValue(0);
      return;
    }

    const startTime = performance.now();
    let prev = -1;

    function step(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = t * t * (3 - 2 * t);
      const next = Math.round(eased * end);
      if (next !== prev) {
        prev = next;
        setValue(next);
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration]);

  return value;
}
