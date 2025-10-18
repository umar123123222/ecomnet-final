import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Filter, Barcode, CheckCircle, XCircle, Clock, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ScanHistory = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const { data: scans, isLoading } = useQuery({
    queryKey: ['scans', searchQuery, statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('scans')
        .select(`
          *,
          product:products(name, sku, barcode),
          order:orders(order_number),
          outlet:outlets(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchQuery) {
        query = query.or(`barcode.ilike.%${searchQuery}%,raw_data.ilike.%${searchQuery}%`);
      }

      if (statusFilter !== 'all') {
        query = query.eq('processing_status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('scan_type', typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['scan-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scans')
        .select('processing_status, scan_type, scan_method')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      const totalScans = data.length;
      const successfulScans = data.filter((s) => s.processing_status === 'processed').length;
      const failedScans = data.filter((s) => s.processing_status === 'failed').length;
      const duplicateScans = data.filter((s) => s.processing_status === 'duplicate').length;

      return {
        total: totalScans,
        successful: successfulScans,
        failed: failedScans,
        duplicate: duplicateScans,
        successRate: totalScans > 0 ? ((successfulScans / totalScans) * 100).toFixed(1) : '0',
      };
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; label: string }> = {
      processed: { variant: 'default', icon: CheckCircle, label: 'Processed' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      duplicate: { variant: 'secondary', icon: Copy, label: 'Duplicate' },
      pending: { variant: 'outline', icon: Clock, label: 'Pending' },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant}>
        <Icon className="mr-1 h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Barcode copied to clipboard',
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Scan History</h1>
          <p className="text-muted-foreground">Track and manage all barcode scans</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Scans (24h)</CardDescription>
            <CardTitle className="text-3xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Successful</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats?.successful || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats?.failed || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Success Rate</CardDescription>
            <CardTitle className="text-3xl">{stats?.successRate || 0}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search barcode or data..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="duplicate">Duplicate</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="order">Order</SelectItem>
                <SelectItem value="tracking">Tracking</SelectItem>
                <SelectItem value="package">Package</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading scans...</div>
          ) : !scans || scans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Barcode className="mx-auto h-12 w-12 mb-4" />
              <p>No scans found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Barcode</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan: any) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(scan.created_at), 'MMM dd, HH:mm:ss')}
                    </TableCell>
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-2">
                        <Barcode className="h-4 w-4" />
                        {scan.barcode}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{scan.scan_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{scan.scan_method}</Badge>
                    </TableCell>
                    <TableCell>
                      {scan.product ? (
                        <div>
                          <div className="font-medium">{scan.product.name}</div>
                          <div className="text-sm text-muted-foreground">{scan.product.sku}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{scan.outlet?.name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(scan.processing_status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(scan.barcode)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ScanHistory;
