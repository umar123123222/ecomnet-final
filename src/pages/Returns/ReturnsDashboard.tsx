import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, ChevronDown, ChevronUp, Edit, Lock, ScanBarcode, RotateCcw, DollarSign, ArrowUp } from 'lucide-react';
import { PageContainer, PageHeader, StatsCard, StatsGrid } from '@/components/layout';
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
import { useScannerMode } from '@/hooks/useScannerMode';

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
  const [bulkErrors, setBulkErrors] = useState<Array<{ entry: string; error: string; errorCode?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  
  // Use shared scanner mode hook
  const scannerMode = useScannerMode({ storageKey: 'returns_entry_type' });
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
    showScrollTop, scrollToTop,
    successSound, errorSound,
    addScanResult, resetScannerStats
  } = scannerMode;
  
  const { toast } = useToast();
  const { user } = useAuth();
  const handheldScanner = useHandheldScanner();
  const queryClient = useQueryClient();
  
  const form = useForm({
    defaultValues: {
      bulkEntries: ''
    }
  });

  const handleShowMore = () => {
    setVisibleCount(prev => prev + 500);
  };

  const handleShowAll = () => {
    setVisibleCount(filteredReturns.length);
  };

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        // First get the count
        const { count, error: countError } = await supabase
          .from('returns')
          .select('*', { count: 'exact', head: true });

        if (countError) {
          console.error('Error fetching returns count:', countError);
        }

        const totalCount = count || 0;
        const CHUNK_SIZE = 1000;
        const chunks = Math.ceil(totalCount / CHUNK_SIZE);
        let allData: any[] = [];

        // Fetch in chunks to bypass 1000 row limit
        for (let i = 0; i < chunks; i++) {
        const { data, error } = await supabase
            .from('returns')
            .select(`
              *,
              orders!returns_order_id_fkey (
                order_number,
                customer_name,
                customer_phone,
                customer_email
              ),
              received_by_profile:profiles!returns_received_by_fkey(
                full_name,
                email
              )
            `)
            .order('created_at', { ascending: false })
            .range(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE - 1);

          if (error) {
            console.error('Error fetching returns chunk:', error);
            toast({
              title: "Error",
              description: "Failed to fetch returns",
              variant: "destructive"
            });
            return;
          }

          if (data) {
            allData = [...allData, ...data];
          }
        }

        setReturns(allData);
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
      // Use received_at or created_at for date filtering
      const dateStr = returnItem.received_at || returnItem.created_at;
      if (!dateStr) return false;
      const returnDate = parseISO(dateStr);
      
      // Set start of day for from date and end of day for to date
      const startOfFrom = new Date(dateRange.from);
      startOfFrom.setHours(0, 0, 0, 0);
      
      if (dateRange.to) {
        const endOfTo = new Date(dateRange.to);
        endOfTo.setHours(23, 59, 59, 999);
        return returnDate >= startOfFrom && returnDate <= endOfTo;
      }
      return returnDate >= startOfFrom;
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

  const toggleRowExpansion = useCallback((returnId: string) => {
    setExpandedRows(prev => prev.includes(returnId) ? prev.filter(id => id !== returnId) : [...prev, returnId]);
  }, []);

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

  const processScannerInput = async (entry: string) => {
    if (!user?.id || !entry || entry.trim().length === 0) {
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

    const startTime = Date.now();
    setLastScanTime(startTime);
    entry = entry.trim();

    // Frontend validation before calling edge function
    const validation = validateTrackingEntry(entry);
    if (!validation.valid) {
      errorSound.volume = 0.5;
      errorSound.currentTime = 0;
      errorSound.play().catch(e => console.log('Audio play failed:', e));
      
      setScannerStats(prev => ({ ...prev, errors: prev.errors + 1 }));
      setRecentScans(prev => [{
        entry,
        type: 'unknown',
        status: 'error',
        message: validation.error!,
        timestamp: new Date()
      }, ...prev.slice(0, 9)]);

      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry,
        orderNumber: '',
        customer: '',
        trackingId: '',
        status: 'error',
        reason: validation.error,
        processingTime: `${Date.now() - startTime}ms`
      }]);
      
      toast({
        title: "❌ Invalid Entry",
        description: validation.error,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Add to processing queue
    setProcessingQueue(prev => [...prev, entry]);

    // OPTIMISTIC UI UPDATE - Show as processing immediately
    const processingId = Date.now().toString();
    setRecentScans(prev => [{
      entry,
      type: 'unknown',
      status: 'success' as const,
      message: '⚙️ Processing...',
      timestamp: new Date(),
      orderId: processingId
    }, ...prev.slice(0, 9)]);

    // Call optimized edge function
    try {
      const { data, error } = await supabase.functions.invoke('rapid-return', {
        body: {
          entry,
          userId: user.id
        }
      });

      // Remove from queue
      setProcessingQueue(prev => prev.filter(e => e !== entry));

      const processingTime = Date.now() - startTime;

      // Update performance metrics
      setPerformanceMetrics(prev => {
        const newTotal = prev.totalScans + 1;
        const newAvg = ((prev.avgProcessingTime * prev.totalScans) + processingTime) / newTotal;
        return {
          avgProcessingTime: Math.round(newAvg),
          totalScans: newTotal,
          scansPerMinute: Math.round((newTotal / ((Date.now() - (lastScanTime - (prev.totalScans * 3000))) / 60000)) * 10) / 10,
          queueLength: processingQueue.length,
          currentlyProcessing: 0
        };
      });

      if (error || !data?.success) {
        // FAILURE - Play error sound immediately
        errorSound.volume = 0.5;
        errorSound.currentTime = 0;
        errorSound.play().catch(e => console.log('Audio play failed:', e));

        // Map error codes to icons and colors
        const getErrorIcon = (code: string) => {
          switch (code) {
            case 'NOT_FOUND': return '🔍';
            case 'ALREADY_RECEIVED': return '🔄';
            case 'INVALID_FORMAT': return '⚠️';
            default: return '❌';
          }
        };

        const errorMsg = data?.error || error?.message || 'Failed';
        const errorCode = data?.errorCode || 'UNKNOWN_ERROR';
        const errorIcon = getErrorIcon(errorCode);
        
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
          entry,
          orderNumber: data?.order?.order_number || '',
          customer: data?.order?.customer_name || '',
          trackingId: '',
          status: 'error',
          reason: errorMsg,
          errorCode: errorCode,
          suggestion: data?.suggestion || '',
          processingTime: `${processingTime}ms`
        }]);

        toast({
          title: `${errorIcon} ${errorMsg}`,
          description: data?.suggestion || data?.order?.order_number || entry,
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      // SUCCESS - Play success sound immediately
      successSound.volume = 0.4;
      successSound.currentTime = 0;
      successSound.play().catch(e => console.log('Audio play failed:', e));

      const successMsg = `${data.order.order_number} received`;

      setScannerStats(prev => ({ ...prev, success: prev.success + 1 }));
      setRecentScans(prev => prev.map(scan => 
        scan.orderId === processingId 
          ? { 
              ...scan, 
              type: data.matchType, 
              status: 'success' as const, 
              message: successMsg, 
              orderId: data.order.order_number
            }
          : scan
      ));

      setScanHistoryForExport(prev => [...prev, {
        timestamp: new Date().toISOString(),
        entry,
        orderNumber: data.order.order_number,
        customer: data.order.customer_name,
        trackingId: data.tracking_id,
        status: 'success',
        reason: 'Return received',
        processingTime: `${processingTime}ms`
      }]);

      toast({
        title: "✅ Return Received",
        description: successMsg,
        duration: 1500,
      });

      // Refresh data using chunked fetch
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      
      const { count: totalCount } = await supabase
        .from('returns')
        .select('*', { count: 'exact', head: true });

      const CHUNK_SIZE = 1000;
      const chunks = Math.ceil((totalCount || 0) / CHUNK_SIZE);
      let allData: any[] = [];

      for (let i = 0; i < chunks; i++) {
        const { data } = await supabase
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
          .order('created_at', { ascending: false })
          .range(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE - 1);

        if (data) allData = [...allData, ...data];
      }
      
      setReturns(allData);

    } catch (error: any) {
      console.error('Error processing scan:', error);
      
      // Remove from queue
      setProcessingQueue(prev => prev.filter(e => e !== entry));
      
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
        entry,
        orderNumber: '',
        customer: '',
        trackingId: '',
        status: 'error',
        reason: errorMsg,
        processingTime: `${Date.now() - startTime}ms`
      }]);

      toast({
        title: "❌ Failed",
        description: errorMsg,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // Focus Management: Handle scanner input focus trap
  const handleScannerFocusLost = () => {
    if (scannerModeActive) {
      setHasFocus(false);
      setFocusLostTime(Date.now());
      
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
    scannerInputRef.current?.focus();
    setHasFocus(true);
    setFocusLostTime(null);
  };

  // Scanner Mode: Hidden input change handler
  const handleScanBufferChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setScanBuffer(value);
    
    if (value.includes('\n') || value.includes('\r')) {
      const cleanValue = value.replace(/[\n\r]/g, '').trim();
      if (cleanValue) {
        processScannerInput(cleanValue);
      }
      setScanBuffer('');
      e.target.value = '';
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
      const bulkErrorsList: Array<{ entry: string; error: string; errorCode?: string }> = [];

      setIsLoading(true);
      setBulkErrors([]); // Clear previous errors

      // Get unique entries
      const uniqueEntries = Array.from(new Set(entries));

      for (const entry of uniqueEntries) {
        // Validate entry format
        const validation = validateTrackingEntry(entry);
        if (!validation.valid) {
          errors.push(`${validation.error}: ${entry}`);
          bulkErrorsList.push({ entry, error: validation.error!, errorCode: validation.errorCode });
          errorCount++;
          continue;
        }
        
        // Call the rapid-return edge function which handles:
        // - Finding existing return records
        // - Creating new return records if order exists but no return
        // - Updating return status to 'received'
        // - Updating order status to 'returned'
        // - Logging activity
        const { data: result, error: fnError } = await supabase.functions.invoke('rapid-return', {
          body: { entry, userId: user.id }
        });

        if (fnError) {
          errors.push(`System error for ${entry}: ${fnError.message}`);
          bulkErrorsList.push({ entry, error: 'System error occurred', errorCode: 'SYSTEM_ERROR' });
          errorCount++;
          continue;
        }

        if (!result || !result.success) {
          const errorMessage = result?.errorCode === 'NOT_FOUND' 
            ? 'Order Not Found'
            : result?.errorCode === 'ALREADY_RETURNED'
            ? 'Return Already Marked'
            : result?.errorCode === 'ALREADY_RECEIVED'
            ? 'Return Already Marked'
            : result?.error || 'Unknown error';
          
          errors.push(`${errorMessage}: ${entry}`);
          bulkErrorsList.push({ entry, error: errorMessage, errorCode: result?.errorCode || 'UNKNOWN' });
          errorCount++;
          continue;
        }

        // Success
        successCount++;
        toast({
          title: "Return Marked Successfully",
          description: `Order ${result.order?.order_number || entry} marked as returned`,
        });
      }

      // Show results
      setIsLoading(false);
      
      if (errors.length > 0) {
        setBulkErrors(bulkErrorsList);
      } else {
        setIsManualEntryOpen(false);
        form.reset();
      }

      toast({
        title: successCount > 0 ? "Returns Marked Received" : "Processing Failed",
        description: `${successCount} successful, ${errorCount} failed${errors.length > 0 ? '. See details below.' : ''}`,
        variant: successCount > 0 ? "default" : "destructive",
      });

      // Refresh the returns list using chunked fetch like initial load
      const { count: totalCount } = await supabase
        .from('returns')
        .select('*', { count: 'exact', head: true });

      const CHUNK_SIZE = 1000;
      const chunks = Math.ceil((totalCount || 0) / CHUNK_SIZE);
      let allData: any[] = [];

      for (let i = 0; i < chunks; i++) {
        const { data } = await supabase
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
          .order('created_at', { ascending: false })
          .range(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE - 1);

        if (data) allData = [...allData, ...data];
      }

      setReturns(allData);
    } catch (error) {
      console.error('Error processing bulk entries:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    }
  };

  // Scanner Mode: Register scan callback and focus management
  useEffect(() => {
    if (scannerModeActive) {
      console.log('Scanner mode active, setting up focus trap');
      
      // Focus the hidden input
      scannerInputRef.current?.focus();
      
      // Register HID scanner callback as backup
      const cleanup = handheldScanner.onScan((data) => {
        console.log('HID Scanner input received:', data);
        processScannerInput(data);
      });
      
      // Monitor focus every 200ms - wait 1 second before auto-restoring to allow warning banner to show
      const focusMonitor = setInterval(() => {
        if (document.activeElement !== scannerInputRef.current && scannerModeActive) {
          const focusLostDuration = focusLostTime ? Date.now() - focusLostTime : 0;
          
          // Only auto-restore after 1 second - gives user time to see the warning banner
          if (focusLostDuration > 1000) {
            console.warn('⚠️ Focus lost! Auto-restoring after 1 second...');
            scannerInputRef.current?.focus();
          }
        }
      }, 200);
      
      return () => {
        cleanup();
        clearInterval(focusMonitor);
      };
    }
  }, [scannerModeActive, handheldScanner]);

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
    <PageContainer className="relative">
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
          className="fixed inset-0 bg-green-500/5 pointer-events-none z-40 transition-all duration-300"
          style={{
            animation: hasFocus ? 'pulse 3s ease-in-out infinite' : 'none',
            borderWidth: hasFocus ? '4px' : '8px',
            borderStyle: 'solid',
            borderColor: hasFocus ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.6)',
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
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? "Processing..." : "Process Entries"}
                  </Button>
                </div>
              </form>
            </Form>

            {/* Bulk Errors Display */}
            {bulkErrors.length > 0 && (
              <div className="mt-4 border rounded-lg p-4 bg-destructive/5 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-destructive flex items-center gap-2">
                    <span>❌</span>
                    Failed Entries ({bulkErrors.length})
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBulkErrors([]);
                      setIsManualEntryOpen(false);
                      form.reset();
                    }}
                  >
                    Close
                  </Button>
                </div>
                <div className="space-y-2">
                  {bulkErrors.map((e, i) => {
                    const getErrorStyle = () => {
                      switch (e.errorCode) {
                        case 'NOT_FOUND':
                          return { icon: '🔍', color: 'text-amber-700', bg: 'bg-amber-50' };
                        case 'ALREADY_RECEIVED':
                          return { icon: '🔄', color: 'text-blue-700', bg: 'bg-blue-50' };
                        case 'INVALID_FORMAT':
                          return { icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50' };
                        default:
                          return { icon: '❌', color: 'text-red-700', bg: 'bg-red-50' };
                      }
                    };
                    const style = getErrorStyle();
                    
                    return (
                      <div key={i} className={`text-sm p-2 rounded ${style.bg}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-base">{style.icon}</span>
                          <div className="flex-1">
                            <div className="font-mono font-medium">{e.entry}</div>
                            <div className={`${style.color} text-xs mt-1`}>{e.error}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                </TableRow> : filteredReturns.slice(0, visibleCount).map(returnItem => <React.Fragment key={returnItem.id}>
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
                        {returnItem.return_status === 'claimed' ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            Claimed (Not Received)
                          </Badge>
                        ) : (
                          <Badge className={returnItem.return_status === 'received' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {returnItem.return_status || 'in_transit'}
                          </Badge>
                        )}
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
                            {returnItem.return_status === 'claimed' && (
                              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="font-semibold text-amber-800 mb-2">Courier Claim Details</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  <p><strong>Claim Amount:</strong> ₨{(returnItem.claim_amount || 0).toLocaleString()}</p>
                                  <p><strong>Claim Status:</strong> {returnItem.claim_status || 'pending'}</p>
                                  {returnItem.claim_reference && <p><strong>Reference #:</strong> {returnItem.claim_reference}</p>}
                                  {returnItem.claimed_at && <p><strong>Claimed On:</strong> {new Date(returnItem.claimed_at).toLocaleDateString()}</p>}
                                  {returnItem.claim_notes && <p className="col-span-2"><strong>Notes:</strong> {returnItem.claim_notes}</p>}
                                </div>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>}
                  </React.Fragment>)}
            </TableBody>
          </Table>

          {/* Record Count & Pagination Controls */}
          {!loading && filteredReturns.length > 0 && (
            <div className="flex flex-col items-center gap-3 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground">
                Showing {Math.min(visibleCount, filteredReturns.length).toLocaleString()} of {filteredReturns.length.toLocaleString()} records
              </span>
              {filteredReturns.length > visibleCount && (
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
                    Show All ({(filteredReturns.length - visibleCount).toLocaleString()} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scanner Mode Floating Panel */}
      {scannerModeActive && (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-lg shadow-2xl border-2 border-green-500 animate-in slide-in-from-bottom-5 z-50 p-4 max-h-[80vh] overflow-y-auto">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className={`w-3 h-3 rounded-full ${
                    hasFocus ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-ping'
                  }`} 
                />
                <span className="font-semibold text-gray-900">
                  {hasFocus ? 'Scanner Active' : '⚠️ Focus Lost!'}
                </span>
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

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                <div className="text-green-600 text-xs font-medium">Avg Time</div>
                <div className={`text-2xl font-bold ${
                  performanceMetrics.avgProcessingTime < 500 ? 'text-green-600' : 
                  performanceMetrics.avgProcessingTime < 1000 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {performanceMetrics.avgProcessingTime}ms
                </div>
              </div>
              <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                <div className="text-blue-600 text-xs font-medium">Scans/Min</div>
                <div className="text-2xl font-bold text-blue-700">
                  {performanceMetrics.scansPerMinute}
                </div>
              </div>
            </div>

            {/* Processing Queue Indicator */}
            {processingQueue.length > 0 && (
              <div className="p-2 bg-yellow-50 border border-yellow-300 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <div className="text-sm font-semibold text-yellow-800">
                    ⏳ Queue: {processingQueue.length} items processing...
                  </div>
                </div>
              </div>
            )}

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
                  {recentScans.slice(0, 6).map((scan, idx) => {
                    // Determine error type from message for better color coding
                    const isNotFound = scan.message.includes('🔍') || scan.message.includes('not found');
                    const isAlreadyReceived = scan.message.includes('🔄') || scan.message.includes('already');
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
                    } else if (isAlreadyReceived) {
                      bgColor = 'bg-blue-50';
                      borderColor = 'border-blue-200';
                      textColor = 'text-blue-700';
                    } else if (isInvalidFormat) {
                      bgColor = 'bg-orange-50';
                      borderColor = 'border-orange-200';
                      textColor = 'text-orange-700';
                    }
                    
                    return (
                      <div 
                        key={idx}
                        className={`p-2 rounded text-xs border ${bgColor} ${borderColor}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-mono truncate text-gray-500">{scan.entry}</div>
                            <div className={`font-medium mt-0.5 ${textColor}`}>
                              {scan.message}
                            </div>
                            {scan.orderId && (
                              <div className="text-[10px] text-gray-500 mt-0.5 truncate">
                                {scan.orderId}
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

            {/* Keyboard Shortcuts */}
            <div className="pt-2 border-t text-xs text-gray-500">
              <div>Press <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">ESC</kbd> to stop</div>
              <div className="mt-1"><kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px]">Ctrl+Shift+S</kbd> to toggle</div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};
export default ReturnsDashboard;