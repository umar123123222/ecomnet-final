import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Package, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BillOfMaterial } from '@/types/production';

export default function BOMManagement() {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [formData, setFormData] = useState({
    finished_product_id: '',
    material_type: 'raw' as 'raw' | 'packaging',
    raw_material_id: '',
    packaging_item_id: '',
    quantity_required: '',
    unit: '',
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

  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .in('product_type', ['raw_material', 'both'])
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: packagingItems } = useQuery({
    queryKey: ['packaging-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: bomItems } = useQuery({
    queryKey: ['bom', selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      
      const { data, error } = await supabase
        .from('bill_of_materials')
        .select(`
          *,
          finished_product:products!bill_of_materials_finished_product_id_fkey(id, name, sku),
          raw_material:products!bill_of_materials_raw_material_id_fkey(id, name, sku),
          packaging_item:packaging_items!bill_of_materials_packaging_item_id_fkey(id, name, sku)
        `)
        .eq('finished_product_id', selectedProduct);
      
      if (error) throw error;
      return data as BillOfMaterial[];
    },
    enabled: !!selectedProduct,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from('bill_of_materials').insert({
        finished_product_id: data.finished_product_id,
        raw_material_id: data.material_type === 'raw' ? data.raw_material_id : null,
        packaging_item_id: data.material_type === 'packaging' ? data.packaging_item_id : null,
        quantity_required: parseFloat(data.quantity_required),
        unit: data.unit,
        notes: data.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('BOM item added successfully');
      queryClient.invalidateQueries({ queryKey: ['bom'] });
      setShowDialog(false);
      setFormData({
        finished_product_id: '',
        material_type: 'raw',
        raw_material_id: '',
        packaging_item_id: '',
        quantity_required: '',
        unit: '',
        notes: '',
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add BOM item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bill_of_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('BOM item deleted');
      queryClient.invalidateQueries({ queryKey: ['bom'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete BOM item');
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-8 w-8" />
            Bill of Materials
          </h1>
          <p className="text-muted-foreground mt-1">Define materials needed for each product</p>
        </div>
        <Button onClick={() => setShowDialog(true)} disabled={!selectedProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Add BOM Item
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Product</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedProduct} onValueChange={setSelectedProduct}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a finished product" />
            </SelectTrigger>
            <SelectContent>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedProduct && (
        <Card>
          <CardHeader>
            <CardTitle>Materials Required</CardTitle>
          </CardHeader>
          <CardContent>
            {bomItems && bomItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bomItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.raw_material?.name || item.packaging_item?.name}</TableCell>
                      <TableCell>{item.raw_material?.sku || item.packaging_item?.sku}</TableCell>
                      <TableCell>{item.quantity_required}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.notes || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No materials defined. Add materials to create a BOM.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add BOM Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Finished Product</Label>
              <Select
                value={formData.finished_product_id || selectedProduct}
                onValueChange={(value) => setFormData({ ...formData, finished_product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Material Type</Label>
              <Select
                value={formData.material_type}
                onValueChange={(value: 'raw' | 'packaging') => setFormData({ ...formData, material_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw Material</SelectItem>
                  <SelectItem value="packaging">Packaging Item</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.material_type === 'raw' ? (
              <div>
                <Label>Raw Material</Label>
                <Select
                  value={formData.raw_material_id}
                  onValueChange={(value) => setFormData({ ...formData, raw_material_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select raw material" />
                  </SelectTrigger>
                  <SelectContent>
                    {rawMaterials?.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.name} ({material.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Packaging Item</Label>
                <Select
                  value={formData.packaging_item_id}
                  onValueChange={(value) => setFormData({ ...formData, packaging_item_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select packaging item" />
                  </SelectTrigger>
                  <SelectContent>
                    {packagingItems?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity Required</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.quantity_required}
                  onChange={(e) => setFormData({ ...formData, quantity_required: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>Unit</Label>
                <Input
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g., ml, pcs, kg"
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate({ ...formData, finished_product_id: selectedProduct })}
              disabled={
                !formData.quantity_required ||
                !formData.unit ||
                (formData.material_type === 'raw' ? !formData.raw_material_id : !formData.packaging_item_id)
              }
            >
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
