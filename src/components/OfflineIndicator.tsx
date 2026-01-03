import React, { useState, useEffect, useCallback } from 'react';
import { WifiOff, RefreshCw, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ className }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      // Hide the reconnected message after 3 seconds
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      // Attempt to fetch a small resource to check connectivity
      await fetch('/favicon.ico', { cache: 'no-store', mode: 'no-cors' });
      if (navigator.onLine) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      }
    } catch {
      // Still offline
    } finally {
      setIsRetrying(false);
    }
  }, []);

  // Don't render anything if online and not showing reconnected message
  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium transition-all duration-300 animate-slide-up",
        isOnline
          ? "bg-success text-success-foreground"
          : "bg-destructive text-destructive-foreground",
        className
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You're offline</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRetry}
            disabled={isRetrying}
            className="ml-2 h-7 px-3 text-xs bg-white/20 hover:bg-white/30 text-current border-none active:scale-95 transition-transform"
          >
            {isRetrying ? (
              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Retry
          </Button>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
