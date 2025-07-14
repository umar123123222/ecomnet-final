
// Performance optimization utilities

// Debounce function for search inputs and API calls
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function for scroll events and resize handlers
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Lazy loading utility for images
export const lazyLoadImage = (img: HTMLImageElement, src: string) => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          img.src = src;
          img.classList.remove('lazy');
          observer.unobserve(img);
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(img);
};

// Resource preloading utilities
export const preloadRoute = (routeModule: () => Promise<any>) => {
  if (typeof window !== 'undefined') {
    // Use requestIdleCallback if available, otherwise fallback to setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => routeModule());
    } else {
      setTimeout(() => routeModule(), 100);
    }
  }
};

// Memory cleanup utility
export const createCleanupManager = () => {
  const cleanupTasks: (() => void)[] = [];
  
  return {
    addCleanup: (task: () => void) => {
      cleanupTasks.push(task);
    },
    cleanup: () => {
      cleanupTasks.forEach(task => {
        try {
          task();
        } catch (error) {
          // Cleanup task failed silently in production
        }
      });
      cleanupTasks.length = 0;
    }
  };
};

// Bundle size analyzer helper (removed for production optimization)
