import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Loader2, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export type BulkActionType = 'delivered' | 'returned';

interface BulkStatusUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: BulkActionType;
  selectedCount: number;
  isProcessing: boolean;
  onConfirm: (dateTime: Date, notes: string) => void;
}

export const BulkStatusUpdateModal: React.FC<BulkStatusUpdateModalProps> = ({
  open,
  onOpenChange,
  actionType,
  selectedCount,
  isProcessing,
  onConfirm,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeValue, setTimeValue] = useState(() => format(new Date(), 'HH:mm'));
  const [notes, setNotes] = useState('');

  const isDelivered = actionType === 'delivered';
  const title = isDelivered ? 'Mark Orders as Delivered' : 'Mark Orders as Returned';
  const dateLabel = isDelivered ? 'Delivery Date & Time' : 'Return Receiving Date & Time';
  const Icon = isDelivered ? CheckCircle : RotateCcw;
  const iconColor = isDelivered ? 'text-primary' : 'text-destructive';

  const handleConfirm = () => {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const dateTime = new Date(selectedDate);
    dateTime.setHours(hours, minutes, 0, 0);
    onConfirm(dateTime, notes);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isProcessing) {
      if (newOpen) {
        setSelectedDate(new Date());
        setTimeValue(format(new Date(), 'HH:mm'));
        setNotes('');
      }
      onOpenChange(newOpen);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn('h-5 w-5', iconColor)} />
            {title}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            This will update <strong>{selectedCount}</strong> order{selectedCount !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>{dateLabel}</Label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'flex-1 justify-start text-left font-normal',
                      !selectedDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => d && setSelectedDate(d)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-[120px]"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder={isDelivered
                ? 'e.g., Confirmed via courier API...'
                : 'e.g., Customer refused delivery...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            variant={isDelivered ? 'default' : 'destructive'}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Icon className="h-4 w-4 mr-2" />
                Confirm ({selectedCount})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
