
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
      // Performance logging removed for production
    }
  });

  return {
    logRender: () => {
      // Performance logging removed for production
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
        // WebVitals logging removed for production
      });

      // Observe first input delay with proper typing
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          // Type guard to check if entry has processingStart property
          if ('processingStart' in entry && 'startTime' in entry) {
            const fidEntry = entry as PerformanceEventTiming;
            // WebVitals logging removed for production
          }
        });
      });

      try {
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // Fallback for older browsers
        // Performance Observer not supported warning removed
      }

      return () => {
        lcpObserver.disconnect();
        fidObserver.disconnect();
      };
    }
  }, []);
};
