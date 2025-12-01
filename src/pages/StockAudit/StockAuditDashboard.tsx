import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, ClipboardCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface StockCount {
  id: string;
  count_number: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_items_counted: number;
  items_with_variance: number;
  total_variance_value: number;
  outlets: { name: string } | null;
}

interface CountItem {
  product_id: string;
  system_quantity: number;
  counted_quantity: number;
}

const StockAuditDashboard = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isStartCountDialogOpen, setIsStartCountDialogOpen] = useState(false);
  const [isCountingDialogOpen, setIsCountingDialogOpen] = useState(false);
  const [activeCount, setActiveCount] = useState<any>(null);
  
  const [newCountData, setNewCountData] = useState({
    outlet_id: '',
    count_type: 'cycle',
    notes: ''
  });

  const [countingData, setCountingData] = useState({
    product_id: '',
    counted_quantity: ''
  });

  const [countedItems, setCountedItems] = useState<CountItem[]>([]);

  // Fetch stock counts
  const { data: stockCounts = [], isLoading } = useQuery({
    queryKey: ['stock-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_counts')
        .select(`
          *,
          outlets(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as StockCount[];
    }
  });

  // Fetch outlets
  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch products for counting
  const { data: products = [] } = useQuery({
    queryKey: ['products-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Generate count number
  const generateCountNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SC-${year}${month}-${random}`;
  };

  // Start new count
  const startCountMutation = useMutation({
    mutationFn: async (data: any) => {
      const countNumber = generateCountNumber();
      const { data: count, error } = await supabase
        .from('stock_counts')
        .insert({
          count_number: countNumber,
          outlet_id: data.outlet_id,
          count_type: data.count_type,
          started_by: profile?.id,
          notes: data.notes,
          status: 'in_progress'
        })
        .select()
        .single();

      if (error) throw error;
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      setActiveCount(count);
      setIsStartCountDialogOpen(false);
      setIsCountingDialogOpen(true);
      toast({
        title: 'Stock Count Started',
        description: `Count ${count.count_number} has been started.`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Add item to count
  const addItemToCount = async () => {
    if (!countingData.product_id || !countingData.counted_quantity) {
      toast({
        title: 'Missing Information',
        description: 'Please select a product and enter quantity.',
        variant: 'destructive'
      });
      return;
    }

    // Get system quantity from inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('quantity, available_quantity')
      .eq('product_id', countingData.product_id)
      .eq('outlet_id', activeCount.outlet_id)
      .single();

    const systemQty = inventory?.quantity || 0;
    const countedQty = parseInt(countingData.counted_quantity);

    // Get product cost
    const product = products.find(p => p.id === countingData.product_id);
    const unitCost = product?.price || 0;

    // Save count item
    const { error } = await supabase
      .from('stock_count_items')
      .insert({
        count_id: activeCount.id,
        product_id: countingData.product_id,
        outlet_id: activeCount.outlet_id,
        system_quantity: systemQty,
        counted_quantity: countedQty,
        unit_cost: unitCost,
        counted_by: profile?.id
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    // Add to local state
    setCountedItems([...countedItems, {
      product_id: countingData.product_id,
      system_quantity: systemQty,
      counted_quantity: countedQty
    }]);

    // Reset form
    setCountingData({
      product_id: '',
      counted_quantity: ''
    });

    toast({
      title: 'Item Counted',
      description: `${countedQty} units recorded. Variance: ${countedQty - systemQty}`
    });
  };

  // Complete count
  const completeCountMutation = useMutation({
    mutationFn: async () => {
      if (!activeCount) return;

      // Get count statistics
      const { data: items } = await supabase
        .from('stock_count_items')
        .select('variance, variance_value')
        .eq('count_id', activeCount.id);

      const itemsWithVariance = items?.filter(i => i.variance !== 0).length || 0;
      const totalVarianceValue = items?.reduce((sum, i) => sum + (i.variance_value || 0), 0) || 0;

      const { error } = await supabase
        .from('stock_counts')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_items_counted: countedItems.length,
          items_with_variance: itemsWithVariance,
          total_variance_value: totalVarianceValue
        })
        .eq('id', activeCount.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-counts'] });
      setIsCountingDialogOpen(false);
      setActiveCount(null);
      setCountedItems([]);
      toast({
        title: 'Count Completed',
        description: 'Stock count has been completed successfully.'
      });
    }
  });

  const handleStartCount = (e: React.FormEvent) => {
    e.preventDefault();
    startCountMutation.mutate(newCountData);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      in_progress: { variant: 'outline', label: 'In Progress' },
      completed: { variant: 'secondary', label: 'Completed' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' }
    };
    const config = variants[status] || variants.in_progress;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCounts = stockCounts.filter(count =>
    count.count_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    inProgress: stockCounts.filter(c => c.status === 'in_progress').length,
    completed: stockCounts.filter(c => c.status === 'completed').length,
    withVariance: stockCounts.filter(c => c.items_with_variance > 0).length,
    avgAccuracy: stockCounts.length > 0 
      ? (stockCounts.reduce((sum, c) => sum + (c.total_items_counted > 0 ? ((c.total_items_counted - c.items_with_variance) / c.total_items_counted * 100) : 0), 0) / stockCounts.length).toFixed(1)
      : '0'
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Audit</h1>
          <p className="text-muted-foreground">Physical inventory counting and verification</p>
        </div>
        <Button onClick={() => setIsStartCountDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Start New Count
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Variance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.withVariance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.avgAccuracy}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by count number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Counts List */}
      {isLoading ? (
        <div className="text-center py-12">Loading stock counts...</div>
      ) : filteredCounts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No stock counts found. Start a new count to begin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredCounts.map((count) => (
            <Card key={count.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{count.count_number}</h3>
                        <p className="text-sm text-muted-foreground">{count.outlets?.name}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Started:</span>{' '}
                        {format(new Date(count.started_at), 'MMM dd, yyyy hh:mm a')}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Items:</span>{' '}
                        {count.total_items_counted}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Variance:</span>{' '}
                        {count.items_with_variance} items ({count.total_variance_value.toLocaleString()} PKR)
                      </div>
                      {count.items_with_variance > 0 && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Has Variances</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(count.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Start Count Dialog */}
      <Dialog open={isStartCountDialogOpen} onOpenChange={setIsStartCountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Stock Count</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStartCount} className="space-y-4">
            <div>
              <Label htmlFor="outlet_id">Outlet *</Label>
              <Select value={newCountData.outlet_id} onValueChange={(value) => setNewCountData({ ...newCountData, outlet_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outlet" />
                </SelectTrigger>
                <SelectContent>
                  {outlets.map(outlet => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="count_type">Count Type</Label>
              <Select value={newCountData.count_type} onValueChange={(value) => setNewCountData({ ...newCountData, count_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Count</SelectItem>
                  <SelectItem value="cycle">Cycle Count</SelectItem>
                  <SelectItem value="spot">Spot Count</SelectItem>
                  <SelectItem value="unscheduled">Unscheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={newCountData.notes}
                onChange={(e) => setNewCountData({ ...newCountData, notes: e.target.value })}
                placeholder="Add any relevant notes..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsStartCountDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!newCountData.outlet_id || startCountMutation.isPending}>
                {startCountMutation.isPending ? 'Starting...' : 'Start Count'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Counting Dialog */}
      <Dialog open={isCountingDialogOpen} onOpenChange={setIsCountingDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock Counting - {activeCount?.count_number}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">Select products manually to count</p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="product_id">Product *</Label>
                <Select value={countingData.product_id} onValueChange={(value) => setCountingData({ ...countingData, product_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="counted_quantity">Counted Quantity *</Label>
                <Input
                  id="counted_quantity"
                  type="number"
                  value={countingData.counted_quantity}
                  onChange={(e) => setCountingData({ ...countingData, counted_quantity: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>

            <Button onClick={addItemToCount} className="w-full">
              Add Item
            </Button>

            {/* Counted Items */}
            {countedItems.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Counted Items ({countedItems.length})</h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {countedItems.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-3">
                        <div className="flex justify-between text-sm">
                          <span>Item {index + 1}</span>
                          <span className={item.counted_quantity !== item.system_quantity ? 'text-amber-600 font-semibold' : ''}>
                            Counted: {item.counted_quantity} | System: {item.system_quantity}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCountingDialogOpen(false)}>
                Save & Exit
              </Button>
              <Button onClick={() => completeCountMutation.mutate()} disabled={countedItems.length === 0}>
                Complete Count
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockAuditDashboard;
