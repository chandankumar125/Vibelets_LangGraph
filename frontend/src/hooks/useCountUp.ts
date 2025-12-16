import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
  decimals?: number;
}

export const useCountUp = (
  target: number,
  options: UseCountUpOptions = {}
): number => {
  const { duration = 1500, delay = 0, decimals = 0 } = options;
  const [count, setCount] = useState(0);
  const previousTarget = useRef(target);
  const startTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousTarget.current;
    previousTarget.current = target;
    startTime.current = null;

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!startTime.current) startTime.current = timestamp;
        const progress = Math.min((timestamp - startTime.current) / duration, 1);
        
        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (target - startValue) * easeOut;
        
        setCount(Number(currentValue.toFixed(decimals)));

        if (progress < 1) {
          animationFrame.current = requestAnimationFrame(animate);
        }
      };

      animationFrame.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [target, duration, delay, decimals]);

  return count;
};

export const formatMetricValue = (
  value: number,
  format: 'currency' | 'percentage' | 'number'
): string => {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return value.toLocaleString('en-US');
    default:
      return String(value);
  }
};

export const calculateTrendPercentage = (current: number, previous: number): string => {
  if (previous === 0) return 'New';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
};
