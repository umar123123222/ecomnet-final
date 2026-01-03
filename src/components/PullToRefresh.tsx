import React from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  threshold?: number;
}

/**
 * Pull-to-refresh wrapper component for mobile views
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className,
  disabled = false,
  threshold = 80,
}) => {
  const { isPulling, isRefreshing, pullDistance, containerRef } = usePullToRefresh({
    onRefresh,
    threshold,
    disabled,
  });

  const progress = Math.min(pullDistance / threshold, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
      style={{ touchAction: isPulling ? 'none' : 'auto' }}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 flex items-center justify-center transition-transform duration-200 z-10',
          showIndicator ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          top: 0,
          height: `${Math.max(pullDistance, isRefreshing ? 48 : 0)}px`,
          transform: `translateY(${isRefreshing ? 0 : -48 + pullDistance}px)`,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 transition-all',
            isRefreshing && 'bg-primary/20'
          )}
          style={{
            transform: `rotate(${progress * 180}deg) scale(${0.8 + progress * 0.2})`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <ArrowDown
              className={cn(
                'h-5 w-5 text-primary transition-transform',
                progress >= 1 && 'text-primary'
              )}
              style={{
                transform: progress >= 1 ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          )}
        </div>
      </div>

      {/* Content with transform during pull */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? 48 : pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
