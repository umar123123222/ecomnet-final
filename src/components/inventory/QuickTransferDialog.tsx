import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Product, Outlet } from '@/types/inventory';
import { ArrowRight, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const transferSchema = z.object({
  from_outlet_id: z.string().min(1, 'Source outlet is required'),
  to_outlet_id: z.string().min(1, 'Destination outlet is required'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.string().min(1, 'Product is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
    })
  ).min(1, 'At least one item is required'),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface QuickTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  outlets: Outlet[];
}

export const QuickTransferDialog = ({
  open,
  onOpenChange,
  products,
  outlets,
}: QuickTransferDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([
    { product_id: '', quantity: 1 },
  ]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      items: [{ product_id: '', quantity: 1 }],
    },
  });

  const fromOutletId = watch('from_outlet_id');

  // Fetch available stock for validation
  const { data: availableStock } = useQuery({
    queryKey: ['available-stock', fromOutletId],
    queryFn: async () => {
      if (!fromOutletId) return [];
      const { data, error } = await supabase
        .from('inventory')
        .select('product_id, available_quantity')
        .eq('outlet_id', fromOutletId);
      if (error) throw error;
      return data;
    },
    enabled: !!fromOutletId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormData) => {
      // Call edge function to create transfer request
      const { data: result, error } = await supabase.functions.invoke('stock-transfer-request', {
        body: {
          action: 'create',
          from_outlet_id: data.from_outlet_id,
          to_outlet_id: data.to_outlet_id,
          notes: data.notes,
          items: data.items,
          requested_by: user?.id,
        },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast.success('Transfer request created successfully');
      queryClient.invalidateQueries({ queryKey: ['pending-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-requests'] });
      onOpenChange(false);
      reset();
      setItems([{ product_id: '', quantity: 1 }]);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create transfer: ${error.message}`);
    },
  });

  const onSubmit = (data: TransferFormData) => {
    // Validate stock availability
    const invalidItems = items.filter((item) => {
      if (!item.product_id) return false;
      const stock = availableStock?.find((s) => s.product_id === item.product_id);
      return !stock || stock.available_quantity < item.quantity;
    });

    if (invalidItems.length > 0) {
      toast.error('Some items have insufficient stock in the source outlet');
      return;
    }

    if (data.from_outlet_id === data.to_outlet_id) {
      toast.error('Source and destination outlets must be different');
      return;
    }

    createTransferMutation.mutate({ ...data, items });
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    const newItems = [...items];
    if (field === 'product_id') {
      newItems[index].product_id = value as string;
    } else {
      newItems[index].quantity = value as number;
    }
    setItems(newItems);
    setValue('items', newItems);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Stock Transfer</DialogTitle>
          <DialogDescription>
            Create a stock transfer request between outlets
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_outlet_id">From Outlet *</Label>
              <Select onValueChange={(value) => setValue('from_outlet_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.from_outlet_id && (
                <p className="text-sm text-destructive">{errors.from_outlet_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="to_outlet_id">To Outlet *</Label>
              <Select onValueChange={(value) => setValue('to_outlet_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.to_outlet_id && (
                <p className="text-sm text-destructive">{errors.to_outlet_id.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => {
                const stock = availableStock?.find((s) => s.product_id === item.product_id);
                const hasStock = stock && stock.available_quantity >= item.quantity;

                return (
                  <div key={index} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Select
                        value={item.product_id}
                        onValueChange={(value) => updateItem(index, 'product_id', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, 'quantity', parseInt(e.target.value) || 1)
                        }
                        placeholder="Qty"
                      />
                      {item.product_id && stock && (
                        <p className={`text-xs mt-1 ${hasStock ? 'text-muted-foreground' : 'text-destructive'}`}>
                          Available: {stock.available_quantity}
                        </p>
                      )}
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Add any notes or special instructions..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTransferMutation.isPending}>
              {createTransferMutation.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
