import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Factory, Plus, Package, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { NewProductionBatchDialog } from '@/components/production/NewProductionBatchDialog';
import { ProductionBatch } from '@/types/production';

export default function ProductionDashboard() {
  const [showNewBatchDialog, setShowNewBatchDialog] = useState(false);

  const { data: batches, isLoading } = useQuery({
    queryKey: ['production-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_batches')
        .select(`
          *,
          finished_product:finished_product_id(id, name, sku),
          outlet:outlet_id(id, name),
          producer:produced_by(id, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ProductionBatch[];
    },
  });

  const activeCount = batches?.filter(b => b.status === 'in_progress').length || 0;
  const completedToday = batches?.filter(b => 
    b.status === 'completed' && 
    format(new Date(b.completed_at!), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  ).length || 0;

  const getStatusBadge = (status: string) => {
    const variants = {
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return <Badge variant={variants[status as keyof typeof variants] as any}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="h-8 w-8" />
            Production Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Manage production batches and manufacturing</p>
        </div>
        <Button onClick={() => setShowNewBatchDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Production Batch
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Batches</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedToday}</div>
            <p className="text-xs text-muted-foreground">Finished batches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Units</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {batches?.filter(b => b.status === 'completed').reduce((sum, b) => sum + b.quantity_produced, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">All time production</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Production Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : batches && batches.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Production Date</TableHead>
                  <TableHead>Produced By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.batch_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{batch.finished_product?.name}</p>
                        <p className="text-xs text-muted-foreground">{batch.finished_product?.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>{batch.quantity_produced} units</TableCell>
                    <TableCell>{batch.outlet?.name}</TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell>{format(new Date(batch.production_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{batch.producer?.full_name || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">No production batches yet</p>
          )}
        </CardContent>
      </Card>

      <NewProductionBatchDialog 
        open={showNewBatchDialog} 
        onOpenChange={setShowNewBatchDialog}
      />
    </div>
  );
}
