import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Lock, Truck, ScanLine, Keyboard, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

interface BulkError {
  entry: string;
  error: string;
  errorCode?: string;
}

interface Courier {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface BulkDispatchDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<{ bulkEntries: string }>;
  onSubmit: (data: { bulkEntries: string }) => void;
  allowManualEntry: boolean;
  setAllowManualEntry: (value: boolean) => void;
  entryType: 'tracking_id' | 'order_number';
  setEntryType: (type: 'tracking_id' | 'order_number') => void;
  selectedCourier: string | null;
  setSelectedCourier: (courier: string | null) => void;
  couriers: Courier[];
  isProcessing: boolean;
  bulkErrors: BulkError[];
  scannerConnected: boolean;
}

const BulkDispatchDialog: React.FC<BulkDispatchDialogProps> = ({
  isOpen,
  onOpenChange,
  form,
  onSubmit,
  allowManualEntry,
  setAllowManualEntry,
  entryType,
  setEntryType,
  selectedCourier,
  setSelectedCourier,
  couriers,
  isProcessing,
  bulkErrors,
  scannerConnected,
}) => {
  const handleEntryTypeChange = (value: string) => {
    const type = value as 'tracking_id' | 'order_number';
    setEntryType(type);
    localStorage.setItem('dispatch_entry_type', type);
  };

  const getErrorIcon = (code?: string) => {
    if (code === 'NOT_FOUND') return '🔍';
    if (code === 'ALREADY_DISPATCHED') return '🔄';
    if (code === 'NO_COURIER') return '📦';
    if (code === 'INVALID_FORMAT') return '⚠️';
    return '❌';
  };

  const getErrorBg = (code?: string) => {
    if (code === 'NOT_FOUND') return 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200';
    if (code === 'ALREADY_DISPATCHED') return 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200';
    if (code === 'NO_COURIER') return 'bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-200';
    if (code === 'INVALID_FORMAT') return 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/30 dark:border-yellow-800 dark:text-yellow-200';
    return 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200';
  };

  // Determine input mode
  const canUseInput = allowManualEntry || scannerConnected;
  const inputMode = allowManualEntry ? 'manual' : scannerConnected ? 'scanner' : 'disabled';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!isProcessing || !open) {
        onOpenChange(open);
      }
    }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Mark Orders as Dispatched
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Input Mode Toggle */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-3">
                {allowManualEntry ? (
                  <Keyboard className="h-5 w-5 text-primary" />
                ) : (
                  <ScanLine className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {allowManualEntry ? 'Manual Entry Mode' : 'Scanner Mode'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {allowManualEntry 
                      ? 'Type entries manually or paste from clipboard' 
                      : 'Use barcode scanner to input entries'}
                  </p>
                </div>
              </div>
              <Switch 
                checked={allowManualEntry}
                onCheckedChange={setAllowManualEntry}
              />
            </div>

            {/* Search Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Search By</Label>
              <RadioGroup
                value={entryType}
                onValueChange={handleEntryTypeChange}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tracking_id" id="tracking_id" />
                  <Label htmlFor="tracking_id" className="cursor-pointer text-sm font-normal">
                    Tracking ID
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="order_number" id="order_number" />
                  <Label htmlFor="order_number" className="cursor-pointer text-sm font-normal">
                    Order Number
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Courier Assignment */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-sm font-medium">Courier Assignment</Label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Select 
                value={selectedCourier || "none"} 
                onValueChange={(value) => setSelectedCourier(value === "none" ? null : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No specific courier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span>No specific courier</span>
                    </div>
                  </SelectItem>
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      <div className="flex items-center gap-2">
                        <Truck className={`h-4 w-4 ${courier.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className={courier.is_active ? '' : 'text-muted-foreground'}>
                          {courier.name} ({courier.code})
                          {!courier.is_active && ' - Inactive'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCourier && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  All orders will be assigned to {couriers.find(c => c.id === selectedCourier)?.name}
                </Badge>
              )}
            </div>

            {/* Bulk Entry Input */}
            <FormField 
              control={form.control} 
              name="bulkEntries" 
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Bulk Entry</FormLabel>
                    {inputMode === 'scanner' && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800">
                        <ScanLine className="h-3 w-3 mr-1" />
                        Scanner Connected
                      </Badge>
                    )}
                    {inputMode === 'manual' && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800">
                        <Keyboard className="h-3 w-3 mr-1" />
                        Manual Entry
                      </Badge>
                    )}
                  </div>

                  {/* Warning for no input available */}
                  {!canUseInput && (
                    <div className="flex items-start gap-2 p-3 mt-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium">Scanner not connected</p>
                        <p className="text-xs mt-0.5 opacity-80">
                          Connect a barcode scanner or enable manual entry to continue
                        </p>
                      </div>
                    </div>
                  )}

                  <FormControl>
                    <Textarea 
                      {...field}
                      placeholder={`${entryType === 'tracking_id' ? 'Tracking IDs' : 'Order numbers'} (one per line)...`}
                      className="min-h-[140px] font-mono text-sm resize-y" 
                      readOnly={!allowManualEntry}
                      disabled={!canUseInput}
                    />
                  </FormControl>

                  {/* Processing Indicator */}
                  {isProcessing && (
                    <div className="flex items-center gap-2 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-lg text-primary">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                      <span className="text-sm font-medium">Processing entries, please wait...</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-1.5">
                    {entryType === 'tracking_id' 
                      ? 'Enter courier tracking numbers (e.g., TRK123456789)'
                      : 'Enter order numbers (e.g., SHOP-12345)'}
                  </p>
                  <FormMessage />
                </FormItem>
              )} 
            />

            {/* Bulk Errors Display */}
            {bulkErrors.length > 0 && (
              <div className="border rounded-lg p-4 bg-destructive/5 max-h-48 overflow-y-auto">
                <p className="font-semibold text-destructive mb-3 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  <span>{bulkErrors.length} Failed Entries</span>
                </p>
                <div className="space-y-2">
                  {bulkErrors.map((e, i) => (
                    <div key={i} className={`text-sm p-2.5 border rounded-md ${getErrorBg(e.errorCode)}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0">{getErrorIcon(e.errorCode)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono font-medium text-xs break-all">{e.entry}</p>
                          <p className="text-xs mt-0.5 opacity-80">{e.error}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isProcessing || !canUseInput}
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                    Processing...
                  </>
                ) : (
                  'Process Entries'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default BulkDispatchDialog;
