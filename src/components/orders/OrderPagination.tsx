import React, { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface OrderPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onJumpToPage: (page: number) => void;
}

export const OrderPagination = memo(({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onJumpToPage,
}: OrderPaginationProps) => {
  const totalPages = Math.ceil(totalCount / pageSize);
  const [jumpValue, setJumpValue] = React.useState('');

  const handleJump = () => {
    const pageNum = parseInt(jumpValue, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      onJumpToPage(pageNum - 1);
      setJumpValue('');
    }
  };

  if (totalCount <= pageSize) return null;

  return (
    <Card className="mt-4">
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-2 px-2">
              <span className="text-sm text-muted-foreground">
                Page <span className="font-semibold text-foreground">{page + 1}</span> of{' '}
                <span className="font-semibold text-foreground">{totalPages}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                ({totalCount.toLocaleString()} total)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="jump-page" className="text-sm text-muted-foreground whitespace-nowrap">
              Jump to:
            </Label>
            <Input
              id="jump-page"
              type="number"
              min="1"
              max={totalPages}
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJump()}
              placeholder="Page"
              className="w-20 h-8"
            />
            <Button variant="secondary" size="sm" onClick={handleJump} disabled={!jumpValue}>
              Go
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

OrderPagination.displayName = 'OrderPagination';
