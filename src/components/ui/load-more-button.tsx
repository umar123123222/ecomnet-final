import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  hasMore?: boolean;
  loadedCount: number;
  totalCount: number;
  className?: string;
  itemName?: string;
}

export const LoadMoreButton = memo(({
  onClick,
  isLoading = false,
  hasMore = true,
  loadedCount,
  totalCount,
  className,
  itemName = 'items',
}: LoadMoreButtonProps) => {
  if (!hasMore || loadedCount >= totalCount) return null;

  const remaining = totalCount - loadedCount;

  return (
    <div className={cn("flex flex-col items-center gap-2 py-4", className)}>
      <Button
        variant="outline"
        onClick={onClick}
        disabled={isLoading}
        className="w-full max-w-xs active:scale-95 transition-transform touch-manipulation"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4 mr-2" />
            Load More
          </>
        )}
      </Button>
      <span className="text-xs text-muted-foreground">
        Showing {loadedCount.toLocaleString()} of {totalCount.toLocaleString()} {itemName}
        {remaining > 0 && ` (${remaining.toLocaleString()} more)`}
      </span>
    </div>
  );
});

LoadMoreButton.displayName = 'LoadMoreButton';
