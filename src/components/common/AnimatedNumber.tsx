import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  fallback?: string;
  enabled?: boolean;
  className?: string;
}

export function AnimatedNumber({ value, suffix = "", fallback, enabled = true, className }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (!enabled || reduceMotion) {
      setDisplayValue(value);
      return;
    }
    const startValue = displayValue;
    const difference = value - startValue;
    const startedAt = performance.now();
    const duration = 650;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + difference * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // displayValue is intentionally captured as the animation starting point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reduceMotion, value]);

  return <span className={className}>{enabled ? `${displayValue}${suffix}` : fallback}</span>;
}
