import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, ChevronDown, ChevronUp, Edit, Lock, ScanBarcode } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import TagsNotes from '@/components/TagsNotes';
import { useToast } from '@/hooks/use-toast';
import { logActivity, updateUserPerformance } from '@/utils/activityLogger';
import { useAuth } from '@/contexts/AuthContext';
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { useQueryClient } from '@tanstack/react-query';
const ReturnsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7)
  });
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [allowManualEntry, setAllowManualEntry] = useState(false);
  const [lastKeyTime, setLastKeyTime] = useState<number>(0);
  const [fastKeyCount, setFastKeyCount] = useState<number>(0);
  const [entryType, setEntryType] = useState<'tracking_id' | 'order_number'>(() => {
    const saved = localStorage.getItem('returns_entry_type');
    return (saved === 'order_number' ? 'order_number' : 'tracking_id') as 'tracking_id' | 'order_number';
  });
  
  // Scanner Mode States
  const [scannerModeActive, setScannerModeActive] = useState(false);
  const [scannerStats, setScannerStats] = useState({ success: 0, errors: 0 });
  const [recentScans, setRecentScans] = useState<Array<{
    entry: string;
    type: 'order_number' | 'tracking_id' | 'unknown';
    status: 'success' | 'error';
    message: string;
    timestamp: Date;
    orderId?: string;
  }>>([]);
  const [scanHistoryForExport, setScanHistoryForExport] = useState<any[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(Date.now());
  
  const { toast } = useToast();
  const { user } = useAuth();
  const scanner = useHandheldScanner();
  const queryClient = useQueryClient();
  
  const successSound = useMemo(() => new Audio('/sounds/success.mp3'), []);
  const errorSound = useMemo(() => new Audio('/sounds/error.mp3'), []);
  
  const form = useForm({
    defaultValues: {
      bulkEntries: ''
    }
  });
  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        const {
          data,
          error
        } = await supabase.from('returns').select(`
            *,
            orders!returns_order_id_fkey (
              order_number,
              customer_name,
              customer_phone,
              customer_email
            ),
            received_by_profile:profiles(
              full_name,
              email
            )
          `).order('created_at', {
          ascending: false
        });
        if (error) {
          console.error('Error fetching returns:', error);
          toast({
            title: "Error",
            description: "Failed to fetch returns",
            variant: "destructive"
          });
        } else {
          setReturns(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReturns();
  }, [toast]);
  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return returns;
    return returns.filter(returnItem => {
      const returnDate = parseISO(returnItem.date);
      if (dateRange.to) {
        return isWithinInterval(returnDate, {
          start: dateRange.from,
          end: dateRange.to
        });
      }
      return returnDate >= dateRange.from;
    });
  }, [returns, dateRange]);
  const filteredReturns = useMemo(() => {
    return filteredByDate.filter(returnItem => 
      (returnItem.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (returnItem.orders?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (returnItem.orders?.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.orders?.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.orders?.customer_phone || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredByDate, searchTerm]);
  const metrics = useMemo(() => {
    const returnedCount = filteredByDate.length;
    const returnedWorth = filteredByDate.reduce((sum, returnItem) => {
      return sum + (returnItem.worth || 0);
    }, 0);
    return {
      returnedCount,
      returnedWorth: `PKR ${returnedWorth.toLocaleString()}`
    };
  }, [filteredByDate]);

  const toggleRowExpansion = (returnId: string) => {
    setExpandedRows(prev => prev.includes(returnId) ? prev.filter(id => id !== returnId) : [...prev, returnId]);
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

    // Detect scanner input: scanners type very fast (< 50ms between keystrokes)
    const isFastTyping = timeSinceLastKey < 50 && timeSinceLastKey > 0;
    
    if (isFastTyping) {
      setFastKeyCount(prev => prev + 1);
      // If we've detected 2+ consecutive fast keys, it's definitely a scanner
      if (fastKeyCount >= 1) {
        return; // Allow scanner input silently
      }
    } else {
      setFastKeyCount(0);
    }
    
    // Block all other input (manual typing)
    e.preventDefault();
    toast({
      title: "Manual Entry Disabled",
      description: "Enable manual entry toggle to type, or use barcode scanner",
      variant: "destructive"
    });
  };

  const handleManualEntry = async (formData: { bulkEntries: string }) => {
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
      const entries = formData.bulkEntries
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const entry of entries) {
        let returnRecord;
        
        if (entryType === 'tracking_id') {
          // Search by tracking ID
          const { data, error: returnError } = await supabase
            .from('returns')
            .select('id, order_id')
            .eq('tracking_id', entry)
            .maybeSingle();
          returnRecord = data;
          
          if (!returnRecord) {
            errors.push(`Return not found for tracking ID: ${entry}`);
            errorCount++;
            continue;
          }
        } else {
          // Search by order number - try exact match first, then partial
          let order;
          const { data: exactMatch } = await supabase
            .from('orders')
            .select('id')
            .eq('order_number', entry)
            .maybeSingle();
          
          if (exactMatch) {
            order = exactMatch;
          } else {
            // Try with prefix or partial match
            const { data: partialMatch } = await supabase
              .from('orders')
              .select('id')
              .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
              .limit(1)
              .maybeSingle();
            order = partialMatch;
          }
          
          if (order) {
            const { data } = await supabase
              .from('returns')
              .select('id, order_id')
              .eq('order_id', order.id)
              .maybeSingle();
            returnRecord = data;
          }
          
          if (!returnRecord) {
            errors.push(`Return not found for order number: ${entry}`);
            errorCount++;
            continue;
          }
        }

        // Update return status to received
        const { error: updateReturnError } = await supabase
          .from('returns')
          .update({
            return_status: 'received',
            received_at: new Date().toISOString(),
            received_by: user.id
          })
          .eq('id', returnRecord.id);

        if (updateReturnError) {
          errors.push(`Failed to update return for ${entryType === 'tracking_id' ? 'tracking ID' : 'order number'}: ${entry}: ${updateReturnError.message}`);
          errorCount++;
          continue;
        }

        // Update order status to 'returned'
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            status: 'returned'
          })
          .eq('id', returnRecord.order_id);

        if (updateOrderError) {
          errors.push(`Failed to update order status for ${entryType === 'tracking_id' ? 'tracking ID' : 'order number'}: ${entry}: ${updateOrderError.message}`);
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
          description: `${errorCount} tracking ID(s) could not be processed. Check console for details.`,
          variant: "destructive"
        });
      }

      // Reset form and close dialog
      form.reset();
      setIsManualEntryOpen(false);

      // Refresh the returns list
      const { data: refreshedReturns } = await supabase
        .from('returns')
        .select(`
          *,
          orders!returns_order_id_fkey (
            order_number,
            customer_name,
            customer_phone,
            customer_email
          )
        `)
        .order('created_at', { ascending: false });

      if (refreshedReturns) setReturns(refreshedReturns);
    } catch (error) {
      console.error('Error processing bulk entries:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-gray-600 mt-1">Track and manage returned orders</p>
        </div>
        <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Mark Returns Received
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Return Receipt Entry</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleManualEntry)} className="space-y-4">
                {/* Manual Entry Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Allow Manual Entry</span>
                  </div>
                  <Switch
                    checked={allowManualEntry}
                    onCheckedChange={setAllowManualEntry}
                  />
                </div>

                {!allowManualEntry && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                    <Badge variant="outline" className="bg-primary/5">Scanner Mode</Badge>
                    <span className="text-xs text-muted-foreground">Use barcode scanner only</span>
                  </div>
                )}

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
                            localStorage.setItem('returns_entry_type', 'tracking_id');
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
                            localStorage.setItem('returns_entry_type', 'order_number');
                          }}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm">Order Number</span>
                      </label>
                    </div>
                  </div>

                  <FormField
                    control={form.control}
                    name="bulkEntries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bulk Entry</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={`${allowManualEntry ? 'Enter' : 'Scan'} ${entryType === 'tracking_id' ? 'tracking IDs' : 'order numbers'} (one per line)...`}
                            className={`min-h-[150px] font-mono text-sm ${!allowManualEntry ? 'bg-muted/30' : ''}`}
                            onKeyDown={handleKeyDown}
                            {...field}
                          />
                        </FormControl>
                        <p className="text-sm text-muted-foreground mt-1">
                          {entryType === 'tracking_id' 
                            ? 'Enter courier tracking numbers (e.g., TRK123456789)'
                            : 'Enter order numbers (e.g., ORD-12345)'}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsManualEntryOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Process Entries</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returned Orders (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Worth of Returns (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedWorth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Returns Table with integrated filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Returns ({filteredReturns.length})</span>
            
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search by tracking ID, order ID, name, email, phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} className="w-full" />
            
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Worth</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                </TableRow> : filteredReturns.length === 0 ? <TableRow>
                  <TableCell colSpan={10} className="text-center">No returns found</TableCell>
                </TableRow> : filteredReturns.map(returnItem => <React.Fragment key={returnItem.id}>
                    <TableRow>
                      <TableCell className="font-medium">{returnItem.orders?.order_number || 'N/A'}</TableCell>
                      <TableCell>{returnItem.tracking_id || 'N/A'}</TableCell>
                      <TableCell>{returnItem.orders?.customer_name || 'N/A'}</TableCell>
                      <TableCell>{returnItem.orders?.customer_phone || 'N/A'}</TableCell>
                      <TableCell>{returnItem.reason || 'N/A'}</TableCell>
                      <TableCell>PKR {(returnItem.worth || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {returnItem.received_by_profile?.full_name || 'Not received'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={returnItem.return_status === 'received' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {returnItem.return_status || 'in_transit'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(returnItem.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleRowExpansion(returnItem.id)}>
                          {expandedRows.includes(returnItem.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.includes(returnItem.id) && <TableRow>
                        <TableCell colSpan={10} className="bg-gray-50 p-4">
                          <div className="space-y-2">
                            <p><strong>Notes:</strong> {returnItem.notes || 'No notes available'}</p>
                            <p><strong>Received Date:</strong> {returnItem.received_at ? new Date(returnItem.received_at).toLocaleDateString() : 'Not received yet'}</p>
                            <p><strong>Tags:</strong> {returnItem.tags ? returnItem.tags.join(', ') : 'No tags'}</p>
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
export default ReturnsDashboard;