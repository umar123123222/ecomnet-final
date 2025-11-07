import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, AlertCircle } from 'lucide-react';
import { BulkOperation, BulkOperationProgress } from '@/hooks/useBulkOperations';

interface BulkOperationsPanelLegacyProps {
  selectedCount: number;
  operations: BulkOperation[];
  onExecute: (operation: BulkOperation) => void;
  progress?: BulkOperationProgress;
}

export const BulkOperationsPanelLegacy: React.FC<BulkOperationsPanelLegacyProps> = ({
  selectedCount,
  operations,
  onExecute,
  progress,
}) => {
  const [confirmOperation, setConfirmOperation] = useState<BulkOperation | null>(null);

  const handleOperationClick = (operation: BulkOperation) => {
    if (operation.requiresConfirmation) {
      setConfirmOperation(operation);
    } else {
      onExecute(operation);
    }
  };

  const handleConfirm = () => {
    if (confirmOperation) {
      onExecute(confirmOperation);
      setConfirmOperation(null);
    }
  };

  if (selectedCount === 0 && !progress?.inProgress) {
    return null;
  }

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <span className="font-medium text-primary">
                  {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
                </span>
              </div>
              {progress?.inProgress && (
                <Badge variant="outline" className="animate-pulse">
                  Processing...
                </Badge>
              )}
            </div>

            {progress?.inProgress && (
              <div className="space-y-2">
                <Progress 
                  value={(progress.completed / progress.total) * 100} 
                  className="h-2"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    {progress.completed} of {progress.total} completed
                  </span>
                  {progress.failed > 0 && (
                    <span className="text-destructive">
                      {progress.failed} failed
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {operations.map((operation) => {
                const Icon = operation.icon;
                return (
                  <Button
                    key={operation.id}
                    size="sm"
                    variant={operation.variant || 'outline'}
                    onClick={() => handleOperationClick(operation)}
                    disabled={progress?.inProgress || selectedCount === 0}
                    className="gap-2"
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {operation.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmOperation} onOpenChange={() => setConfirmOperation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Bulk Operation
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmOperation?.confirmMessage || 
                `Are you sure you want to perform "${confirmOperation?.label}" on ${selectedCount} selected item(s)? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
