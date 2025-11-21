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

  const activateScannerMode = () => {
    setScannerModeActive(true);
    setScannerStats({ success: 0, errors: 0 });
    setRecentScans([]);
    setScanHistoryForExport([]);
    setLastScanTime(Date.now());
    
    // Play activation sound
    successSound.volume = 0.3;
    successSound.currentTime = 0;
    successSound.play().catch(e => console.log('Audio play failed:', e));
    
    toast({
      title: "Scanner Mode Activated",
      description: "Ready to scan returns. Press ESC to stop.",
    });
  };

  const deactivateScannerMode = () => {
    setScannerModeActive(false);
    toast({
      title: "Scanner Mode Stopped",
      description: `Processed ${scannerStats.success + scannerStats.errors} scans (${scannerStats.success} successful, ${scannerStats.errors} errors)`,
    });
  };

  const processScannerInput = async (entry: string) => {
    if (!user?.id || !entry || entry.trim().length === 0) return;

    const startTime = Date.now();
    setLastScanTime(startTime);
    entry = entry.trim();

    try {
      // Search for return record by tracking ID or order number
      let returnRecord;
      let orderData;
      
      // Try tracking ID first
      const { data: returnByTracking } = await supabase
        .from('returns')
        .select('*, orders!returns_order_id_fkey(id, order_number, customer_name)')
        .eq('tracking_id', entry)
        .maybeSingle();

      if (returnByTracking) {
        returnRecord = returnByTracking;
        orderData = returnByTracking.orders;
      } else {
        // Try order number
        let order;
        const { data: exactMatch } = await supabase
          .from('orders')
          .select('id, order_number, customer_name')
          .eq('order_number', entry)
          .maybeSingle();
        
        if (exactMatch) {
          order = exactMatch;
        } else {
          const { data: partialMatch } = await supabase
            .from('orders')
            .select('id, order_number, customer_name')
            .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
            .limit(1)
            .maybeSingle();
          order = partialMatch;
        }
        
        if (order) {
          const { data } = await supabase
            .from('returns')
            .select('*, orders!returns_order_id_fkey(id, order_number, customer_name)')
            .eq('order_id', order.id)
            .maybeSingle();
          returnRecord = data;
          orderData = order;
        }
      }

      if (!returnRecord) {
        // Play error sound
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));
        
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => [{
          entry,
          type: 'unknown',
          status: 'error',
          message: 'Return not found',
          timestamp: new Date()
        }, ...prev.slice(0, 5)]);
        
        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry,
          orderNumber: '',
          customer: '',
          trackingId: '',
          status: 'error',
          reason: 'Return not found',
          processingTime: Date.now() - startTime
        }]);
        
        toast({
          title: "Return Not Found",
          description: `No return found for: ${entry}`,
          variant: "destructive"
        });
        return;
      }

      // Check if already received
      if (returnRecord.return_status === 'received') {
        // Play error sound
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));
        
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => [{
          entry,
          type: entry === returnRecord.tracking_id ? 'tracking_id' : 'order_number',
          status: 'error',
          message: 'Already received',
          timestamp: new Date(),
          orderId: orderData?.order_number
        }, ...prev.slice(0, 5)]);
        
        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry,
          orderNumber: orderData?.order_number || '',
          customer: orderData?.customer_name || '',
          trackingId: returnRecord.tracking_id || '',
          status: 'error',
          reason: 'Already received',
          processingTime: Date.now() - startTime
        }]);
        
        toast({
          title: "Already Received",
          description: `Return ${orderData?.order_number || entry} was already received`,
          variant: "destructive"
        });
        return;
      }

      // Update return status
      const { error: updateReturnError } = await supabase
        .from('returns')
        .update({
          return_status: 'received',
          received_at: new Date().toISOString(),
          received_by: user.id
        })
        .eq('id', returnRecord.id);

      if (updateReturnError) throw updateReturnError;

      // Update order status
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: 'returned' })
        .eq('id', returnRecord.order_id);

      if (updateOrderError) throw updateOrderError;

      // Success - play success sound
      successSound.volume = 0.5;
      successSound.currentTime = 0;
      successSound.play().catch(e => console.log('Audio play failed:', e));
      
      setScannerStats(prev => ({ ...prev, success: prev.success + 1 }));
      setRecentScans(prev => [{
        entry,
        type: entry === returnRecord.tracking_id ? 'tracking_id' : 'order_number',
        status: 'success',
        message: 'Return received',
        timestamp: new Date(),
        orderId: orderData?.order_number
      }, ...prev.slice(0, 5)]);
      
      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry,
        orderNumber: orderData?.order_number || '',
        customer: orderData?.customer_name || '',
        trackingId: returnRecord.tracking_id || '',
        status: 'success',
        reason: 'Return received',
        processingTime: Date.now() - startTime
      }]);
      
      toast({
        title: "Return Received",
        description: `${orderData?.order_number || entry} marked as received`,
      });

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      const { data: refreshedReturns } = await supabase
        .from('returns')
        .select(`
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
        `)
        .order('created_at', { ascending: false });
      
      if (refreshedReturns) setReturns(refreshedReturns);

    } catch (error) {
      console.error('Error processing scan:', error);
      
      // Play error sound
      errorSound.volume = 0.5;
      errorSound.currentTime = 0;
      errorSound.play().catch(e => console.log('Audio play failed:', e));
      
      setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      setRecentScans(prev => [{
        entry,
        type: 'unknown',
        status: 'error',
        message: 'Processing error',
        timestamp: new Date()
      }, ...prev.slice(0, 5)]);
      
      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry,
        orderNumber: '',
        customer: '',
        trackingId: '',
        status: 'error',
        reason: error instanceof Error ? error.message : 'Processing error',
        processingTime: Date.now() - startTime
      }]);
      
      toast({
        title: "Error",
        description: "Failed to process return",
        variant: "destructive"
      });
    }
  };

  const exportScanHistory = () => {
    if (scanHistoryForExport.length === 0) {
      toast({
        title: "No Data",
        description: "No scan history to export",
        variant: "destructive"
      });
      return;
    }

    const csvContent = [
      ['Timestamp', 'Entry', 'Order Number', 'Customer', 'Tracking ID', 'Status', 'Reason', 'Processing Time (ms)'],
      ...scanHistoryForExport.map(scan => [
        scan.timestamp,
        scan.entry,
        scan.orderNumber,
        scan.customer,
        scan.trackingId,
        scan.status,
        scan.reason,
        scan.processingTime
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `returns-scan-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${scanHistoryForExport.length} scan records`,
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

  // Scanner Mode: Register scan callback
  useEffect(() => {
    if (scannerModeActive) {
      console.log('Scanner mode active, registering callback');
      const cleanup = scanner.onScan((data) => {
        console.log('Scanner input received:', data);
        processScannerInput(data);
      });
      return cleanup;
    }
  }, [scannerModeActive, scanner]);

  // Scanner Mode: Auto-timeout after 5 minutes
  useEffect(() => {
    if (!scannerModeActive) return;

    const timeout = setTimeout(() => {
      const timeSinceLastScan = Date.now() - lastScanTime;
      if (timeSinceLastScan >= 300000) { // 5 minutes
        deactivateScannerMode();
        toast({
          title: "Scanner Mode Timeout",
          description: "Scanner mode automatically stopped after 5 minutes of inactivity",
        });
      }
    }, 300000);

    return () => clearTimeout(timeout);
  }, [scannerModeActive, lastScanTime]);

  // Scanner Mode: Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ESC to stop scanner mode
      if (e.key === 'Escape' && scannerModeActive) {
        e.preventDefault();
        deactivateScannerMode();
      }

      // Ctrl+Shift+S to toggle scanner mode
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (scannerModeActive) {
          deactivateScannerMode();
        } else {
          activateScannerMode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [scannerModeActive]);

  // Scanner Mode: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerModeActive) {
        setScannerModeActive(false);
      }
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-gray-600 mt-1">Track and manage returned orders</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={activateScannerMode}
            disabled={scannerModeActive}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ScanBarcode className="h-4 w-4 mr-2" />
            Scan to Return
          </Button>
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

      {/* Scanner Mode Floating Panel */}
      {scannerModeActive && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-2xl border-2 border-blue-500 animate-in slide-in-from-bottom-5 z-50 p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                <span className="font-semibold text-gray-900">Scanner Active</span>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={deactivateScannerMode}
                className="h-7"
              >
                Stop
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-green-50 rounded border border-green-200">
                <div className="text-gray-500 text-xs">Success</div>
                <div className="text-lg font-bold text-green-600">{scannerStats.success}</div>
              </div>
              <div className="p-2 bg-red-50 rounded border border-red-200">
                <div className="text-gray-500 text-xs">Errors</div>
                <div className="text-lg font-bold text-red-600">{scannerStats.errors}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportScanHistory}
                disabled={scanHistoryForExport.length === 0}
                className="flex-1"
              >
                <Download className="h-3 w-3 mr-1" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setRecentScans([]);
                  setScanHistoryForExport([]);
                }}
                disabled={recentScans.length === 0}
                className="flex-1"
              >
                Clear
              </Button>
            </div>

            {/* Recent Scans */}
            {recentScans.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500">Recent Scans</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {recentScans.slice(0, 6).map((scan, idx) => (
                    <div 
                      key={idx}
                      className={`p-2 rounded text-xs ${
                        scan.status === 'success' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono truncate">{scan.entry}</div>
                          {scan.orderId && (
                            <div className="text-gray-600 truncate">{scan.orderId}</div>
                          )}
                        </div>
                        <Badge 
                          variant={scan.status === 'success' ? 'default' : 'destructive'}
                          className="text-xs shrink-0"
                        >
                          {scan.message}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard Shortcuts */}
            <div className="pt-2 border-t text-xs text-gray-500">
              <div>Press <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">ESC</kbd> to stop</div>
              <div className="mt-1"><kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl+Shift+S</kbd> to toggle</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ReturnsDashboard;