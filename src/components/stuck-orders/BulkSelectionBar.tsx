import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CheckCircle, RotateCcw, ChevronDown, X, Loader2 } from 'lucide-react';

interface BulkSelectionBarProps {
  selectedCount: number;
  isProcessing: boolean;
  onMarkDelivered: () => void;
  onMarkReturned: () => void;
  onClearSelection: () => void;
}

export const BulkSelectionBar: React.FC<BulkSelectionBarProps> = ({
  selectedCount,
  isProcessing,
  onMarkDelivered,
  onMarkReturned,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-30 bg-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4 backdrop-blur-sm shadow-md">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="default" className="text-sm px-3 py-1">
            {selectedCount} selected
          </Badge>
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="default"
                size="sm"
                disabled={isProcessing}
                className="flex-1 sm:flex-none gap-1.5"
              >
                Bulk Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50 w-48">
              <DropdownMenuItem onClick={onMarkDelivered} className="gap-2 cursor-pointer">
                <CheckCircle className="h-4 w-4 text-primary" />
                Mark Delivered
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMarkReturned} className="gap-2 cursor-pointer">
                <RotateCcw className="h-4 w-4 text-destructive" />
                Mark Returned
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
