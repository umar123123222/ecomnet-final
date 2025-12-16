import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Search, Download, Edit, Truck, ChevronDown, ChevronUp, Plus, Filter, Lock, ScanBarcode, Package, RefreshCw, DollarSign, ArrowUp } from 'lucide-react';
import { PageContainer, PageHeader, StatsCard, StatsGrid } from '@/components/layout';
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
import { useHandheldScanner } from '@/contexts/HandheldScannerContext';
import { useScannerMode } from '@/hooks/useScannerMode';

const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [totalDispatchCount, setTotalDispatchCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [courierFilter, setCourierFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: addDays(new Date(), -7),
    to: new Date()
  });
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isNewDispatchOpen, setIsNewDispatchOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [allowManualEntry, setAllowManualEntry] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<Array<{ entry: string; error: string; errorCode?: string }>>([]);
  const [visibleCount, setVisibleCount] = useState(100);
  
  // Scanner Mode Action (dispatch-specific)
  const [scannerModeAction, setScannerModeAction] = useState<'dispatch' | null>(null);
  
  // Use shared scanner mode hook
  const scannerMode = useScannerMode({ storageKey: 'dispatch_entry_type', maxConcurrent: 5 });
  const {
    scannerModeActive, setScannerModeActive,
    scannerStats, setScannerStats,
    recentScans, setRecentScans,
    scanHistoryForExport, setScanHistoryForExport,
    lastScanTime, setLastScanTime,
    hasFocus, setHasFocus,
    focusLostTime, setFocusLostTime,
    scanBuffer, setScanBuffer,
    scannerInputRef,
    entryType, setEntryType,
    performanceMetrics, setPerformanceMetrics,
    processingQueue, setProcessingQueue,
    activeProcessing, setActiveProcessing,
    processingRef, maxConcurrent,
    showScrollTop, scrollToTop,
    successSound, errorSound,
    addScanResult, resetScannerStats
  } = scannerMode;
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const handheldScanner = useHandheldScanner();
  
  const handleShowMore = () => {
    setVisibleCount(prev => prev + 500);
  };

  const handleShowAll = () => {
    setVisibleCount(filteredDispatches.length);
  };
  
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
  
  // Memoize courier lookup for O(1) access
  const courierMap = useMemo(() => {
    return new Map(couriers.map(c => [c.id, c]));
  }, [couriers]);
  
  // Fetch all users for dispatcher filter
  const { data: users = [] } = useQuery({
    queryKey: ['dispatch-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
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
      // Build date filter conditions
      let dateFromISO = '';
      let dateToISO = '';
      
      if (dateRange?.from) {
        const fromDate = new Date(dateRange.from);
        fromDate.setHours(0, 0, 0, 0);
        dateFromISO = fromDate.toISOString();
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to);
        toDate.setHours(23, 59, 59, 999);
        dateToISO = toDate.toISOString();
      }

      // Count query (no row limit) to get accurate total dispatches for applied filters
      let countQuery = supabase
        .from('dispatches')
        .select('*', { count: 'exact', head: true });

      // Apply date range filters using proper gte/lte on dispatch_date
      if (dateFromISO) {
        countQuery = countQuery.gte('dispatch_date', dateFromISO);
      }
      if (dateToISO) {
        countQuery = countQuery.lte('dispatch_date', dateToISO);
      }
      
      // Apply courier filter server-side
      if (courierFilter && courierFilter !== "all") {
        countQuery = countQuery.ilike('courier', courierFilter);
      }
      
      // Apply user filter server-side
      if (userFilter && userFilter !== "all") {
        countQuery = countQuery.eq('dispatched_by', userFilter);
      }

      const { count, error: countError } = await countQuery;

      if (countError) {
        console.error('Error fetching dispatch count:', countError);
      } else if (typeof count === 'number') {
        setTotalDispatchCount(count);
      }

      // Fetch data in chunks of 1000 to bypass Supabase row limit
      const CHUNK_SIZE = 1000;
      const totalCount = count || 0;
      const chunks = Math.ceil(totalCount / CHUNK_SIZE);
      let allData: any[] = [];

      for (let i = 0; i < chunks; i++) {
        let dataQuery = supabase
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
              status,
              order_packaging (
                id,
                packaging_items (name, sku)
              )
            )
          `);

        // Apply date range filters on dispatch_date
        if (dateFromISO) {
          dataQuery = dataQuery.gte('dispatch_date', dateFromISO);
        }
        if (dateToISO) {
          dataQuery = dataQuery.lte('dispatch_date', dateToISO);
        }
        
        // Apply courier filter server-side
        if (courierFilter && courierFilter !== "all") {
          dataQuery = dataQuery.ilike('courier', courierFilter);
        }
        
        // Apply user filter server-side
        if (userFilter && userFilter !== "all") {
          dataQuery = dataQuery.eq('dispatched_by', userFilter);
        }
        
        dataQuery = dataQuery
          .order('dispatch_date', { ascending: false })
          .range(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE - 1);

        const { data, error } = await dataQuery;

        if (error) {
          console.error('Error fetching dispatches chunk:', error);
          toast({
            title: "Error",
            description: "Failed to fetch dispatches",
            variant: "destructive"
          });
          return;
        }

        if (data) {
          allData = [...allData, ...data];
        }
      }

      // Fetch profiles separately for dispatched_by users
      const userIds = [...new Set(allData?.filter(d => d.dispatched_by).map(d => d.dispatched_by) || [])];
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

      const enrichedDispatches = allData?.map(dispatch => ({
        ...dispatch,
        dispatched_by_user: dispatch.dispatched_by ? profilesById[dispatch.dispatched_by] : null,
      })) || [];

      setDispatches(enrichedDispatches);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  fetchDispatches();

  // Set up real-time subscription with debounced refresh
  let refreshTimeout: NodeJS.Timeout;
  const channel = supabase
    .channel('dispatch-changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'dispatches'
    }, () => {
      // Debounce rapid consecutive changes
      clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        console.log('Dispatch change detected, refreshing data...');
        fetchDispatches();
      }, 300);
    })
    .subscribe();

  return () => {
    clearTimeout(refreshTimeout);
    supabase.removeChannel(channel);
  };
}, [toast, dateRange, courierFilter, userFilter]);
  // Date filtering now happens server-side, so filteredByDate just references dispatches
  const filteredByDate = useMemo(() => {
    return dispatches;
  }, [dispatches]);
  const filteredDispatches = useMemo(() => {
    return filteredByDate.filter(dispatch => {
      const matchesSearch = (dispatch.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_phone || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourier = courierFilter === "all" || 
        dispatch.courier?.toLowerCase() === courierFilter?.toLowerCase();
      const matchesUser = userFilter === "all" || dispatch.dispatched_by === userFilter;
      return matchesSearch && matchesCourier && matchesUser;
    });
  }, [filteredByDate, searchTerm, courierFilter, userFilter]);
const metrics = useMemo(() => {
  const totalDispatches = totalDispatchCount ?? filteredByDate.length;
  const worthOfDispatches = filteredByDate.reduce((total, dispatch) => {
    return total + (dispatch.orders?.total_amount || 0);
  }, 0);
  const courierCounts = filteredDispatches.reduce((acc, d) => {
    acc[d.courier] = (acc[d.courier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const entries = Object.entries(courierCounts);
  const mostUsedCourier = entries.length > 0 
    ? entries.sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] 
    : 'N/A';
  return {
    totalDispatches,
    worthOfDispatches,
    mostUsedCourier
  };
}, [filteredByDate, filteredDispatches, totalDispatchCount]);
  const handleSelectDispatch = useCallback((dispatchId: string) => {
    setSelectedDispatches(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  }, []);
  
  const handleSelectAll = useCallback(() => {
    setSelectedDispatches(prev => prev.length === filteredDispatches.length ? [] : filteredDispatches.map(d => d.id));
  }, [filteredDispatches]);
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

    // Capture user ID at the start to prevent race conditions
    const currentUserId = user.id;
    
    if (!currentUserId) {
      toast({
        title: "Error",
        description: "Invalid user session. Please log out and log back in.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Parse entries - one entry per line
      const entries = data.bulkEntries.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Remove duplicates
      const uniqueEntries = [...new Set(entries)];
      const duplicateCount = entries.length - uniqueEntries.length;

      if (duplicateCount > 0) {
        toast({
          title: "Duplicates Removed",
          description: `${duplicateCount} duplicate ${duplicateCount === 1 ? 'entry' : 'entries'} removed from the list.`,
        });
      }
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];
      const bulkErrorsList: Array<{ entry: string; error: string; errorCode?: string }> = [];
      
      for (const entry of uniqueEntries) {
        // Validate entry format before processing
        const validation = validateTrackingEntry(entry);
        if (!validation.valid) {
          errors.push(`${validation.error}: ${entry}`);
          bulkErrorsList.push({ entry, error: validation.error!, errorCode: validation.errorCode });
          errorCount++;
          continue;
        }
        
        // Find order by selected entry type
        let order;
        
        if (entryType === 'tracking_id') {
          const { data, error: orderError } = await supabase
            .from('orders')
            .select('id, tracking_id, order_number, courier')
            .eq('tracking_id', entry)
            .maybeSingle();
          order = data;
        } else {
          // For order number, try exact match first, then partial match
          let { data, error: orderError } = await supabase
            .from('orders')
            .select('id, tracking_id, order_number, courier')
            .eq('order_number', entry)
            .maybeSingle();
          
          // If no exact match, try with SHOP- prefix or partial match
          if (!data) {
            const { data: partialData } = await supabase
              .from('orders')
              .select('id, tracking_id, order_number, courier')
              .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
              .limit(1)
              .maybeSingle();
            data = partialData;
          }
          order = data;
        }
        
        if (!order) {
          errors.push(`Order not found for ${entryType === 'tracking_id' ? 'tracking ID' : 'order number'}: ${entry}`);
          bulkErrorsList.push({ entry, error: 'Order not found in database', errorCode: 'NOT_FOUND' });
          errorCount++;
          continue;
        }

        // Determine courier for this specific order
        let courierNameForOrder = '';
        let courierCodeForOrder: Database["public"]["Enums"]["courier_type"] | undefined = undefined;
        let courierIdForOrder = selectedCourier;

        if (order.courier) {
          // Order already has a courier - use that
          const orderCourier = couriers.find(c => c.code === order.courier);
          if (orderCourier) {
            courierIdForOrder = orderCourier.id;
            courierNameForOrder = orderCourier.name;
            courierCodeForOrder = orderCourier.code as Database["public"]["Enums"]["courier_type"];
          } else {
            courierNameForOrder = order.courier;
            courierCodeForOrder = order.courier as Database["public"]["Enums"]["courier_type"];
          }
        } else if (selectedCourier) {
          // No courier on order, use selected courier
          const selectedCourierObj = couriers.find(c => c.id === selectedCourier);
          if (selectedCourierObj) {
            courierNameForOrder = selectedCourierObj.name;
            courierCodeForOrder = selectedCourierObj.code as Database["public"]["Enums"]["courier_type"];
          }
        }

        // Validate that we have a courier
        if (!courierNameForOrder) {
          errors.push(`No courier assigned for order ${entry}`);
          bulkErrorsList.push({ entry, error: 'No courier assigned to this order', errorCode: 'NO_COURIER' });
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
          // Prevent duplicate dispatch
          errors.push(`Order ${order.order_number} has already been dispatched`);
          bulkErrorsList.push({ entry, error: 'Order already dispatched', errorCode: 'ALREADY_DISPATCHED' });
          errorCount++;
          continue;
        } else {
          // Create new dispatch
          const {
            error: dispatchError
          } = await supabase.from('dispatches').insert({
            order_id: order.id,
            tracking_id: trackingId,
            courier: courierNameForOrder,
            courier_id: courierIdForOrder,
            dispatched_by: currentUserId,
            dispatch_date: new Date().toISOString()
          });
          if (dispatchError) {
            errors.push(`Failed to create dispatch for ${entry}: ${dispatchError.message}`);
            errorCount++;
            continue;
          }
        }

        // Build update object conditionally
        const orderUpdate: any = {
          status: 'dispatched',
          dispatched_at: new Date().toISOString()
        };

        // Only update courier if order doesn't have one AND a courier is selected
        if (!order.courier && courierCodeForOrder) {
          orderUpdate.courier = courierCodeForOrder;
        }

        // Update order status to dispatched
        const {
          error: updateError
        } = await supabase.from('orders').update(orderUpdate).eq('id', order.id);
        
        // Log activity
        await logActivity({
          entityType: 'dispatch',
          entityId: existingDispatch?.id || order.id,
          action: 'order_dispatched',
          details: {
            order_id: order.id,
            tracking_id: trackingId,
            courier: courierNameForOrder,
            courier_id: courierIdForOrder,
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
        
        // Immediately refetch dispatches to show updated data
        const fetchDispatchesFunction = async () => {
          try {
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
              
            if (error) throw error;

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

            const enrichedDispatches = data?.map(dispatch => ({
              ...dispatch,
              dispatched_by_user: dispatch.dispatched_by ? profilesById[dispatch.dispatched_by] : null
            })) || [];

            setDispatches(enrichedDispatches);
          } catch (error) {
            console.error('Error refetching dispatches:', error);
          }
        };
        
        fetchDispatchesFunction();
        
        // Clear the form after successful processing
        form.reset({ bulkEntries: '' });
      }
      if (errors.length > 0) {
        console.error('Bulk entry errors:', errors);
        setBulkErrors(bulkErrorsList); // Store errors for UI display
        toast({
          title: "Some Entries Failed",
          description: `${errorCount} entries failed. See details below.`,
          variant: "destructive"
        });
      }
      
      if (successCount > 0 && errorCount === 0) {
        setIsManualEntryOpen(false);
        setBulkErrors([]); // Clear errors on full success
      }
    } catch (error) {
      console.error('Bulk entry error:', error);
      toast({
        title: "Error",
        description: "Failed to process bulk entries",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const toggleRowExpansion = useCallback((dispatchId: string) => {
    setExpandedRows(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  }, []);

  // Set up scanner listener when manual entry is disabled
  useEffect(() => {
    if (!allowManualEntry && isManualEntryOpen) {
      // When manual entry is off, listen for scanner input
      const cleanup = handheldScanner.onScan((scannedData) => {
        // Get current value from textarea
        const currentValue = form.getValues('bulkEntries');
        
        // Append scanned data on a new line (or as first line if empty)
        const newValue = currentValue 
          ? `${currentValue}\n${scannedData}` 
          : scannedData;
        
        // Programmatically set the textarea value
        form.setValue('bulkEntries', newValue);
      });
      
      return cleanup;
    }
  }, [allowManualEntry, isManualEntryOpen, handheldScanner, form]);

  // Scanner Mode: Activate scanner mode
  const activateScannerMode = async () => {
    setScannerModeAction('dispatch');
    setScannerModeActive(true);
    setScannerStats({ success: 0, errors: 0 });
    setRecentScans([]);
    setScanHistoryForExport([]);
    setLastScanTime(Date.now());

    toast({
      title: "🎯 Scanner Mode Enabled",
      description: `Scan orders to dispatch. Press ESC to exit.`,
      duration: 4000,
    });

    try {
      successSound.volume = 0.3;
      await successSound.play();
    } catch (e) {
      console.log('Audio play prevented by browser');
    }
  };

  // Scanner Mode: Find order by entry
  const findOrderByEntry = async (entry: string): Promise<{
    order: any;
    matchType: 'order_number' | 'tracking_id';
  } | null> => {
    try {
      let { data: orderData } = await supabase
        .from('orders')
        .select('id, tracking_id, order_number, customer_name, total_amount, courier, status')
        .eq('order_number', entry)
        .maybeSingle();

      if (orderData) {
        return { order: orderData, matchType: 'order_number' };
      }

      const { data: partialOrderData } = await supabase
        .from('orders')
        .select('id, tracking_id, order_number, customer_name, total_amount, courier, status')
        .or(`order_number.eq.SHOP-${entry},order_number.ilike.%${entry}%,shopify_order_number.eq.${entry}`)
        .limit(1)
        .maybeSingle();

      if (partialOrderData) {
        return { order: partialOrderData, matchType: 'order_number' };
      }

      const { data: trackingData } = await supabase
        .from('orders')
        .select('id, tracking_id, order_number, customer_name, total_amount, courier, status')
        .eq('tracking_id', entry)
        .maybeSingle();

      if (trackingData) {
        return { order: trackingData, matchType: 'tracking_id' };
      }

      return null;
    } catch (error) {
      console.error('Error searching for order:', error);
      return null;
    }
  };

  // Validation helper
  const validateTrackingEntry = (entry: string): { valid: boolean; error?: string; errorCode?: string } => {
    if (entry.length < 5) {
      return { 
        valid: false, 
        error: 'Entry too short - enter complete tracking ID or order number (minimum 5 characters)',
        errorCode: 'INVALID_FORMAT'
      };
    }
    
    if (/^\d+\.?\d*[eE][+\-]?\d+$/.test(entry)) {
      return { 
        valid: false, 
        error: 'Invalid format - Excel scientific notation detected. Format column as Text first.',
        errorCode: 'INVALID_FORMAT'
      };
    }
    
    const courierNames = ['postex', 'leopard', 'tcs', 'callcourier', 'call courier', 'dhl', 'fedex', 'm&p', 'swyft', 'trax'];
    if (courierNames.includes(entry.toLowerCase())) {
      return { 
        valid: false, 
        error: 'Enter tracking ID or order number, not courier name',
        errorCode: 'INVALID_FORMAT'
      };
    }
    
    return { valid: true };
  };

  // Scanner Mode: Process scanned input with OPTIMISTIC UPDATE AND PARALLEL PROCESSING
  const processScannerInput = async (scannedValue: string) => {
    if (!scannerModeActive || !scannerModeAction || !user?.id) return;

    const trimmedValue = scannedValue.trim();

    if (!trimmedValue) {
      errorSound.volume = 0.5;
      errorSound.currentTime = 0;
      errorSound.play().catch(e => console.log('Audio play failed:', e));
      
      toast({
        title: "⚠️ Empty Scan",
        description: "Scanned value is empty",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    // Frontend validation before calling edge function
    const validation = validateTrackingEntry(trimmedValue);
    if (!validation.valid) {
      errorSound.volume = 0.5;
      errorSound.currentTime = 0;
      errorSound.play().catch(e => console.log('Audio play failed:', e));
      
      setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      setRecentScans(prev => [{
        entry: trimmedValue,
        type: 'unknown',
        status: 'error',
        message: validation.error!,
        timestamp: new Date()
      }, ...prev.slice(0, 9)]);

      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry: trimmedValue,
        status: 'error',
        reason: validation.error,
        matchType: 'unknown'
      }]);
      
      toast({
        title: "❌ Invalid Entry",
        description: validation.error,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Check if already processing
    if (processingRef.current.has(trimmedValue)) {
      toast({
        title: "⚠️ Duplicate Scan",
        description: "Already processing this entry",
        duration: 1000,
      });
      return;
    }

    // Add to processing queue
    setProcessingQueue(prev => [...prev, trimmedValue]);
    processingRef.current.add(trimmedValue);
    setActiveProcessing(new Set(processingRef.current));

    // OPTIMISTIC UI UPDATE - Show as processing immediately
    const processingId = `${trimmedValue}-${Date.now()}`;
    setRecentScans(prev => [{
      entry: trimmedValue,
      type: 'unknown',
      status: 'success' as const,
      message: '⚙️ Processing...',
      timestamp: new Date(),
      orderId: processingId
    }, ...prev.slice(0, 9)]);
    setLastScanTime(Date.now());

    // Process asynchronously without blocking
    (async () => {
      const scanStartTime = Date.now();
      
      try {
        // Get courier info for edge function
        let courierIdForCall = selectedCourier;
        let courierNameForCall = '';
        let courierCodeForCall = '';

        // Use O(1) Map lookup instead of array.find()
        if (selectedCourier) {
          const selectedCourierObj = courierMap.get(selectedCourier);
          if (selectedCourierObj) {
            courierNameForCall = selectedCourierObj.name;
            courierCodeForCall = selectedCourierObj.code;
          }
        }

        // Call optimized edge function
        const { data, error } = await supabase.functions.invoke('rapid-dispatch', {
          body: {
            entry: trimmedValue,
            courierId: courierIdForCall,
            courierName: courierNameForCall,
            courierCode: courierCodeForCall,
            userId: user.id
          }
        });

        const processingTime = Date.now() - scanStartTime;

        // Remove from queue and processing set
        setProcessingQueue(prev => prev.filter(e => e !== trimmedValue));
        processingRef.current.delete(trimmedValue);
        setActiveProcessing(new Set(processingRef.current));

        // Update performance metrics
        setPerformanceMetrics(prev => {
          const newTotal = prev.totalScans + 1;
          const newAvg = ((prev.avgProcessingTime * prev.totalScans) + processingTime) / newTotal;
          return {
            avgProcessingTime: Math.round(newAvg),
            totalScans: newTotal,
            scansPerMinute: Math.round((newTotal / ((Date.now() - (lastScanTime - (prev.totalScans * 3000))) / 60000)) * 10) / 10,
            queueLength: processingQueue.length,
            currentlyProcessing: processingRef.current.size
          };
        });

        if (error || !data?.success) {
        const errorMsg = data?.error || error?.message || 'Failed';
        const errorCode = data?.errorCode || 'UNKNOWN_ERROR';
        
        // Map error codes to icons and colors
        const getErrorIcon = (code: string) => {
          switch (code) {
            case 'NOT_FOUND': return '🔍';
            case 'ALREADY_DISPATCHED': return '🔄';
            case 'NO_COURIER': return '📦';
            case 'INVALID_FORMAT': return '⚠️';
            default: return '❌';
          }
        };
        
        const errorIcon = getErrorIcon(errorCode);
        
        // Silent notification for already dispatched orders (no error sound)
        const isAlreadyDispatched = errorCode === 'ALREADY_DISPATCHED';
        
        if (!isAlreadyDispatched) {
          // Play error sound for actual errors only
          errorSound.volume = 0.5;
          errorSound.currentTime = 0;
          errorSound.play().catch(e => console.log('Audio play failed:', e));
        }
        
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => prev.map(scan => 
          scan.orderId === processingId 
            ? { 
                ...scan, 
                type: data?.matchType || 'unknown' as const, 
                status: 'error' as const, 
                message: `${errorIcon} ${errorMsg}${data?.suggestion ? ` (${data.suggestion})` : ''}`,
                orderId: data?.order?.order_number || processingId
              }
            : scan
        ));

        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry: trimmedValue,
          orderNumber: data?.order?.order_number || '',
          status: isAlreadyDispatched ? 'already_dispatched' : 'error',
          reason: errorMsg,
          errorCode: errorCode,
          suggestion: data?.suggestion || '',
          matchType: data?.matchType || 'unknown',
          processingTime: `${processingTime}ms`
        }]);

        toast({
          title: `${errorIcon} ${errorMsg}`,
          description: data?.suggestion || data?.order?.order_number || trimmedValue,
          variant: isAlreadyDispatched ? "default" : "destructive",
          duration: isAlreadyDispatched ? 1500 : 2500,
        });
        return;
      }

      // SUCCESS - Play success sound immediately
      successSound.volume = 0.4;
      successSound.currentTime = 0;
      successSound.play().catch(e => console.log('Audio play failed:', e));

      // Data is returned at top level from rapid_dispatch_order function
      const orderNumber = data.order_number || data.order?.order_number || trimmedValue;
      const customerName = data.customer_name || data.order?.customer_name || '';
      const totalAmount = data.total_amount || data.order?.total_amount || 0;
      const courierName = data.courier || 'Unknown';
      
      const successMsg = `${orderNumber} via ${courierName}`;

      setScannerStats(prev => ({ ...prev, success: prev.success + 1 }));
      setRecentScans(prev => prev.map(scan => 
        scan.orderId === processingId 
          ? { 
              ...scan, 
              type: data.matchType || data.match_type, 
              status: 'success' as const, 
              message: successMsg, 
              orderId: orderNumber, 
              courier: courierName 
            }
          : scan
      ));

      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry: trimmedValue,
        orderNumber: orderNumber,
        customerName: customerName,
        amount: totalAmount,
        courier: courierName,
        trackingId: data.tracking_id || '',
        status: 'success',
        processingTime: `${processingTime}ms`,
        matchType: data.matchType || data.match_type || 'unknown'
      }]);

      toast({
        title: "✅ Dispatched",
        description: successMsg,
        duration: 1000,
      });

      // Optimistic update instead of full invalidation
      queryClient.invalidateQueries({ queryKey: ['dispatches'] });

      } catch (error: any) {
        console.error('Error processing scan:', error);

        // Remove from queue and processing set
        setProcessingQueue(prev => prev.filter(e => e !== trimmedValue));
        processingRef.current.delete(trimmedValue);
        setActiveProcessing(new Set(processingRef.current));
        
        // Play error sound immediately
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));

        const errorMsg = error.message || 'Failed';
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => prev.map(scan => 
          scan.orderId === processingId 
            ? { ...scan, type: 'unknown' as const, status: 'error' as const, message: errorMsg }
            : scan
        ));

        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry: trimmedValue,
          status: 'error',
          reason: errorMsg,
          matchType: 'unknown'
        }]);

        toast({
          title: "❌ Failed",
          description: errorMsg,
          variant: "destructive",
          duration: 2500,
        });
      }
    })(); // Execute async immediately without blocking
  };

  // Scanner Mode: Deactivate scanner mode
  const deactivateScannerMode = () => {
    setScannerModeActive(false);
    setScannerModeAction(null);
    
    toast({
      title: "📊 Scanner Mode Disabled",
      description: `Processed: ${scannerStats.success} successful, ${scannerStats.errors} errors`,
      duration: 5000,
    });
  };

  // Scanner Mode: Export scan history
  const exportScanHistory = () => {
    if (scanHistoryForExport.length === 0) {
      toast({
        title: "No Data",
        description: "No scan history to export",
        variant: "destructive"
      });
      return;
    }

    const csv = [
      ['Timestamp', 'Entry', 'Order Number', 'Customer', 'Amount', 'Courier', 'Tracking ID', 'Status', 'Reason', 'Match Type', 'Processing Time'].join(','),
      ...scanHistoryForExport.map(scan => [
        scan.timestamp,
        scan.entry,
        scan.orderNumber || '',
        scan.customerName || '',
        scan.amount || '',
        scan.courier || '',
        scan.trackingId || '',
        scan.status,
        scan.reason || '',
        scan.matchType || '',
        scan.processingTime || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispatch-scan-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "✅ Exported",
      description: `${scanHistoryForExport.length} scan records exported`,
    });
  };

  // Focus Management: Handle scanner input focus trap
  const handleScannerFocusLost = () => {
    if (scannerModeActive) {
      setHasFocus(false);
      setFocusLostTime(Date.now());
      
      // Play warning sound
      errorSound.volume = 0.3;
      errorSound.currentTime = 0;
      errorSound.play().catch(e => console.log('Audio play failed:', e));
      
      console.warn('⚠️ Scanner focus lost!');
    }
  };

  const handleScannerFocusGained = () => {
    setHasFocus(true);
    setFocusLostTime(null);
  };

  const restoreScannerFocus = () => {
    // Use requestAnimationFrame for smoother focus restoration
    requestAnimationFrame(() => {
      scannerInputRef.current?.focus();
      setHasFocus(true);
      setFocusLostTime(null);
    });
  };

  // Scanner Mode: Hidden input change handler
  const handleScanBufferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanBuffer(value);
    
    // Check for Enter key (scanner sends it)
    if (value.includes('\n') || value.includes('\r')) {
      const cleanValue = value.replace(/[\n\r]/g, '').trim();
      if (cleanValue) {
        processScannerInput(cleanValue);
      }
      setScanBuffer(''); // Clear buffer
      e.target.value = ''; // Clear input
    }
  };

  // Scanner Mode: Register scan callback and focus management
  useEffect(() => {
    if (scannerModeActive) {
      console.log('Scanner mode active, setting up focus trap');
      
      // Focus the hidden input
      requestAnimationFrame(() => {
        scannerInputRef.current?.focus();
      });
      
      // Register HID scanner callback as backup
      const cleanup = handheldScanner.onScan((data) => {
        console.log('HID Scanner input received:', data);
        processScannerInput(data);
      });
      
      // Monitor focus every 300ms with requestAnimationFrame for efficiency
      let rafId: number;
      const focusMonitor = setInterval(() => {
        rafId = requestAnimationFrame(() => {
          if (document.activeElement !== scannerInputRef.current) {
            console.warn('Focus lost, attempting to restore...');
            scannerInputRef.current?.focus();
          }
        });
      }, 300);
      
      return () => {
        cleanup();
        clearInterval(focusMonitor);
        if (rafId) cancelAnimationFrame(rafId);
      };
    }
  }, [scannerModeActive, handheldScanner.isConnected]);

  // Scanner Mode: Auto-timeout after 5 minutes
  useEffect(() => {
    if (!scannerModeActive) return;

    const timeoutId = setTimeout(() => {
      const timeSinceLastScan = Date.now() - lastScanTime;
      if (timeSinceLastScan >= 300000) {
        deactivateScannerMode();
        toast({
          title: "Scanner Mode Timeout",
          description: "Scanner mode disabled due to inactivity",
        });
      }
    }, 300000);

    return () => clearTimeout(timeoutId);
  }, [scannerModeActive, lastScanTime]);

  // Scanner Mode: ESC key and keyboard shortcuts
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && scannerModeActive) {
        deactivateScannerMode();
      }
    };

    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        if (scannerModeActive) {
          deactivateScannerMode();
        } else {
          activateScannerMode();
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    window.addEventListener('keydown', handleKeyboardShortcut);
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('keydown', handleKeyboardShortcut);
    };
  }, [scannerModeActive, selectedCourier]);

  // Scanner Mode: Auto-disable on unmount
  useEffect(() => {
    return () => {
      if (scannerModeActive) {
        deactivateScannerMode();
      }
    };
  }, []);

  return <PageContainer className="relative">
      {/* Hidden Focus Trap Input for Scanner */}
      {scannerModeActive && (
        <input
          ref={scannerInputRef}
          type="text"
          className="absolute -left-[9999px] w-1 h-1 opacity-0"
          onBlur={handleScannerFocusLost}
          onFocus={handleScannerFocusGained}
          autoFocus
          value={scanBuffer}
          onChange={handleScanBufferChange}
          aria-label="Scanner input capture"
        />
      )}

      {/* Semi-transparent Overlay during Scanner Mode */}
      {scannerModeActive && (
        <div 
          className="fixed inset-0 bg-blue-500/5 pointer-events-none z-40 transition-all duration-300"
          style={{
            animation: hasFocus ? 'pulse 3s ease-in-out infinite' : 'none',
            borderWidth: hasFocus ? '4px' : '8px',
            borderStyle: 'solid',
            borderColor: hasFocus ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.6)',
          }}
        />
      )}

      {/* Focus Lost Warning Banner */}
      {scannerModeActive && !hasFocus && (
        <div 
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl cursor-pointer hover:bg-red-700 transition-all animate-pulse"
          onClick={restoreScannerFocus}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <div className="font-bold text-lg">SCANNER INPUT LOST!</div>
              <div className="text-sm">Click here or press any key to restore scanner mode</div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispatch Management</h1>
          <p className="text-gray-600 mt-1">Track and manage order dispatches</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Select
            value={selectedCourier || ''}
            onValueChange={setSelectedCourier}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select courier" />
            </SelectTrigger>
            <SelectContent>
              {couriers.map(courier => (
                <SelectItem key={courier.id} value={courier.id}>
                  <div className="flex items-center gap-2">
                    <span>{courier.name}</span>
                    {!courier.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => window.location.reload()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>

          <Button
            onClick={activateScannerMode}
            disabled={scannerModeActive}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <ScanBarcode className="mr-2 h-4 w-4" />
            {scannerModeActive ? 'Scanner Active...' : 'Scan to Dispatch'}
          </Button>

          <Dialog open={isManualEntryOpen} onOpenChange={(open) => {
            if (!isProcessing || !open) {
              setIsManualEntryOpen(open);
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={scannerModeActive}>
                <Edit className="h-4 w-4 mr-2" />
                Bulk Entry
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
                          {!allowManualEntry && !handheldScanner.isConnected && (
                            <div className="p-2 mt-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              <Lock className="h-4 w-4 inline mr-1" />
                              Scanner not connected. Connect scanner or enable manual entry.
                            </div>
                          )}
                          {!allowManualEntry && handheldScanner.isConnected && (
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
                              readOnly={!allowManualEntry}
                              disabled={!allowManualEntry && !handheldScanner.isConnected}
                            />
                          </FormControl>
                          {isProcessing && (
                            <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-md text-sm text-primary flex items-center gap-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                              <span className="font-medium">Processing entries, please wait...</span>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1">
                            {entryType === 'tracking_id' 
                              ? 'Enter courier tracking numbers (e.g., TRK123456789)'
                              : 'Enter order numbers (e.g., ORD-12345)'}
                          </p>
                          <FormMessage />
                        </FormItem>} />
                        
                        {/* Bulk Errors Display */}
                        {bulkErrors.length > 0 && (
                          <div className="mt-4 border rounded-lg p-4 bg-destructive/5 max-h-64 overflow-y-auto">
                            <p className="font-semibold text-destructive mb-3 flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                                {bulkErrors.length}
                              </span>
                              Failed Entries
                            </p>
                            <div className="space-y-2">
                              {bulkErrors.map((e, i) => {
                                const getErrorIcon = (code?: string) => {
                                  if (code === 'NOT_FOUND') return '🔍';
                                  if (code === 'ALREADY_DISPATCHED') return '🔄';
                                  if (code === 'NO_COURIER') return '📦';
                                  if (code === 'INVALID_FORMAT') return '⚠️';
                                  return '❌';
                                };
                                
                                const getErrorBg = (code?: string) => {
                                  if (code === 'NOT_FOUND') return 'bg-amber-50 border-amber-200 text-amber-900';
                                  if (code === 'ALREADY_DISPATCHED') return 'bg-blue-50 border-blue-200 text-blue-900';
                                  if (code === 'NO_COURIER') return 'bg-orange-50 border-orange-200 text-orange-900';
                                  if (code === 'INVALID_FORMAT') return 'bg-yellow-50 border-yellow-200 text-yellow-900';
                                  return 'bg-red-50 border-red-200 text-red-900';
                                };
                                
                                return (
                                  <div key={i} className={`text-sm p-3 border rounded ${getErrorBg(e.errorCode)}`}>
                                    <div className="flex items-start gap-2">
                                      <span className="text-base">{getErrorIcon(e.errorCode)}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-mono font-semibold break-all">{e.entry}</p>
                                        <p className="text-xs mt-1 opacity-90">{e.error}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsManualEntryOpen(false)}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={isProcessing || (!allowManualEntry && !handheldScanner.isConnected)}
                    >
                      {isProcessing ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                          Processing...
                        </>
                      ) : (
                        'Process Entries'
                      )}
                    </Button>
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
              Most Used Courier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{metrics.mostUsedCourier}</div>
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
            <span>Dispatches ({totalDispatchCount ?? filteredDispatches.length})</span>
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
              <Select value={courierFilter} onValueChange={setCourierFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Courier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Couriers</SelectItem>
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.name}>
                      {courier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="User" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-muted-foreground">Loading dispatches...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDispatches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                        <Truck className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">No dispatches found</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {searchTerm || courierFilter !== 'all' || userFilter !== 'all'
                          ? 'Try adjusting your filters to see more results.'
                          : 'No dispatches in the selected date range. Try expanding the date range.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDispatches.slice(0, visibleCount).map(dispatch => {
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
          
          {/* Record Count & Pagination Controls */}
          {!loading && filteredDispatches.length > 0 && (
            <div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {Math.min(visibleCount, filteredDispatches.length).toLocaleString()} of {filteredDispatches.length.toLocaleString()} records
              </span>
              {filteredDispatches.length > visibleCount && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleShowMore}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Show More (+500)
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={handleShowAll}
                    className="gap-2"
                  >
                    Show All ({(filteredDispatches.length - visibleCount).toLocaleString()} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Back to Top Button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 rounded-full w-12 h-12 shadow-lg"
          size="icon"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}

      {/* Scanner Mode Floating Panel */}
      {scannerModeActive && (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-4 w-96 z-50 animate-in slide-in-from-bottom-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div 
                className={`w-3 h-3 rounded-full ${
                  hasFocus ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-ping'
                }`} 
              />
              <h3 className="font-semibold text-gray-900">
                {hasFocus ? 'Scanner Active' : '⚠️ Focus Lost!'}
              </h3>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={deactivateScannerMode}
              className="h-7"
            >
              Stop
            </Button>
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
              <div className="text-blue-600 text-xs font-medium">Avg Time</div>
              <div className={`text-2xl font-bold ${
                performanceMetrics.avgProcessingTime < 500 ? 'text-green-600' : 
                performanceMetrics.avgProcessingTime < 1000 ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {performanceMetrics.avgProcessingTime}ms
              </div>
            </div>
            <div className="bg-green-50 p-2 rounded-lg border border-green-200">
              <div className="text-green-600 text-xs font-medium">Scans/Min</div>
              <div className="text-2xl font-bold text-green-700">
                {performanceMetrics.scansPerMinute}
              </div>
            </div>
          </div>

          {/* Processing Queue Indicator */}
          {processingQueue.length > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <div className="text-sm font-semibold text-yellow-800">
                  ⏳ Queue: {processingQueue.length} items processing...
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs">Action</div>
              <div className="font-medium capitalize">{scannerModeAction}</div>
            </div>
            <div className="bg-gray-50 p-2 rounded">
              <div className="text-gray-500 text-xs">Courier</div>
              <div className="font-medium text-xs">
                {couriers.find(c => c.id === selectedCourier)?.name || 'From Order'}
              </div>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <div className="text-gray-500 text-xs">Success</div>
              <div className="font-bold text-green-600 text-lg">{scannerStats.success}</div>
            </div>
            <div className="bg-red-50 p-2 rounded">
              <div className="text-gray-500 text-xs">Errors</div>
              <div className="font-bold text-red-600 text-lg">{scannerStats.errors}</div>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant="outline"
              onClick={exportScanHistory}
              disabled={scanHistoryForExport.length === 0}
              className="flex-1 h-8 text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRecentScans([]);
                setScanHistoryForExport([]);
                setScannerStats({ success: 0, errors: 0 });
              }}
              className="flex-1 h-8 text-xs"
            >
              Clear
            </Button>
          </div>

          {recentScans.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">Recent Scans:</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recentScans.slice(0, 6).map((scan, idx) => {
                  // Determine error type from message for better color coding
                  const isNotFound = scan.message.includes('🔍') || scan.message.includes('not found');
                  const isAlreadyDispatched = scan.message.includes('🔄') || scan.message.includes('already');
                  const isNoCourier = scan.message.includes('📦') || scan.message.includes('courier');
                  const isInvalidFormat = scan.message.includes('⚠️') || scan.message.includes('Invalid');
                  
                  // Color scheme based on error type
                  let bgColor = 'bg-red-50';
                  let borderColor = 'border-red-200';
                  let textColor = 'text-red-700';
                  
                  if (scan.status === 'success') {
                    bgColor = 'bg-green-50';
                    borderColor = 'border-green-200';
                    textColor = 'text-green-700';
                  } else if (isNotFound) {
                    bgColor = 'bg-amber-50';
                    borderColor = 'border-amber-200';
                    textColor = 'text-amber-700';
                  } else if (isAlreadyDispatched) {
                    bgColor = 'bg-blue-50';
                    borderColor = 'border-blue-200';
                    textColor = 'text-blue-700';
                  } else if (isNoCourier) {
                    bgColor = 'bg-purple-50';
                    borderColor = 'border-purple-200';
                    textColor = 'text-purple-700';
                  } else if (isInvalidFormat) {
                    bgColor = 'bg-orange-50';
                    borderColor = 'border-orange-200';
                    textColor = 'text-orange-700';
                  }
                  
                  return (
                    <div
                      key={idx}
                      className={`text-xs p-2 rounded border ${bgColor} ${borderColor}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[10px] text-gray-500 truncate">
                            {scan.entry}
                          </div>
                          <div className={`font-medium mt-0.5 ${textColor}`}>
                            {scan.message}
                          </div>
                          {scan.orderId && (
                            <div className="text-[10px] text-gray-500 mt-0.5">
                              {scan.orderId} {scan.courier && `• ${scan.courier}`}
                            </div>
                          )}
                        </div>
                        <span className={`text-lg ${
                          scan.status === 'success' ? '✅' : '❌'
                        }`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <div>💡 Scan orders to dispatch instantly</div>
            <div>⌨️ Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">ESC</kbd> or <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Shift+S</kbd> to exit</div>
          </div>
        </div>
      )}
    </PageContainer>;
};
export default DispatchDashboard;