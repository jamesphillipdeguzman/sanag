import { useState, useEffect } from 'react';

/**
 * Lightweight hook providing a simulated active telemetry/observer node counter
 * fluctuating naturally between `min` and `max` nodes.
 */
export function useLiveCounter(initial: number = 16, min: number = 12, max: number = 18): number {
  const [nodes, setNodes] = useState<number>(initial);

  useEffect(() => {
    const updateNodeCount = () => {
      setNodes((current) => {
        // Natural jitter of -1, 0, or +1
        const delta = Math.floor(Math.random() * 3) - 1;
        const next = current + delta;
        if (next < min) return min;
        if (next > max) return max;
        return next;
      });
    };

    const interval = setInterval(updateNodeCount, 9000);
    return () => clearInterval(interval);
  }, [min, max]);

  return nodes;
}
