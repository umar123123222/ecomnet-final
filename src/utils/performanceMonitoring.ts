// Performance monitoring utilities
import * as React from 'react';

interface PerformanceMetrics {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS = 100;

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Mark the start of an operation
  public mark(name: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`${name}-start`);
    }
  }

  // Measure and record the duration of an operation
  public measure(name: string): number | null {
    if (typeof performance !== 'undefined') {
      try {
        performance.mark(`${name}-end`);
        const measure = performance.measure(name, `${name}-start`, `${name}-end`);
        
        this.metrics.push({
          name,
          duration: measure.duration,
          timestamp: Date.now(),
        });

        // Keep only the most recent metrics
        if (this.metrics.length > this.MAX_METRICS) {
          this.metrics.shift();
        }

        // Clean up marks
        performance.clearMarks(`${name}-start`);
        performance.clearMarks(`${name}-end`);
        performance.clearMeasures(name);

        return measure.duration;
      } catch (error) {
        console.warn('Performance measurement failed:', error);
        return null;
      }
    }
    return null;
  }

  // Get all recorded metrics
  public getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  // Get average duration for a specific operation
  public getAverageDuration(name: string): number | null {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return null;
    
    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return sum / filtered.length;
  }

  // Clear all metrics
  public clearMetrics(): void {
    this.metrics = [];
  }

  // Log slow operations (threshold in ms)
  public logSlowOperations(threshold: number = 1000): void {
    const slow = this.metrics.filter(m => m.duration > threshold);
    if (slow.length > 0) {
      console.warn('Slow operations detected:', slow);
    }
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// HOC to monitor component render time
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    performanceMonitor.mark(`${componentName}-render`);
    
    React.useEffect(() => {
      const duration = performanceMonitor.measure(`${componentName}-render`);
      if (duration && duration > 100) {
        console.warn(`${componentName} took ${duration}ms to render`);
      }
    });

    return React.createElement(Component, props);
  };
  
  return WrappedComponent;
}

// Hook to track component lifecycle
export function usePerformanceTracking(componentName: string) {
  React.useEffect(() => {
    performanceMonitor.mark(`${componentName}-mount`);
    
    return () => {
      performanceMonitor.measure(`${componentName}-mount`);
    };
  }, [componentName]);
}

// Async operation wrapper with performance tracking
export async function trackAsyncOperation<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  performanceMonitor.mark(name);
  try {
    const result = await operation();
    const duration = performanceMonitor.measure(name);
    
    if (duration && duration > 2000) {
      console.warn(`Slow async operation ${name}: ${duration}ms`);
    }
    
    return result;
  } catch (error) {
    performanceMonitor.measure(name);
    throw error;
  }
}
