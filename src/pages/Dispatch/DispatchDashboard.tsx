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
import { Search, Download, Edit, Truck, ChevronDown, ChevronUp, Plus, Filter, Lock, ScanBarcode } from 'lucide-react';
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

const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  const [dispatches, setDispatches] = useState<any[]>([]);
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
  const [entryType, setEntryType] = useState<'tracking_id' | 'order_number'>(() => {
    const saved = localStorage.getItem('dispatch_entry_type');
    return (saved === 'order_number' ? 'order_number' : 'tracking_id') as 'tracking_id' | 'order_number';
  });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Scanner Mode States
  const [scannerModeActive, setScannerModeActive] = useState(false);
  const [scannerModeAction, setScannerModeAction] = useState<'dispatch' | null>(null);
  const [scannerStats, setScannerStats] = useState({ success: 0, errors: 0 });
  const [recentScans, setRecentScans] = useState<Array<{
    entry: string;
    type: 'order_number' | 'tracking_id' | 'unknown';
    status: 'success' | 'error';
    message: string;
    timestamp: Date;
    orderId?: string;
    courier?: string;
  }>>([]);
  const [scanHistoryForExport, setScanHistoryForExport] = useState<any[]>([]);
  const [lastScanTime, setLastScanTime] = useState<number>(Date.now());
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const scanner = useHandheldScanner();
  
  // Audio for feedback
  const successSound = useMemo(() => new Audio('/sounds/success.mp3'), []);
  const errorSound = useMemo(() => new Audio('/sounds/error.mp3'), []);
  
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

    // Set up real-time subscription for automatic metrics updates
    const channel = supabase
      .channel('dispatch-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dispatches'
      }, () => {
        console.log('Dispatch change detected, refreshing data...');
        fetchDispatches();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);
  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return dispatches;
    return dispatches.filter(dispatch => {
      const dispatchDate = parseISO(dispatch.dispatch_date || dispatch.created_at);
      if (dateRange.to) {
        // Adjust the end date to include the full day (23:59:59.999)
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        
        return isWithinInterval(dispatchDate, {
          start: dateRange.from,
          end: endOfDay
        });
      }
      return dispatchDate >= dateRange.from;
    });
  }, [dispatches, dateRange]);
  const filteredDispatches = useMemo(() => {
    return filteredByDate.filter(dispatch => {
      const matchesSearch = (dispatch.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_phone || '').toLowerCase().includes(searchTerm.toLowerCase()) || (dispatch.orders?.customer_email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCourier = courierFilter === "all" || dispatch.courier === courierFilter;
      const matchesUser = userFilter === "all" || dispatch.dispatched_by === userFilter;
      return matchesSearch && matchesCourier && matchesUser;
    });
  }, [filteredByDate, searchTerm, courierFilter, userFilter]);
  const metrics = useMemo(() => {
    const totalDispatches = filteredByDate.length;
    const worthOfDispatches = filteredByDate.reduce((total, dispatch) => {
      return total + (dispatch.orders?.total_amount || 2500);
    }, 0);
    const courierCounts = filteredByDate.reduce((acc, d) => {
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
  }, [filteredByDate]);
  const handleSelectDispatch = (dispatchId: string) => {
    setSelectedDispatches(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  };
  const handleSelectAll = () => {
    setSelectedDispatches(selectedDispatches.length === filteredDispatches.length ? [] : filteredDispatches.map(d => d.id));
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
      
      for (const entry of uniqueEntries) {
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
        toast({
          title: "Some Entries Failed",
          description: `${errorCount} entries failed. Check console for details.`,
          variant: "destructive"
        });
      }
      
      if (successCount > 0) {
        setIsManualEntryOpen(false);
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
  const toggleRowExpansion = (dispatchId: string) => {
    setExpandedRows(prev => prev.includes(dispatchId) ? prev.filter(id => id !== dispatchId) : [...prev, dispatchId]);
  };

  // Set up scanner listener when manual entry is disabled
  useEffect(() => {
    if (!allowManualEntry && isManualEntryOpen) {
      // When manual entry is off, listen for scanner input
      const cleanup = scanner.onScan((scannedData) => {
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
  }, [allowManualEntry, isManualEntryOpen, scanner, form]);

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

  // Scanner Mode: Process scanned input
  const processScannerInput = async (scannedValue: string) => {
    if (!scannerModeActive || !scannerModeAction || !user?.id) return;

    const scanStartTime = Date.now();
    const trimmedValue = scannedValue.trim();

    if (!trimmedValue) {
      toast({
        title: "⚠️ Empty Scan",
        description: "Scanned value is empty",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    // IMMEDIATE UI UPDATE - Add processing entry and play sound instantly
    const processingId = Date.now().toString();
    setRecentScans(prev => [{
      entry: trimmedValue,
      type: 'unknown',
      status: 'success' as const,
      message: '⏳ Processing...',
      timestamp: new Date(),
      orderId: processingId
    }, ...prev.slice(0, 9)]);
    setLastScanTime(Date.now());
    
    // Don't play sound yet - wait for actual result

    // NOW DO DATABASE WORK
    try {
      const result = await findOrderByEntry(trimmedValue);

      if (!result) {
        // Play error sound immediately
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));

        const errorMsg = `No order record found`;
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
          reason: 'Order not found',
          matchType: 'none'
        }]);

        toast({
          title: "❌ Order Not Found",
          description: errorMsg,
          variant: "destructive",
          duration: 2000,
        });
        return;
      }

      const { order, matchType } = result;

      let courierToUse = selectedCourier;
      let courierNameToUse = '';
      let courierCodeToUse: Database["public"]["Enums"]["courier_type"] | undefined = undefined;

      if (order.courier) {
        const orderCourier = couriers.find(c => c.code === order.courier);
        if (orderCourier) {
          courierToUse = orderCourier.id;
          courierNameToUse = orderCourier.name;
          courierCodeToUse = orderCourier.code as Database["public"]["Enums"]["courier_type"];
        } else {
          courierNameToUse = order.courier;
          courierCodeToUse = order.courier as Database["public"]["Enums"]["courier_type"];
        }
      } else if (selectedCourier) {
        const selectedCourierObj = couriers.find(c => c.id === selectedCourier);
        if (selectedCourierObj) {
          courierNameToUse = selectedCourierObj.name;
          courierCodeToUse = selectedCourierObj.code as Database["public"]["Enums"]["courier_type"];
        }
      }

      if (!courierToUse && !courierNameToUse) {
        // Play error sound immediately
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));

        const errorMsg = 'No courier assigned';
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => prev.map(scan => 
          scan.orderId === processingId 
            ? { ...scan, type: matchType, status: 'error' as const, message: errorMsg, orderId: order.order_number }
            : scan
        ));

        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry: trimmedValue,
          orderNumber: order.order_number,
          status: 'error',
          reason: errorMsg,
          matchType
        }]);

        toast({
          title: "❌ No Courier",
          description: order.order_number,
          variant: "destructive",
          duration: 2000,
        });
        return;
      }

      const trackingId = matchType === 'tracking_id' ? trimmedValue : (order.tracking_id || null);

      const { data: existingDispatch } = await supabase
        .from('dispatches')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (existingDispatch) {
        // Play error sound immediately
        errorSound.volume = 0.3;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));

        const errorMsg = `Already dispatched`;
        setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        setRecentScans(prev => prev.map(scan => 
          scan.orderId === processingId 
            ? { ...scan, type: matchType, status: 'error' as const, message: errorMsg, orderId: order.order_number }
            : scan
        ));

        setScanHistoryForExport(prev => [...prev, {
          timestamp: new Date().toISOString(),
          entry: trimmedValue,
          orderNumber: order.order_number,
          status: 'error',
          reason: errorMsg,
          matchType
        }]);

        toast({
          title: "⚠️ Already Dispatched",
          description: order.order_number,
          variant: "destructive",
          duration: 2000,
        });
        return;
      }

      if (matchType === 'tracking_id' && trimmedValue !== order.tracking_id) {
        await supabase
          .from('orders')
          .update({ tracking_id: trimmedValue })
          .eq('id', order.id);
      }

      const { error: dispatchError } = await supabase
        .from('dispatches')
        .insert({
          order_id: order.id,
          tracking_id: trackingId,
          courier: courierNameToUse,
          courier_id: courierToUse,
          dispatch_date: new Date().toISOString(),
          dispatched_by: user.id
        });

      if (dispatchError) throw dispatchError;

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'dispatched',
          courier: courierCodeToUse,
          dispatched_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Log activity asynchronously (non-blocking - fire and forget)
      logActivity({
        entityType: 'dispatch',
        entityId: order.id,
        action: 'order_dispatched',
        details: { 
          order_number: order.order_number,
          courier: courierNameToUse,
          tracking_id: trackingId,
          scan_mode: 'live_scanner'
        }
      }).catch(console.error);

      // UI UPDATE AND SOUND < 100ms - Play success sound immediately
      successSound.volume = 0.4;
      successSound.currentTime = 0;
      successSound.play().catch(e => console.log('Audio play failed:', e));

      const processingTime = Date.now() - scanStartTime;
      const successMsg = `${order.order_number} via ${courierNameToUse}`;

      setScannerStats(prev => ({ ...prev, success: prev.success + 1 }));
      setRecentScans(prev => prev.map(scan => 
        scan.orderId === processingId 
          ? { ...scan, type: matchType, status: 'success' as const, message: successMsg, orderId: order.order_number, courier: courierNameToUse }
          : scan
      ));

      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry: trimmedValue,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        amount: order.total_amount,
        courier: courierNameToUse,
        trackingId: trackingId,
        status: 'success',
        processingTime: `${processingTime}ms`,
        matchType
      }]);

      toast({
        title: "✅ Dispatched",
        description: successMsg,
        duration: 1500,
      });

      queryClient.invalidateQueries({ queryKey: ['dispatches'] });

    } catch (error: any) {
      console.error('Error processing scan:', error);
      
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
        duration: 2000,
      });
    }
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
  }, [scannerModeActive, scanner.isConnected]);

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

  return <div className="p-6 space-y-6">
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
                          {!allowManualEntry && !scanner.isConnected && (
                            <div className="p-2 mt-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              <Lock className="h-4 w-4 inline mr-1" />
                              Scanner not connected. Connect scanner or enable manual entry.
                            </div>
                          )}
                          {!allowManualEntry && scanner.isConnected && (
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
                              disabled={!allowManualEntry && !scanner.isConnected}
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
                      disabled={isProcessing || (!allowManualEntry && !scanner.isConnected)}
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

      {/* Scanner Mode Floating Panel */}
      {scannerModeActive && (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-blue-500 rounded-lg shadow-2xl p-4 w-96 z-50 animate-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
              <h3 className="font-semibold text-gray-900">Scanner Mode Active</h3>
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
                {recentScans.slice(0, 6).map((scan, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded border ${
                      scan.status === 'success' 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] text-gray-500 truncate">
                          {scan.entry}
                        </div>
                        <div className={`font-medium mt-0.5 ${
                          scan.status === 'success' ? 'text-green-700' : 'text-red-700'
                        }`}>
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
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
            <div>💡 Scan orders to dispatch instantly</div>
            <div>⌨️ Press <kbd className="px-1 py-0.5 bg-gray-200 rounded">ESC</kbd> or <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Shift+S</kbd> to exit</div>
          </div>
        </div>
      )}
    </div>;
};
export default DispatchDashboard;