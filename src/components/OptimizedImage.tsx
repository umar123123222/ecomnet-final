
import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  loading = 'lazy',
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNMTIgMkE2IDYgMCAwIDAgNiA4djhBNiA2IDAgMCAwIDEyIDIyaDhBNiA2IDAgMCAwIDIyIDEyVjRBNiA2IDAgMCAwIDEyIDJaIiBmaWxsPSIjZjNmNGY2Ii8+CiAgPHBhdGggZD0iTTEyIDZBNiA2IDAgMCAwIDYgMTJ2OEE2IDYgMCAwIDAgMTIgMjJoOEE2IDYgMCAwIDAgMjIgMTJWNEE2IDYgMCAwIDAgMTIgNloiIGZpbGw9IiNlNWU3ZWIiLz4KPC9zdmc+'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoaded(true);
  }, []);

  if (hasError) {
    return (
      <div 
        className={cn(
          "bg-gray-100 flex items-center justify-center text-gray-400 text-sm",
          className
        )}
        style={{ width, height }}
      >
        Failed to load
      </div>
    );
  }

  return (
    <div className="relative">
      {!isLoaded && (
        <img
          src={placeholder}
          alt=""
          className={cn("absolute inset-0 blur-sm", className)}
          style={{ width, height }}
        />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        width={width}
        height={height}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        decoding="async"
      />
    </div>
  );
};
