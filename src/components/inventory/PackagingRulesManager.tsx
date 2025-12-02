import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import type { OrderPackagingRule } from '@/types/inventory';

export const PackagingRulesManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<OrderPackagingRule | null>(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    packaging_item_id: '',
    min_items: 1,
    max_items: 2,
    priority: 0,
    is_active: true,
    notes: ''
  });

  // Fetch packaging items for dropdown
  const { data: packagingItems = [] } = useQuery({
    queryKey: ['packaging-items-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['order-packaging-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_packaging_rules')
        .select('*, packaging_items(*)')
        .order('min_items', { ascending: true });
      if (error) throw error;
      return data as (OrderPackagingRule & { packaging_items: any })[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('order_packaging_rules')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-packaging-rules'] });
      toast({ title: 'Rule created successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error creating rule',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('order_packaging_rules')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-packaging-rules'] });
      toast({ title: 'Rule updated successfully' });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating rule',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_packaging_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-packaging-rules'] });
      toast({ title: 'Rule deleted successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error deleting rule',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      packaging_item_id: '',
      min_items: 1,
      max_items: 2,
      priority: 0,
      is_active: true,
      notes: ''
    });
    setEditingRule(null);
  };

  const handleEdit = (rule: OrderPackagingRule) => {
    setEditingRule(rule);
    setFormData({
      packaging_item_id: rule.packaging_item_id,
      min_items: rule.min_items,
      max_items: rule.max_items,
      priority: rule.priority,
      is_active: rule.is_active,
      notes: rule.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Packaging Rules
            </CardTitle>
            <CardDescription>
              Configure automatic packaging selection based on order item quantity
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit' : 'Create'} Packaging Rule</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="packaging_item_id">Packaging Item</Label>
                  <Select
                    value={formData.packaging_item_id}
                    onValueChange={(value) => setFormData({ ...formData, packaging_item_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select packaging item" />
                    </SelectTrigger>
                    <SelectContent>
                      {packagingItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - {item.sku}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min_items">Min Items</Label>
                    <Input
                      id="min_items"
                      type="number"
                      min="0"
                      value={formData.min_items}
                      onChange={(e) => setFormData({ ...formData, min_items: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_items">Max Items</Label>
                    <Input
                      id="max_items"
                      type="number"
                      min="0"
                      value={formData.max_items}
                      onChange={(e) => setFormData({ ...formData, max_items: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (higher = preferred)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional notes about this rule"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingRule ? 'Update' : 'Create'} Rule
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No rules configured. Add your first rule to enable automatic packaging selection.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Packaging Item</TableHead>
                <TableHead>Item Range</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.packaging_items?.name || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {rule.min_items} - {rule.max_items} items
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    {rule.is_active ? (
                      <span className="text-green-600 dark:text-green-400">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {rule.notes || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this rule?')) {
                            deleteMutation.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};