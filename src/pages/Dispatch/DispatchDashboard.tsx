import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, Scan, Edit, Truck, ChevronDown, ChevronUp, Plus, Filter, QrCode, Type } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import TagsNotes from '@/components/TagsNotes';
import UnifiedScanner, { ScanResult } from '@/components/UnifiedScanner';
import { useToast } from '@/hooks/use-toast';
import NewDispatchDialog from '@/components/dispatch/NewDispatchDialog';
import { useQueryClient } from '@tanstack/react-query';
const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date()
  });
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isScanningOpen, setIsScanningOpen] = useState(false);
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      trackingIds: ''
    }
  });
  useEffect(() => {
    const fetchDispatches = async () => {
      setLoading(true);
      try {
        const {
          data,
          error
        } = await supabase.from('dispatches').select(`
            *,
            orders!dispatches_order_id_fkey (
              order_number,
              customer_name,
              customer_phone,
              customer_address,
              city,
              total_amount,
              status
            )
          `).order('created_at', {
          ascending: false
        });
        if (error) {
          console.error('Error fetching dispatches:', error);
          toast({
            title: "Error",
            description: "Failed to fetch dispatches",
            variant: "destructive"
          });
        } else {
          setDispatches(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDispatches();

    // Set up real-time subscription
    const channel = supabase.channel('dispatch-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'dispatches'
    }, () => {
      fetchDispatches();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return dispatches;
    return dispatches.filter(dispatch => {
      const dispatchDate = parseISO(dispatch.date);
      if (dateRange.to) {
        return isWithinInterval(dispatchDate, {
          start: dateRange.from,
          end: dateRange.to
        });
      }
      return dispatchDate >= dateRange.from;
    });
  }, [dispatches, dateRange]);
  const filteredDispatches = useMemo(() => {
    return filteredByDate.filter(dispatch => {
      const matchesSearch = (dispatch.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_phone || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || dispatch.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [filteredByDate, searchTerm, statusFilter]);
  const metrics = useMemo(() => {
    const totalDispatches = filteredByDate.length;
    const worthOfDispatches = filteredByDate.reduce((total, dispatch) => {
      return total + (dispatch.orders?.total_amount || 2500);
    }, 0);
    const pending = filteredByDate.filter(d => d.status === "pending").length;
    const inTransit = filteredByDate.filter(d => d.status === "in_transit").length;
    const delivered = filteredByDate.filter(d => d.status === "completed" || d.status === "delivered").length;
    return {
      totalDispatches,
      worthOfDispatches,
      pending,
      inTransit,
      delivered
    };
  }, [filteredByDate]);
  const handleSelectDispatch = (dispatchId: string) => {
    setSelectedDispatches(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  };
  const handleSelectAll = () => {
    setSelectedDispatches(selectedDispatches.length === filteredDispatches.length ? [] : filteredDispatches.map(d => d.id));
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const handleScanDispatch = async (result: ScanResult) => {
    console.log(`Scanned via ${result.method} in ${result.scanDuration}ms`);
    const {
      orderId,
      trackingId
    } = result;
    if (orderId || trackingId) {
      // Try to find matching order
      const matchingDispatch = dispatches.find(d => d.tracking_id === trackingId || d.orders?.order_number === orderId);
      if (matchingDispatch) {
        toast({
          title: "Dispatch Found",
          description: `Order: ${matchingDispatch.orders?.order_number || orderId}`
        });
        setSearchTerm(trackingId || orderId || '');
      } else {
        // New dispatch - open dialog for creation
        toast({
          title: "New Dispatch Detected",
          description: `Tracking: ${trackingId || 'N/A'}`
        });
        setSearchTerm(trackingId || orderId || '');
        setIsNewDispatchOpen(true);
      }
    } else {
      toast({
        title: "No Order Information Found",
        description: `Scanned: ${result.rawData.substring(0, 50)}`,
        variant: "destructive"
      });
    }
  };
  const handleManualEntry = (data: {
    trackingIds: string;
  }) => {
    // Manual entry tracking IDs processed
    setIsManualEntryOpen(false);
    form.reset();
  };
  const toggleRowExpansion = (dispatchId: string) => {
    setExpandedRows(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  };
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispatch Management</h1>
          <p className="text-gray-600 mt-1">Track and manage order dispatches</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsNewDispatchOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Dispatch
          </Button>
          <Button onClick={() => setIsScanningOpen(true)} variant="outline">
            <Scan className="h-4 w-4 mr-2" />
            Scan
          </Button>
          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Bulk Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Tracking ID Entry</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(() => {})} className="space-y-4">
                  <FormField control={form.control} name="trackingIds" render={({
                  field
                }) => <FormItem>
                        <FormLabel>Tracking IDs</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter tracking IDs (one per line or comma separated)..." className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsManualEntryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unified Scanner */}
      <UnifiedScanner isOpen={isScanningOpen} onClose={() => setIsScanningOpen(false)} onScan={handleScanDispatch} scanType="dispatch" title="Scan Dispatch Package" />

      {/* New Dispatch Dialog */}
      <NewDispatchDialog open={isNewDispatchOpen} onOpenChange={setIsNewDispatchOpen} />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Dispatches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDispatches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Worth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rs. {metrics.worthOfDispatches.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Dispatches Table with integrated filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Dispatches ({filteredDispatches.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedDispatches.length === filteredDispatches.length && filteredDispatches.length > 0} onCheckedChange={() => {}} // handleSelectAll
            />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search by tracking ID, order ID, name, phone, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_transit">Dispatched</SelectItem>
              </SelectContent>
            </Select>
            
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                </TableRow> : filteredDispatches.length === 0 ? <TableRow>
                  <TableCell colSpan={10} className="text-center">No dispatches found</TableCell>
                </TableRow> : filteredDispatches.map(dispatch => <React.Fragment key={dispatch.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox checked={selectedDispatches.includes(dispatch.id)} onCheckedChange={() => handleSelectDispatch(dispatch.id)} />
                      </TableCell>
                      <TableCell className="font-medium">{dispatch.orders?.order_number || 'N/A'}</TableCell>
                      <TableCell>{dispatch.tracking_id || 'N/A'}</TableCell>
                      <TableCell>{dispatch.orders?.customer_name || 'N/A'}</TableCell>
                      <TableCell>{dispatch.orders?.customer_phone || 'N/A'}</TableCell>
                      <TableCell className="max-w-xs truncate">{dispatch.orders?.customer_address || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-500" />
                          {dispatch.courier || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(dispatch.status || 'pending')}>
                          {dispatch.status || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(dispatch.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(dispatch.id)}>
                          {expandedRows.includes(dispatch.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.includes(dispatch.id) && <TableRow>
                        <TableCell colSpan={10} className="bg-gray-50 p-4">
                          <div className="space-y-2">
                            <p><strong>Notes:</strong> {dispatch.notes || 'No notes available'}</p>
                            <p><strong>Dispatch Date:</strong> {dispatch.dispatch_date ? new Date(dispatch.dispatch_date).toLocaleDateString() : 'Not set'}</p>
                          </div>
                        </TableCell>
                      </TableRow>}
                  </React.Fragment>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>;
};
export default DispatchDashboard;