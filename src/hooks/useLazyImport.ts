import { lazy, ComponentType } from 'react';

// Lazy load heavy components
export const LazyScanner = lazy(() => import('@/components/Scanner').then(m => ({ default: m.Scanner })));

// Lazy load heavy pages
export const LazyPOSMain = lazy(() => import('@/pages/POS/POSMain'));
export const LazyProductionDashboard = lazy(() => import('@/pages/Production/ProductionDashboard'));
export const LazyBOMManagement = lazy(() => import('@/pages/Production/BOMManagement'));
export const LazyStockAuditDashboard = lazy(() => import('@/pages/StockAudit/StockAuditDashboard'));

// Helper to create lazy component with preload
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFn);
  
  // Attach preload function for prefetching
  (LazyComponent as any).preload = importFn;
  
  return LazyComponent;
}

// Preload function for route prefetching
export function preloadRoute(importFn: () => Promise<any>) {
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => importFn());
    } else {
      setTimeout(() => importFn(), 100);
    }
  }
}
