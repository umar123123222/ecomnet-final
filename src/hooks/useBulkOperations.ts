import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface BulkOperation {
  id: string;
  label: string;
  icon?: React.ComponentType<any>;
  action: (selectedIds: string[]) => Promise<BulkOperationResult>;
  confirmMessage?: string;
  variant?: 'default' | 'destructive';
  requiresConfirmation?: boolean;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  errors?: string[];
}

export interface BulkOperationProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

export const useBulkOperations = () => {
  const [progress, setProgress] = useState<BulkOperationProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  });
  const { toast } = useToast();

  const executeBulkOperation = async (
    operation: BulkOperation,
    selectedIds: string[],
    onComplete?: () => void
  ) => {
    if (selectedIds.length === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one item to perform this operation.',
        variant: 'destructive',
      });
      return;
    }

    setProgress({
      total: selectedIds.length,
      completed: 0,
      failed: 0,
      inProgress: true,
    });

    try {
      const result = await operation.action(selectedIds);

      setProgress({
        total: selectedIds.length,
        completed: result.success,
        failed: result.failed,
        inProgress: false,
      });

      if (result.success > 0) {
        toast({
          title: 'Operation completed',
          description: `Successfully processed ${result.success} item(s). ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`,
        });
      }

      if (result.failed > 0 && result.errors) {
        console.error('Bulk operation errors:', result.errors);
      }

      onComplete?.();
    } catch (error) {
      console.error('Bulk operation error:', error);
      setProgress({
        total: selectedIds.length,
        completed: 0,
        failed: selectedIds.length,
        inProgress: false,
      });
      toast({
        title: 'Operation failed',
        description: 'An error occurred while processing the bulk operation.',
        variant: 'destructive',
      });
    }
  };

  const resetProgress = () => {
    setProgress({
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: false,
    });
  };

  return {
    progress,
    executeBulkOperation,
    resetProgress,
  };
};
