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
import { Search, Download, Edit, Truck, ChevronDown, ChevronUp, Plus, Filter } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import TagsNotes from '@/components/TagsNotes';
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
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      bulkEntries: ''
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
      const dispatchDate = parseISO(dispatch.dispatch_date || dispatch.created_at);
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
  const handleManualEntry = async (data: {
    bulkEntries: string;
  }) => {
    try {
      // Parse entries - one tracking ID per line
      const trackingIds = data.bulkEntries.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      for (const trackingId of trackingIds) {
        // Find order by tracking_id
        const {
          data: order,
          error: orderError
        } = await supabase.from('orders').select('id').eq('tracking_id', trackingId).maybeSingle();
        if (orderError || !order) {
          errors.push(`Order not found for tracking ID: ${trackingId}`);
          errorCount++;
          continue;
        }

        // Check if dispatch already exists
        const {
          data: existingDispatch
        } = await supabase.from('dispatches').select('id').eq('order_id', order.id).maybeSingle();
        if (existingDispatch) {
          // Update existing dispatch
          const {
            error: updateDispatchError
          } = await supabase.from('dispatches').update({
            tracking_id: trackingId,
            status: 'in_transit',
            dispatch_date: new Date().toISOString()
          }).eq('id', existingDispatch.id);
          if (updateDispatchError) {
            errors.push(`Failed to update dispatch for ${trackingId}: ${updateDispatchError.message}`);
            errorCount++;
            continue;
          }
        } else {
          // Create new dispatch
          const {
            error: dispatchError
          } = await supabase.from('dispatches').insert({
            order_id: order.id,
            tracking_id: trackingId,
            status: 'in_transit',
            courier: 'Manual Entry',
            dispatch_date: new Date().toISOString()
          });
          if (dispatchError) {
            errors.push(`Failed to create dispatch for ${trackingId}: ${dispatchError.message}`);
            errorCount++;
            continue;
          }
        }

        // Update order status to dispatched
        const {
          error: updateError
        } = await supabase.from('orders').update({
          status: 'dispatched'
        }).eq('id', order.id);
        if (updateError) {
          errors.push(`Failed to update order status for ${trackingId}: ${updateError.message}`);
          errorCount++;
          continue;
        }
        successCount++;
      }

      // Show results
      if (successCount > 0) {
        toast({
          title: "Bulk Entry Complete",
          description: `Successfully processed ${successCount} tracking ID(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`
        });
      }
      if (errors.length > 0) {
        console.error('Bulk entry errors:', errors);
        toast({
          title: "Some Entries Failed",
          description: `${errorCount} entries failed. Check console for details.`,
          variant: "destructive"
        });
      }
      setIsManualEntryOpen(false);
      form.reset();
    } catch (error) {
      console.error('Bulk entry error:', error);
      toast({
        title: "Error",
        description: "Failed to process bulk entries",
        variant: "destructive"
      });
    }
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
          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Bulk Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Dispatch Entry</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleManualEntry)} className="space-y-4">
                  <FormField control={form.control} name="bulkEntries" render={({
                  field
                }) => <FormItem>
                        <FormLabel>Tracking IDs</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter tracking IDs (one per line)&#10;Example:&#10;TRK123456&#10;TRK789012&#10;TRK345678" className="min-h-[150px] font-mono text-sm" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Enter one tracking ID per line
                        </p>
                        <FormMessage />
                      </FormItem>} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsManualEntryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Process Entries</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
              
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search by tracking ID, order ID, name, phone, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 w-full" />
            </div>
            <div className="flex-1">
              <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full" />
            </div>
            <div className="flex-1">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_transit">Dispatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
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