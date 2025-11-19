import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, Download, Edit, Truck, ChevronDown, ChevronUp, Plus, Filter, Lock } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import TagsNotes from '@/components/TagsNotes';
import { useToast } from '@/hooks/use-toast';
import NewDispatchDialog from '@/components/dispatch/NewDispatchDialog';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/utils/activityLogger';

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
  const [allowManualEntry, setAllowManualEntry] = useState(false);
  const [lastKeyTime, setLastKeyTime] = useState<number>(0);
  const [fastKeyCount, setFastKeyCount] = useState<number>(0);
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<'tracking_id' | 'order_number'>(() => {
    const saved = localStorage.getItem('dispatch_entry_type');
    return (saved === 'order_number' ? 'order_number' : 'tracking_id') as 'tracking_id' | 'order_number';
  });
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Fetch all couriers from business settings
  const { data: couriers = [], isLoading: couriersLoading } = useQuery({
    queryKey: ['all-couriers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, code, is_active')
        .order('is_active', { ascending: false })
        .order('name');
      if (error) throw error;
      return data;
    }
  });
  const form = useForm({
    defaultValues: {
      bulkEntries: ''
    }
  });
  useEffect(() => {
    const fetchDispatches = async () => {
      setLoading(true);
      try {
        // Step 1: Fetch dispatches with only orders embedded
        const { data, error } = await supabase
          .from('dispatches')
          .select(`
            *,
            orders:orders!dispatches_order_id_fkey (
              order_number,
              customer_name,
              customer_phone,
              customer_address,
              city,
              total_amount,
              status
            )
          `)
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching dispatches:', error);
          toast({
            title: "Error",
            description: "Failed to fetch dispatches",
            variant: "destructive"
          });
          return;
        }

        // Step 2: Fetch profiles separately for dispatched_by users
        const userIds = [...new Set(data?.filter(d => d.dispatched_by).map(d => d.dispatched_by) || [])];
        let profilesById: Record<string, any> = {};
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          if (profiles) {
            profilesById = profiles.reduce((acc, profile) => {
              acc[profile.id] = profile;
              return acc;
            }, {} as Record<string, any>);
          }
        }

        // Step 3: Enrich dispatches with profile data
        const enrichedDispatches = data?.map(dispatch => ({
          ...dispatch,
          dispatched_by_user: dispatch.dispatched_by ? profilesById[dispatch.dispatched_by] : null
        })) || [];

        setDispatches(enrichedDispatches);
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
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to perform this action",
        variant: "destructive"
      });
      return;
    }

    try {
      // Parse entries - one entry per line
      const entries = data.bulkEntries.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      
      // Determine selected courier details
      const selectedCourierObj = selectedCourier
        ? couriers.find(c => c.id === selectedCourier)
        : undefined;

      // Display name (for UI / logs) – safe even if courier enum expects a code
      const courierName = selectedCourierObj?.name || 'Manual Entry';

      // Enum-safe courier code for orders.courier (enum courier_type)
      const courierCode = selectedCourierObj?.code as Database["public"]["Enums"]["courier_type"] | undefined;
      
      for (const entry of entries) {
        // Find order by selected entry type
        let order;
        
        if (entryType === 'tracking_id') {
          const { data, error: orderError } = await supabase
            .from('orders')
            .select('id, tracking_id, order_number')
            .eq('tracking_id', entry)
            .maybeSingle();
          order = data;
        } else {
          // For order number, try exact match first, then partial match
          let { data, error: orderError } = await supabase
            .from('orders')
            .select('id, tracking_id, order_number')
            .eq('order_number', entry)
            .maybeSingle();
          
          // If no exact match, try with SHOP- prefix or partial match
          if (!data) {
            const { data: partialData } = await supabase
              .from('orders')
              .select('id, tracking_id, order_number')
              .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
              .limit(1)
              .maybeSingle();
            data = partialData;
          }
          order = data;
        }
        
        if (!order) {
          errors.push(`Order not found for ${entryType === 'tracking_id' ? 'tracking ID' : 'order number'}: ${entry}`);
          errorCount++;
          continue;
        }
        
        // Determine the tracking ID based on entry type
        // If searching by tracking_id, the entry IS the tracking ID
        // If searching by order_number, use the order's existing tracking_id or prompt to add one
        const trackingId = entryType === 'tracking_id' ? entry : (order.tracking_id || null);
        
        // Update order's tracking_id if we have a new one
        if (entryType === 'tracking_id' && entry !== order.tracking_id) {
          await supabase
            .from('orders')
            .update({ tracking_id: entry })
            .eq('id', order.id);
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
            status: 'dispatched',
            courier: courierName,
            courier_id: selectedCourier,
            dispatched_by: user.id,
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
            status: 'dispatched',
            courier: courierName,
            courier_id: selectedCourier,
            dispatched_by: user.id,
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
          status: 'dispatched',
          courier: courierCode ?? null,
          dispatched_at: new Date().toISOString()
        }).eq('id', order.id);
        
        // Log activity
        await logActivity({
          entityType: 'dispatch',
          entityId: existingDispatch?.id || order.id,
          action: 'order_dispatched',
          details: {
            order_id: order.id,
            tracking_id: trackingId,
            courier: courierName,
            courier_id: selectedCourier,
            entry_type: entryType,
            search_value: entry
          }
        });
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
          description: `Successfully processed ${successCount} ${entryType === 'tracking_id' ? 'tracking ID(s)' : 'order number(s)'}${errorCount > 0 ? `, ${errorCount} failed` : ''}`
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Allow manual entry if toggle is enabled
    if (allowManualEntry) {
      setLastKeyTime(Date.now());
      setFastKeyCount(0);
      return;
    }

    const currentTime = Date.now();
    const timeSinceLastKey = currentTime - lastKeyTime;
    setLastKeyTime(currentTime);

    // Special keys are always allowed
    const isSpecialKey = ['Tab', 'Enter', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
    const isSelectAll = (e.ctrlKey || e.metaKey) && e.key === 'a';
    
    if (isSpecialKey || isSelectAll) {
      return;
    }

    // Detect scanner input: scanners type very fast (< 100ms between keystrokes)
    const isFastTyping = timeSinceLastKey < 100 && timeSinceLastKey > 0;
    
    if (isFastTyping) {
      // Track consecutive fast keys - scanner produces multiple fast keys in sequence
      setFastKeyCount(prev => prev + 1);
      // If we've detected 3+ consecutive fast keys, it's definitely a scanner
      if (fastKeyCount >= 2) {
        return; // Allow scanner input silently
      }
    } else {
      // Reset counter if typing slows down
      setFastKeyCount(0);
      
      // Only block and show toast for clearly manual typing (slow, deliberate keystrokes)
      if (timeSinceLastKey > 200 || lastKeyTime === 0) {
        e.preventDefault();
        toast({
          title: "Manual Entry Disabled",
          description: "Enable manual entry toggle to type, or use barcode scanner",
          variant: "destructive"
        });
      }
    }
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
                <Truck className="h-4 w-4 mr-2" />
                Mark Dispatched
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Mark Orders as Dispatched</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleManualEntry)} className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Allow Manual Entry</p>
                        <p className="text-xs text-muted-foreground">Enable keyboard typing (scanners work regardless)</p>
                      </div>
                    </div>
                    <Switch 
                      checked={allowManualEntry}
                      onCheckedChange={setAllowManualEntry}
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      <FormLabel>Search By:</FormLabel>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="tracking_id"
                            checked={entryType === 'tracking_id'}
                            onChange={(e) => {
                              setEntryType('tracking_id');
                              localStorage.setItem('dispatch_entry_type', 'tracking_id');
                            }}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">Tracking ID</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="order_number"
                            checked={entryType === 'order_number'}
                            onChange={(e) => {
                              setEntryType('order_number');
                              localStorage.setItem('dispatch_entry_type', 'order_number');
                            }}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">Order Number</span>
                        </label>
                      </div>
                    </div>
                    
                    {/* Courier Selection */}
                    <div className="space-y-2">
                      <FormLabel>
                        Courier Assignment (Optional)
                        <span className="text-xs text-muted-foreground ml-2">
                          Select if all orders are for a specific courier
                        </span>
                      </FormLabel>
                      <Select 
                        value={selectedCourier || "none"} 
                        onValueChange={(value) => setSelectedCourier(value === "none" ? null : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="No specific courier (Manual Entry)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-muted-foreground" />
                              <span>No specific courier</span>
                            </div>
                          </SelectItem>
                          {couriers.map((courier) => (
                            <SelectItem key={courier.id} value={courier.id}>
                              <div className="flex items-center gap-2">
                                <Truck className={`h-4 w-4 ${courier.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className={courier.is_active ? '' : 'text-muted-foreground'}>
                                  {courier.name} ({courier.code})
                                  {!courier.is_active && ' - Inactive'}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCourier && (
                        <Badge variant="outline" className="text-xs">
                          All orders will be assigned to {couriers.find(c => c.id === selectedCourier)?.name}
                        </Badge>
                      )}
                    </div>
                    
                    <FormField control={form.control} name="bulkEntries" render={({
                    field
                  }) => <FormItem>
                          <FormLabel>Bulk Entry</FormLabel>
                          {!allowManualEntry && (
                            <Badge variant="secondary" className="ml-2">
                              <Lock className="h-3 w-3 mr-1" />
                              Scanner Mode
                            </Badge>
                          )}
                          <FormControl>
                            <Textarea 
                              {...field}
                              placeholder={`${!allowManualEntry ? 'Scan' : 'Enter'} ${entryType === 'tracking_id' ? 'tracking IDs' : 'order numbers'} (one per line)...`}
                              className="min-h-[150px] font-mono text-sm" 
                              onKeyDown={handleKeyDown}
                            />
                          </FormControl>
                          <p className="text-sm text-muted-foreground mt-1">
                            {entryType === 'tracking_id' 
                              ? 'Enter courier tracking numbers (e.g., TRK123456789)'
                              : 'Enter order numbers (e.g., ORD-12345)'}
                          </p>
                          <FormMessage />
                        </FormItem>} />
                  </div>
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
                <TableHead>Order Number</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Dispatched By</TableHead>
                <TableHead>Dispatch Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow> : filteredDispatches.length === 0 ? <TableRow>
                  <TableCell colSpan={6} className="text-center">No dispatches found</TableCell>
                </TableRow> : filteredDispatches.map(dispatch => {
                  // Extract just the order number without SHOP- prefix
                  const orderNumber = dispatch.orders?.order_number?.replace('SHOP-', '') || 'N/A';
                  const dispatchDate = dispatch.dispatch_date 
                    ? new Date(dispatch.dispatch_date).toLocaleDateString()
                    : new Date(dispatch.created_at).toLocaleDateString();
                  
                  // Check if tracking_id is actually a valid tracking ID or just the order number
                  // Valid tracking IDs are typically 10+ digits, order numbers are 5-6 digits
                  const trackingId = dispatch.tracking_id;
                  const isValidTrackingId = trackingId && 
                    trackingId !== orderNumber && 
                    trackingId.length >= 10;
                  const displayTrackingId = isValidTrackingId ? trackingId : 'N/A';
                  
                  return (
                    <TableRow key={dispatch.id}>
                      <TableCell className="font-medium">{orderNumber}</TableCell>
                      <TableCell>{displayTrackingId}</TableCell>
                      <TableCell>{dispatch.orders?.customer_name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-500" />
                          {dispatch.courier || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {dispatch.dispatched_by_user?.full_name || 
                           dispatch.dispatched_by_user?.email || 
                           (dispatch.dispatched_by ? 'Unknown user' : 'System')}
                        </div>
                      </TableCell>
                      <TableCell>{dispatchDate}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>;
};
export default DispatchDashboard;