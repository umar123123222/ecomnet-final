
import { useEffect, useRef } from 'react';

interface PerformanceMetrics {
  componentName: string;
  mountTime: number;
  renderCount: number;
}

export const usePerformanceLogger = (componentName: string) => {
  const mountTime = useRef<number>(Date.now());
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderCount.current += 1;
    
    if (renderCount.current === 1) {
      // Log first render time
      const renderTime = Date.now() - mountTime.current;
      console.log(`[Performance] ${componentName} mounted in ${renderTime}ms`);
    }
  });

  return {
    logRender: () => {
      console.log(`[Performance] ${componentName} rendered (count: ${renderCount.current})`);
    },
    getRenderCount: () => renderCount.current,
  };
};

export const useWebVitals = () => {
  useEffect(() => {
    // Check if the browser supports the Performance Observer API
    if ('PerformanceObserver' in window) {
      // Observe largest contentful paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log(`[WebVitals] LCP: ${lastEntry.startTime.toFixed(2)}ms`);
      });

      // Observe first input delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          console.log(`[WebVitals] FID: ${entry.processingStart - entry.startTime}ms`);
        });
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // Fallback for older browsers
        console.log('[WebVitals] Performance Observer not fully supported');
      }

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
      };
    }
  }, []);
};
