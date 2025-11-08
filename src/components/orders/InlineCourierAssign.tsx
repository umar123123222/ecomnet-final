import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X } from 'lucide-react';
import { downloadCourierLabel } from '@/utils/courierLabelDownload';

// Helper function to convert error codes to user-friendly messages
const getErrorMessage = (errorCode: string, fallback: string): string => {
  const errorMessages: Record<string, string> = {
    'INVALID_ORDER_TYPE': 'The courier rejected the order type. Please check courier configuration.',
    'AUTH_HEADER_DROPPED': 'Authentication issue with courier API. Please contact support.',
    'NETWORK_DNS_ERROR': 'Cannot reach courier API. Please check your internet connection.',
    'NETWORK_ERROR': 'Network connectivity issue. Please try again.',
    'COURIER_NOT_FOUND': 'Courier configuration not found. Please check courier setup.',
    'CONFIGURATION_REQUIRED': 'Pickup address not configured. Go to Settings > Business Settings.',
    'BOOKING_API_ERROR': 'Courier API returned an error. Please try again or contact support.',
  };
  
  return errorMessages[errorCode] || fallback || 'An unexpected error occurred. Please try again.';
};

interface InlineCourierAssignProps {
  orderId: string;
  currentCourier: string;
  trackingId?: string;
  couriers: Array<{ id: string; name: string; code: string }>;
  orderDetails: {
    orderNumber: string;
    customer: string;
    phone: string;
    address: string;
    city: string;
    items: any[];
    totalPrice: number;
  };
  onAssigned: () => void;
}

export const InlineCourierAssign: React.FC<InlineCourierAssignProps> = ({
  orderId,
  currentCourier,
  trackingId,
  couriers,
  orderDetails,
  onAssigned,
}) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);

  const handleCourierAssign = async (courierId: string) => {
    setIsUpdating(true);
    let responseData: any = null;
    
    try {
      const courier = couriers.find(c => c.id === courierId);
      if (!courier) throw new Error('Courier not found');

      // Fetch pickup address from settings
      const { data: settings } = await supabase
        .from('api_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'PICKUP_ADDRESS_NAME',
          'PICKUP_ADDRESS_PHONE',
          'PICKUP_ADDRESS_ADDRESS',
          'PICKUP_ADDRESS_CITY'
        ]);

      const getSettingValue = (key: string) => 
        settings?.find(s => s.setting_key === key)?.setting_value || '';

      const pickupName = getSettingValue('PICKUP_ADDRESS_NAME');
      const pickupPhone = getSettingValue('PICKUP_ADDRESS_PHONE');
      const pickupAddress = getSettingValue('PICKUP_ADDRESS_ADDRESS');
      const pickupCity = getSettingValue('PICKUP_ADDRESS_CITY');

      if (!pickupAddress || !pickupCity) {
        toast({
          title: "Configuration Required",
          description: "Please configure pickup address in Settings > Business Settings first.",
          variant: "destructive",
        });
        return;
      }

      // Calculate weight (assuming 1kg per item, can be enhanced)
      const totalPieces = orderDetails.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const estimatedWeight = totalPieces * 1; // 1kg per item

      // Call courier booking edge function
      const { data, error } = await supabase.functions.invoke('courier-booking', {
        body: {
          orderId: orderId,
          courierId: courierId,
          pickupAddress: {
            name: pickupName,
            phone: pickupPhone,
            address: pickupAddress,
            city: pickupCity
          },
          deliveryAddress: {
            name: orderDetails.customer,
            phone: orderDetails.phone,
            address: orderDetails.address,
            city: orderDetails.city
          },
          weight: estimatedWeight,
          pieces: totalPieces,
          codAmount: orderDetails.totalPrice,
          specialInstructions: '',
          items: orderDetails.items.map(item => ({
            name: item.name || item.item_name || 'Product',
            quantity: item.quantity || 1,
            price: parseFloat(item.price || 0)
          }))
        }
      });

      if (error) throw error;

      responseData = data;

      if (!data.success) {
        // Parse structured error response
        const errorCode = data.errorCode || 'UNKNOWN_ERROR';
        const errorMsg = getErrorMessage(errorCode, data.error);
        throw new Error(errorMsg);
      }

      // Auto-download label if available
      if (data.labelData || data.labelUrl) {
        console.log('Attempting to download label:', {
          hasLabelData: !!data.labelData,
          hasLabelUrl: !!data.labelUrl,
          labelFormat: data.labelFormat,
          trackingId: data.trackingId
        });
        
        try {
          await downloadCourierLabel(
            data.labelData,
            data.labelUrl,
            data.labelFormat || 'pdf',
            data.trackingId
          );
          
          toast({
            title: "Success",
            description: `Order booked with ${courier.name}. Tracking ID: ${data.trackingId}. Airway bill downloaded.`,
          });
        } catch (downloadError) {
          console.error('Label download failed:', downloadError);
          toast({
            title: "Booking Successful",
            description: `Order booked with tracking ID: ${data.trackingId}. Airway bill download failed - you can download it manually from the dispatch page.`,
            variant: "default",
          });
        }
      } else {
        console.warn('No label data in response:', data);
        toast({
          title: "Booking Successful", 
          description: `Order booked with ${courier.name}. Tracking ID: ${data.trackingId}. Airway bill will be available in the dispatch page.`,
        });
      }

      onAssigned();
    } catch (error: any) {
      console.error('Error assigning courier:', error);
      
      const errorTitle = "Booking Failed";
      const errorDesc = error.message || "Failed to assign courier";
      
      toast({
        title: errorTitle,
        description: (
          <div className="flex flex-col gap-2">
            <p>{errorDesc}</p>
            {responseData?.isRetryable === true && (
              <p className="text-xs text-muted-foreground">
                This booking will be automatically retried in 5 minutes.
              </p>
            )}
          </div>
        ),
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCourierUnassign = async () => {
    setIsUpdating(true);
    try {
      // Call courier cancellation edge function
      const { data, error } = await supabase.functions.invoke('courier-cancellation', {
        body: {
          orderId: orderId,
          trackingId: trackingId || '',
          reason: 'Unassigned by user'
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Cancellation failed');
      }

      toast({
        title: "Courier Unassigned",
        description: "Courier booking cancelled and order reset successfully.",
      });

      setShowUnassignDialog(false);
      onAssigned();
    } catch (error: any) {
      console.error('Error unassigning courier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to unassign courier",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (currentCourier && currentCourier !== 'N/A') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{currentCourier.toUpperCase()}</span>
        <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive/10"
              disabled={isUpdating}
            >
              <X className="h-3 w-3 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Unassign Courier?</AlertDialogTitle>
              <AlertDialogDescription>
                This will cancel the booking with {currentCourier.toUpperCase()}, delete the tracking ID and airway bill, and reset the order to pending status. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCourierUnassign}
                disabled={isUpdating}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Unassigning...
                  </>
                ) : (
                  'Unassign Courier'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isUpdating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Select onValueChange={handleCourierAssign} disabled={isUpdating}>
          <SelectTrigger className="h-8 w-[140px] text-xs bg-background">
            <SelectValue placeholder="+ Assign Courier" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            {couriers.map((courier) => (
              <SelectItem key={courier.id} value={courier.id}>
                {courier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};