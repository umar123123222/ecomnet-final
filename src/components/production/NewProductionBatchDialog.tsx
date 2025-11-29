import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { processProductionBatch } from '@/integrations/supabase/functions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProductionBatchDialog({ open, onOpenChange }: Props) {
  const [formData, setFormData] = useState({
    finished_product_id: '',
    outlet_id: '',
    quantity_produced: '',
    production_date: new Date().toISOString().split('T')[0],
    expiry_date: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ['finished-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('product_type', ['finished', 'both'])
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: outlets } = useQuery({
    queryKey: ['outlets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: bom, isLoading: bomLoading } = useQuery({
    queryKey: ['bom', formData.finished_product_id],
    queryFn: async () => {
      if (!formData.finished_product_id) return null;
      
      const { data, error } = await supabase
        .from('bill_of_materials')
        .select(`
          *,
          raw_material:products!bill_of_materials_raw_material_id_fkey(id, name, sku),
          packaging_item:packaging_items!bill_of_materials_packaging_item_id_fkey(id, name, sku)
        `)
        .eq('finished_product_id', formData.finished_product_id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!formData.finished_product_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const batch_number = `BATCH-${timestamp}${random}`;
      
      return processProductionBatch({
        action: 'create',
        data: {
          batch_number,
          finished_product_id: formData.finished_product_id,
          outlet_id: formData.outlet_id,
          quantity_produced: parseInt(formData.quantity_produced),
          production_date: formData.production_date,
          expiry_date: formData.expiry_date || undefined,
          notes: formData.notes || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success('Production batch created successfully');
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
      setFormData({
        finished_product_id: '',
        outlet_id: '',
        quantity_produced: '',
        production_date: new Date().toISOString().split('T')[0],
        expiry_date: '',
        notes: '',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create production batch');
    },
  });

  const quantity = parseInt(formData.quantity_produced) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Production Batch</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="product">Finished Product *</Label>
              <Select
                value={formData.finished_product_id}
                onValueChange={(value) => setFormData({ ...formData, finished_product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="outlet">Outlet *</Label>
              <Select
                value={formData.outlet_id}
                onValueChange={(value) => setFormData({ ...formData, outlet_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets?.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="quantity">Quantity to Produce *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={formData.quantity_produced}
                onChange={(e) => setFormData({ ...formData, quantity_produced: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="production_date">Production Date</Label>
              <Input
                id="production_date"
                type="date"
                value={formData.production_date}
                onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="expiry_date">Expiry Date</Label>
              <Input
                id="expiry_date"
                type="date"
                value={formData.expiry_date}
                onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
              />
            </div>
          </div>

          {formData.finished_product_id && (
            <div>
              <Label>Bill of Materials</Label>
              {bomLoading ? (
                <p className="text-sm text-muted-foreground">Loading BOM...</p>
              ) : bom && bom.length > 0 ? (
                <div className="border rounded-lg p-3 space-y-2">
                  {bom.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.raw_material?.name || item.packaging_item?.name}
                        <span className="text-muted-foreground ml-2">
                          ({item.raw_material?.sku || item.packaging_item?.sku})
                        </span>
                      </span>
                      <span className="font-medium">
                        {item.quantity_required} × {quantity} = {item.quantity_required * quantity} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No BOM defined for this product. Please create a BOM first.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={
              !formData.finished_product_id ||
              !formData.outlet_id ||
              !formData.quantity_produced ||
              createMutation.isPending ||
              !bom ||
              bom.length === 0
            }
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Batch & Print Labels
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
