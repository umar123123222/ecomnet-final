import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface InlineCourierAssignProps {
  orderId: string;
  currentCourier: string;
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
  couriers,
  orderDetails,
  onAssigned,
}) => {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleCourierAssign = async (courierId: string) => {
    setIsUpdating(true);
    try {
      const courier = couriers.find(c => c.id === courierId);
      if (!courier) throw new Error('Courier not found');

      // Update order with courier and status
      const courierCode = courier.code.toLowerCase() as 'leopard' | 'postex' | 'tcs' | 'other';
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          courier: courierCode,
          status: 'booked',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Generate and download label
      const labelHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Shipping Label - ${courier.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .label { border: 2px solid #000; padding: 20px; max-width: 600px; }
            .header { text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: bold; }
            .section { margin-bottom: 15px; }
            .section strong { display: block; margin-bottom: 5px; }
            .divider { border-top: 1px dashed #000; margin: 15px 0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="header">SHIPPING LABEL - ${courier.name.toUpperCase()}</div>
            <div class="section">
              <strong>Order Number:</strong> ${orderDetails.orderNumber}
              <strong>Date:</strong> ${new Date().toLocaleDateString()}
            </div>
            <div class="section">
              <strong>Customer:</strong><br/>
              ${orderDetails.customer}<br/>
              ${orderDetails.phone}<br/>
              ${orderDetails.address}<br/>
              ${orderDetails.city}
            </div>
            <div class="section">
              <strong>Items:</strong><br/>
              ${orderDetails.items.map((item: any) => `${item.item_name} (x${item.quantity})`).join('<br/>')}
            </div>
            <div class="divider">
              <strong>Total Amount:</strong> PKR ${orderDetails.totalPrice.toFixed(2)}
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([labelHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `label-${orderDetails.orderNumber}-${courier.name}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Order booked with ${courier.name}. Label downloaded.`,
      });

      onAssigned();
    } catch (error: any) {
      console.error('Error assigning courier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign courier",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (currentCourier && currentCourier !== 'N/A') {
    return <span className="text-sm">{currentCourier}</span>;
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