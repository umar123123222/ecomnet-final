import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Package, AlertCircle, Download } from 'lucide-react';
import { BulkOperationProgress } from '@/hooks/useBulkOperations';

interface BulkOperationsPanelProps {
  selectedCount: number;
  onStatusChange: (status: string) => void;
  onCourierAssign: (courierId: string, courierName: string) => void;
  onCourierUnassign: () => void;
  onExport: () => void;
  progress?: BulkOperationProgress;
  couriers: Array<{ id: string; name: string; code: string }>;
}

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  selectedCount,
  onStatusChange,
  onCourierAssign,
  onCourierUnassign,
  onExport,
  progress,
  couriers,
}) => {
  const [confirmAction, setConfirmAction] = useState<{ type: 'status' | 'courier'; value: string; label: string } | null>(null);

  const handleStatusChange = (status: string) => {
    const statusLabels: Record<string, string> = {
      'pending': 'Mark as Pending',
      'booked': 'Mark as Booked',
      'dispatched': 'Mark as Dispatched',
      'delivered': 'Mark as Delivered',
      'returned': 'Mark as Returned',
      'cancelled': 'Mark as Cancelled',
    };
    setConfirmAction({ type: 'status', value: status, label: statusLabels[status] || status });
  };

  const handleCourierSelect = (courierId: string) => {
    const courier = couriers.find(c => c.id === courierId);
    if (courier) {
      setConfirmAction({ type: 'courier', value: courierId, label: `Book with ${courier.name}` });
    }
  };

  const handleConfirm = () => {
    if (confirmAction) {
      if (confirmAction.type === 'status') {
        onStatusChange(confirmAction.value);
      } else if (confirmAction.type === 'courier') {
        const courier = couriers.find(c => c.id === confirmAction.value);
        if (courier) {
          onCourierAssign(confirmAction.value, courier.name);
        }
      }
      setConfirmAction(null);
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
              {/* Status Update Dropdown */}
              <Select 
                onValueChange={handleStatusChange}
                disabled={progress?.inProgress || selectedCount === 0}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Update Status" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="pending">Mark as Pending</SelectItem>
                  <SelectItem value="booked">Mark as Booked</SelectItem>
                  <SelectItem value="dispatched">Mark as Dispatched</SelectItem>
                  <SelectItem value="delivered">Mark as Delivered</SelectItem>
                  <SelectItem value="returned">Mark as Returned</SelectItem>
                  <SelectItem value="cancelled">Mark as Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Unassign Courier Button */}
              <Button
                size="sm"
                variant="destructive"
                onClick={onCourierUnassign}
                disabled={progress?.inProgress || selectedCount === 0}
                className="gap-2"
              >
                Unassign Courier
              </Button>

              {/* Courier Assignment Dropdown */}
              <Select 
                onValueChange={handleCourierSelect}
                disabled={progress?.inProgress || selectedCount === 0}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Book Courier" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      Book with {courier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Export Button */}
              <Button
                size="sm"
                variant="outline"
                onClick={onExport}
                disabled={progress?.inProgress || selectedCount === 0}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Export Selected
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Confirm Bulk Operation
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'courier' 
                ? `Are you sure you want to ${confirmAction.label} for ${selectedCount} selected order(s)? Orders will be marked as "Booked" and labels will be generated.`
                : `Are you sure you want to "${confirmAction?.label}" on ${selectedCount} selected order(s)?`
              }
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
