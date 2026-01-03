import React, { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobilePaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const MobilePagination = memo(({
  page,
  totalPages,
  totalCount,
  onPageChange,
  className,
}: MobilePaginationProps) => {
  if (totalPages <= 1) return null;

  const canGoPrev = page > 0;
  const canGoNext = page < totalPages - 1;

  return (
    <div className={cn("flex items-center justify-between gap-2 py-3 px-1", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={!canGoPrev}
        className="flex-1 max-w-[100px] active:scale-95 transition-transform"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </Button>

      <div className="flex flex-col items-center text-center min-w-0">
        <span className="text-sm font-medium text-foreground">
          {page + 1} / {totalPages}
        </span>
        <span className="text-xs text-muted-foreground truncate">
          {totalCount.toLocaleString()} items
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={!canGoNext}
        className="flex-1 max-w-[100px] active:scale-95 transition-transform"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
});

MobilePagination.displayName = 'MobilePagination';
