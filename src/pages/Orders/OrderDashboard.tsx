import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Search, Upload, Filter, X, RefreshCw, AlertTriangle, AlertCircle, MapPin, Eye, EyeOff, Package, DollarSign, Smartphone, FileSpreadsheet, Boxes, ShoppingBag } from 'lucide-react';
import NewOrderDialog from '@/components/NewOrderDialog';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCouriers } from '@/hooks/useCouriers';
import { logActivity } from '@/utils/activityLogger';
import { useBulkOperations } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkUpdateOrderStatus, bulkUnassignCouriers, exportToCSV } from '@/utils/bulkOperations';
import { exportOrdersToExcel } from '@/utils/excelExport';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { BulkUploadDialog } from '@/components/orders/BulkUploadDialog';
import { OrderKPIPanel } from '@/components/orders/OrderKPIPanel';
import { FilterPresets } from '@/components/orders/FilterPresets';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { CancelOrderDialog } from '@/components/orders/CancelOrderDialog';
import { FixShopifyFulfilledOrders } from '@/components/orders/FixShopifyFulfilledOrders';
import { VerifyDeliveredOrders } from '@/components/orders/VerifyDeliveredOrders';
import OrdersMobileView from '@/components/orders/OrdersMobileView';
import { useIsMobile } from '@/hooks/use-mobile';

// New refactored components
import { useOrdersData, FormattedOrder } from '@/hooks/useOrdersData';
import { OrderSummaryCards } from '@/components/orders/OrderSummaryCards';
import { OrderTableBody } from '@/components/orders/OrderTableBody';

const OrderDashboard = () => {
  const isMobile = useIsMobile();
  const { isManager, isSeniorStaff, primaryRole, hasAnyRole, permissions, canSetDeliveredStatus } = useUserRoles();
  const { data: couriers = [] } = useCouriers();
  const { toast } = useToast();
  const { progress, executeBulkOperation } = useBulkOperations();
  const [searchParams] = useSearchParams();

  // Use the new custom hook for data management
  const {
    orders,
    setOrders,
    loading,
    totalCount,
    summaryData,
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    sortOrder,
    setSortOrder,
    filters,
    updateFilter,
    resetFilters,
    activeFiltersCount,
    selectedOrders,
    setSelectedOrders,
    selectAllPages,
    handleSelectOrder,
    handleSelectAllCurrentPage,
    handleSelectAllPages,
    expandedRows,
    toggleExpanded,
    pagination,
    fetchOrders,
    newOrdersCount,
    showNewOrdersNotification,
    handleRefreshNewOrders,
    user,
    profile
  } = useOrdersData();

  // Local UI state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showKPIPanel, setShowKPIPanel] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<FormattedOrder | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<{ id: string; orderNumber: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [jumpToPage, setJumpToPage] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [combinedStatus, setCombinedStatus] = useState<string>('all');
  const [availableBundles, setAvailableBundles] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{id: string; name: string; sku: string | null}[]>([]);

  // Fetch available bundle names and products
  useEffect(() => {
    const fetchBundlesAndProducts = async () => {
      // Fetch bundles from products table (all bundles, not just ordered ones)
      const { data: bundleData } = await supabase
        .from('products')
        .select('name, sku')
        .eq('is_bundle', true)
        .eq('is_active', true)
        .order('name');
      
      if (bundleData) {
        setAvailableBundles(bundleData.map(b => b.name));
      }

      // Fetch products for product filter
      const { data: productData } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      
      if (productData) {
        setAvailableProducts(productData);
      }
    };
    fetchBundlesAndProducts();
  }, []);

  // Read search param from URL on page load
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch) {
      setSearchInput(urlSearch);
      updateFilter('search', urlSearch);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        updateFilter('search', searchInput);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, updateFilter]);

  // Keyboard shortcuts for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && page > 0) setPage(p => Math.max(0, p - 1));
      else if (e.key === 'ArrowRight' && (page + 1) * pageSize < totalCount) setPage(p => p + 1);
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [page, pageSize, totalCount, setPage]);

  const handleNewOrderCreated = async () => {
    setPage(0);
    await fetchOrders();
  };

  // Bulk status update handler
  const handleBulkStatusChange = async (status: string) => {
    try {
      const canOverrideDispatchLock = hasAnyRole(['super_admin', 'super_manager', 'warehouse_manager']);
      const ordersToUpdate = canOverrideDispatchLock
        ? Array.from(selectedOrders)
        : Array.from(selectedOrders).filter(orderId => {
            const order = orders.find(o => o.id === orderId);
            return order?.status !== 'dispatched';
          });

      const skippedCount = selectedOrders.size - ordersToUpdate.length;
      if (skippedCount > 0) {
        toast({ title: "Some Orders Skipped", description: `${skippedCount} dispatched order(s) were skipped.` });
      }
      if (ordersToUpdate.length === 0) {
        toast({ title: "No Orders to Update", description: "All selected orders are dispatched.", variant: "destructive" });
        return;
      }

      if (primaryRole === 'staff') {
        const allowedForStaff = ['pending', 'confirmed', 'cancelled'];
        if (!allowedForStaff.includes(status)) {
          toast({ title: "Permission Denied", description: `Staff can only set: ${allowedForStaff.join(', ')}`, variant: "destructive" });
          return;
        }
      }

      const result = await bulkUpdateOrderStatus(ordersToUpdate, status as any);
      if (result.success > 0) {
        toast({ title: "Success", description: `Updated ${result.success} order(s) to ${status}` });
        fetchOrders();
        setSelectedOrders(new Set());
      }
      if (result.failed > 0) {
        toast({ title: "Partial Success", description: `${result.failed} order(s) failed`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to update order status", variant: "destructive" });
    }
  };

  // Bulk courier assignment
  const handleBulkCourierAssign = async (courierId: string, courierName: string) => {
    try {
      toast({ title: "Processing", description: `Booking ${selectedOrders.size} orders with ${courierName}...` });

      const { data, error } = await supabase.functions.invoke('bulk-courier-booking', {
        body: { orderIds: Array.from(selectedOrders), courierId }
      });

      if (error) throw error;
      if (!data.success && data.failedCount === data.total) throw new Error(data.error || 'All bookings failed');

      const successfulOrderIds = data.results.filter((r: any) => r.success).map((r: any) => r.orderId);

      if (data.successCount > 0) {
        toast({ title: "Booking Complete", description: `Successfully booked ${data.successCount} of ${data.total} orders.` });
        if (successfulOrderIds.length > 0) {
          handleGenerateAWBs(successfulOrderIds, courierId, courierName);
        }
      }
      if (data.failedCount > 0) {
        const failedOrders = data.results.filter((r: any) => !r.success);
        const errorSummary = failedOrders.slice(0, 3).map((r: any) => `${r.orderNumber}: ${r.error}`).join('\n');
        toast({ title: `${data.failedCount} Bookings Failed`, description: errorSummary, variant: "destructive" });
      }

      fetchOrders();
      if (data.successCount > 0) setSelectedOrders(new Set());
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to book orders with courier", variant: "destructive" });
    }
  };

  // Generate AWBs
  const handleGenerateAWBs = async (orderIds: string[], courierId: string, courierName: string) => {
    try {
      // First try to get tracking IDs from dispatches table
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('tracking_id, order_id')
        .in('order_id', orderIds)
        .not('tracking_id', 'is', null);

      let trackingIds = dispatches?.map(d => d.tracking_id) || [];
      
      // If no dispatches found, fallback to orders.tracking_id
      if (trackingIds.length === 0) {
        const { data: ordersWithTracking } = await supabase
          .from('orders')
          .select('id, tracking_id')
          .in('id', orderIds)
          .not('tracking_id', 'is', null);
        
        trackingIds = ordersWithTracking?.map(o => o.tracking_id).filter(Boolean) as string[] || [];
      }
      
      if (trackingIds.length === 0) {
        toast({ title: "No tracking IDs found", description: "Selected orders don't have tracking IDs. Book them with a courier first.", variant: "destructive" });
        return;
      }

      const { data: courier } = await supabase.from('couriers').select('code').eq('id', courierId).single();
      if (!courier) throw new Error('Courier not found');

      toast({ title: "Generating AWBs...", description: `Processing ${trackingIds.length} labels...` });

      const { data, error } = await supabase.functions.invoke('generate-courier-awbs', {
        body: { courier_code: courier.code, order_ids: orderIds }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to generate AWBs');

      // Poll for completion
      const pollIntervalMs = 1500;
      const timeoutMs = 90000;
      const startTime = Date.now();
      let awbRecord: any = null;

      while (Date.now() - startTime < timeoutMs) {
        const { data: record } = await supabase
          .from('courier_awbs')
          .select('id,status,pdf_data,error_message,tracking_ids')
          .eq('id', data.awb_id)
          .maybeSingle();

        if (record?.status === 'failed') throw new Error(record.error_message || 'AWB generation failed');
        if (record?.status === 'completed' && record?.pdf_data) {
          awbRecord = record;
          break;
        }
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }

      if (!awbRecord) throw new Error('Timeout waiting for AWBs');

      // Download PDF
      const pdfData = awbRecord.pdf_data as string;
      const labelCount = awbRecord.tracking_ids?.length || orderIds.length;
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfData}`;
      link.download = `awb-${courierName}-${labelCount}labels.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "✅ AWBs Downloaded", description: `${labelCount} labels downloaded` });
    } catch (error: any) {
      toast({ title: "AWB Generation Failed", description: error.message, variant: "destructive" });
    }
  };

  // Bulk courier unassignment
  const handleBulkCourierUnassign = async () => {
    try {
      toast({ title: "Processing", description: `Unassigning couriers from ${selectedOrders.size} orders...` });
      const result = await bulkUnassignCouriers(Array.from(selectedOrders));
      if (result.success > 0) {
        toast({ title: "Success", description: `Unassigned ${result.success} order(s) from couriers.` });
        fetchOrders();
        setSelectedOrders(new Set());
      }
      if (result.failed > 0) {
        toast({ title: "Partial Success", description: `${result.failed} order(s) failed to unassign.`, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to unassign couriers", variant: "destructive" });
    }
  };

  // Bulk generate AWBs for already-booked orders
  const handleBulkGenerateAWBs = async () => {
    if (selectedOrders.size === 0) {
      toast({ title: "No orders selected", description: "Select booked orders to generate AWBs." });
      return;
    }

    const { data: selected } = await supabase.from('orders').select('id,status,courier').in('id', Array.from(selectedOrders));
    const eligible = (selected || []).filter(o => o.status === 'booked' && o.courier);

    if (eligible.length === 0) {
      toast({ title: "No eligible orders", description: "Only booked orders with a courier are eligible.", variant: "destructive" });
      return;
    }

    const groups: Record<string, string[]> = {};
    eligible.forEach((o: any) => {
      const code = String(o.courier).toLowerCase();
      groups[code] = groups[code] || [];
      groups[code].push(o.id);
    });

    const courierByCode = new Map<string, { id: string; name: string; code: string }>();
    couriers.forEach(c => courierByCode.set(String(c.code).toLowerCase(), c));

    for (const code of Object.keys(groups)) {
      const c = courierByCode.get(code);
      if (c) await handleGenerateAWBs(groups[code], c.id, c.name);
    }
  };

  // Export handler
  const handleExport = () => {
    const selectedOrdersData = orders.filter(o => selectedOrders.has(o.id));
    exportToCSV(selectedOrdersData, `orders-${new Date().toISOString().split('T')[0]}`);
    toast({ title: "Export Complete", description: `Exported ${selectedOrdersData.length} order(s)` });
  };

  // Status update handler
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, additionalData?: Record<string, any>) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const canOverrideDispatchLock = hasAnyRole(['super_admin', 'super_manager', 'warehouse_manager']);

      if (order?.status === 'dispatched' && !canOverrideDispatchLock) {
        toast({ title: "Status Locked", description: "Dispatched orders cannot be manually updated.", variant: "destructive" });
        return;
      }

      if (newStatus === 'cancelled') {
        setOrderToCancel({ id: orderId, orderNumber: order?.orderNumber || '' });
        setCancelDialogOpen(true);
        return;
      }

      const validStatuses = ['pending', 'confirmed', 'booked', 'dispatched', 'delivered', 'returned', 'cancelled'];
      if (!validStatuses.includes(newStatus)) {
        toast({ title: "Invalid Status", description: `"${newStatus}" is not valid.`, variant: "destructive" });
        return;
      }

      // Staff cannot set delivered status - only senior_staff and above can
      if (primaryRole === 'staff' && !['pending', 'confirmed', 'cancelled'].includes(newStatus)) {
        toast({ title: "Permission Denied", description: "Staff can only set: pending, confirmed, cancelled", variant: "destructive" });
        return;
      }
      
      // Senior staff can set: pending, confirmed, cancelled, dispatched (with date), delivered (with date)
      if (primaryRole === 'senior_staff' && !['pending', 'confirmed', 'cancelled', 'dispatched', 'delivered'].includes(newStatus)) {
        toast({ title: "Permission Denied", description: "Senior staff can only set: pending, confirmed, cancelled, dispatched, delivered", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from('orders').update({ status: newStatus as Database['public']['Enums']['order_status'], ...additionalData }).eq('id', orderId);
      if (error) throw error;

      await logActivity({ action: 'order_updated', entityType: 'order', entityId: orderId, details: { field: 'status', new_value: newStatus } });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus, ...additionalData } : o));
      toast({ title: "Status Updated", description: `Order status changed to ${newStatus}` });
      fetchOrders();

      supabase.functions.invoke('process-sync-queue').catch(console.error);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update status", variant: "destructive" });
    }
  };

  // Handle confirmed cancellation
  const handleConfirmCancellation = async (reason: string) => {
    if (!orderToCancel) return;
    try {
      const { error } = await supabase.from('orders').update({ status: 'cancelled', cancellation_reason: reason }).eq('id', orderToCancel.id);
      if (error) throw error;

      await logActivity({ action: 'order_updated', entityType: 'order', entityId: orderToCancel.id, details: { field: 'status', new_value: 'cancelled', cancellation_reason: reason } });
      setOrders(prev => prev.map(o => o.id === orderToCancel.id ? { ...o, status: 'cancelled' } : o));
      toast({ title: "Order Cancelled", description: `Order ${orderToCancel.orderNumber} has been cancelled` });
      fetchOrders();
      supabase.functions.invoke('process-sync-queue').catch(console.error);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to cancel order", variant: "destructive" });
    }
  };

  // Quick action handlers
  const handleQuickMarkDispatched = useCallback(async (orderId: string) => {
    await handleUpdateOrderStatus(orderId, 'dispatched', { dispatched_at: new Date().toISOString() });
  }, [handleUpdateOrderStatus]);

  const handleQuickGenerateLabel = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    toast({ title: "Label Downloaded", description: `Shipping label for order ${order.orderNumber} downloaded` });
  }, [orders, toast]);

  const handleQuickViewActivity = useCallback((orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setSelectedOrder(order);
      setDetailsModalOpen(true);
    }
  }, [orders]);

  // Filter preset handler
  const handlePresetSelect = (preset: any) => {
    if (!preset) {
      setActivePreset(null);
      resetFilters();
      setSearchInput('');
      return;
    }
    setActivePreset(preset.id);
    if (preset.filters.status) updateFilter('status', preset.filters.status);
    if (preset.filters.dateRange) updateFilter('statusDateRange', preset.filters.dateRange);
    if (preset.filters.minAmount) updateFilter('amountMin', preset.filters.minAmount);
  };

  // Jump to page handler
  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= pagination.totalPages) {
      setPage(pageNum - 1);
      setJumpToPage('');
    } else {
      toast({ title: "Invalid page number", description: `Enter a number between 1 and ${pagination.totalPages}`, variant: "destructive" });
    }
  };

  // Quick filter handlers
  const applyQuickFilter = (filterType: string) => {
    if (quickFilter === filterType) {
      setQuickFilter(null);
      setCombinedStatus('all');
      resetFilters();
      setSearchInput('');
    } else {
      setQuickFilter(filterType);
      switch (filterType) {
        case 'needsConfirmation':
          setCombinedStatus('pending_order');
          updateFilter('status', 'pending');
          break;
        case 'needsVerification':
          setCombinedStatus('pending_address');
          updateFilter('verificationStatus', 'pending');
          break;
        case 'actionRequired':
          setCombinedStatus('all');
          updateFilter('status', 'all');
          break;
      }
    }
  };

  const handleClearFilters = () => {
    resetFilters();
    setSearchInput('');
  };

  // Export all filtered orders to Excel
  const [exporting, setExporting] = useState(false);
  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      toast({ title: "Preparing Export...", description: "Fetching all orders that match your current filters..." });

      const getStatusDateField = (status: string): string => {
        switch (status) {
          case 'pending':
            return 'created_at';
          case 'booked':
            return 'booked_at';
          case 'dispatched':
            return 'dispatched_at';
          case 'delivered':
            return 'delivered_at';
          case 'returned':
          case 'cancelled':
            return 'updated_at';
          default:
            return 'created_at';
        }
      };

      const buildQuery = () => {
        let query = supabase
          .from('orders')
          .select(`
            id, order_number, status, customer_name, customer_phone, customer_email,
            customer_address, city, total_amount, shipping_charges, courier, tracking_id, tags,
            created_at, booked_at, dispatched_at, delivered_at,
            cancellation_reason, notes,
            order_items(id, item_name, quantity, price, product_id)
          `)
          .order('created_at', { ascending: sortOrder === 'oldest' });

        // Mirror filtering logic from useOrdersData (but without pagination)
        if (filters.search) {
          query = query.or(
            `order_number.ilike.%${filters.search}%,shopify_order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,tracking_id.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
          );
        }

        if (filters.status !== 'all') {
          query = query.eq('status', filters.status as any);
        }

        if (filters.courier === 'none') {
          query = query.is('courier', null);
        } else if (filters.courier !== 'all') {
          query = query.eq('courier', filters.courier as any);
        }

        if (filters.orderType !== 'all') {
          query = query.eq('order_type', filters.orderType);
        }

        if (filters.verificationStatus !== 'all') {
          query = query.eq('verification_status', filters.verificationStatus as any);
        }

        if (filters.statusDateRange?.from) {
          const statusDateField = getStatusDateField(filters.status);
          const startOfDay = new Date(filters.statusDateRange.from);
          startOfDay.setHours(0, 0, 0, 0);
          query = query.gte(statusDateField, startOfDay.toISOString());

          if (filters.statusDateRange.to) {
            const endOfDay = new Date(filters.statusDateRange.to);
            endOfDay.setHours(23, 59, 59, 999);
            query = query.lte(statusDateField, endOfDay.toISOString());
          }
        }

        if (filters.amountMin !== undefined) {
          query = query.gte('total_amount', filters.amountMin);
        }
        if (filters.amountMax !== undefined) {
          query = query.lte('total_amount', filters.amountMax);
        }

        if (filters.city !== 'all') {
          query = query.ilike('city', `%${filters.city}%`);
        }

        if (filters.hasTrackingId === 'yes') {
          query = query.not('tracking_id', 'is', null);
        } else if (filters.hasTrackingId === 'no') {
          query = query.is('tracking_id', null);
        }

        return query;
      };

      // Fetch ALL matching records in pages (Supabase defaults to 1000 max per request)
      const batchSize = 1000;
      let offset = 0;
      const allOrders: any[] = [];

      while (true) {
        const { data, error } = await buildQuery().range(offset, offset + batchSize - 1);
        if (error) throw error;

        const batch = data || [];
        allOrders.push(...batch);

        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      if (allOrders.length === 0) {
        toast({ title: "No Orders", description: "No orders found with current filters", variant: "destructive" });
        return;
      }

      const exportData = allOrders.map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        customerAddress: order.customer_address,
        city: order.city,
        total: order.total_amount,
        shippingCharges: order.shipping_charges,
        courier: order.courier,
        tracking_id: order.tracking_id,
        tags: order.tags,
        items: order.order_items,
        createdAt: order.created_at,
        bookedAt: order.booked_at,
        dispatchedAt: order.dispatched_at,
        deliveredAt: order.delivered_at,
        cancellationReason: order.cancellation_reason,
        notes: order.notes,
      }));

      const count = exportOrdersToExcel(exportData);
      toast({ title: "Export Complete", description: `Exported ${count} orders to Excel` });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({ title: "Export Failed", description: error.message || "Failed to export orders", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Permission flags
  const canUpdateStatus = isManager() || isSeniorStaff() || primaryRole === 'staff';
  const canOverrideDispatchLock = hasAnyRole(['super_admin', 'super_manager', 'warehouse_manager']);

  // State for mobile new order dialog
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);

  // Handle view details on mobile
  const handleMobileViewDetails = (order: FormattedOrder) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  // Handle load more for mobile
  const handleLoadMore = () => {
    setPage(prev => prev + 1);
  };

  // Mobile View
  if (isMobile) {
    return (
      <>
        <OrdersMobileView
          orders={orders}
          totalCount={totalCount}
          summaryData={summaryData}
          loading={loading}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          filters={filters}
          updateFilter={updateFilter}
          resetFilters={resetFilters}
          couriers={couriers}
          onViewDetails={handleMobileViewDetails}
          onNewOrder={() => setShowNewOrderDialog(true)}
          onRefresh={fetchOrders}
          hasMore={(page + 1) * pageSize < totalCount}
          onLoadMore={handleLoadMore}
          activeFiltersCount={activeFiltersCount}
        />
        <NewOrderDialog 
          open={showNewOrderDialog} 
          onOpenChange={setShowNewOrderDialog}
          onOrderCreated={handleNewOrderCreated} 
        />
        <OrderDetailsModal 
          open={detailsModalOpen} 
          onOpenChange={setDetailsModalOpen} 
          order={selectedOrder as any} 
        />
      </>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Orders</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${pagination.start}–${pagination.end} of ${totalCount.toLocaleString()}` : 'No orders'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchOrders} className="h-8 px-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowKPIPanel(!showKPIPanel)} className="h-8 gap-1.5">
            {showKPIPanel ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="text-xs">Analytics</span>
          </Button>
          <NewOrderDialog onOrderCreated={handleNewOrderCreated} />
          
          {/* More Actions Dropdown */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                More
              </Button>
            </SheetTrigger>
            <SheetContent className="w-80">
              <SheetHeader>
                <SheetTitle>Actions</SheetTitle>
                <SheetDescription>Additional order management tools</SheetDescription>
              </SheetHeader>
              <div className="space-y-2 py-4">
                {(isManager || primaryRole === 'super_admin') && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Fix Shopify Orders
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Fix Shopify Fulfilled Orders</DialogTitle>
                      </DialogHeader>
                      <FixShopifyFulfilledOrders />
                    </DialogContent>
                  </Dialog>
                )}
                <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setShowBulkUpload(true)}>
                  <Upload className="h-4 w-4" />
                  Bulk Upload
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleExportToExcel} disabled={exporting}>
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting ? 'Exporting...' : 'Export Excel'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <BulkUploadDialog open={showBulkUpload} onOpenChange={setShowBulkUpload} onSuccess={handleNewOrderCreated} />
        </div>
      </div>

      {/* Analytics Panel (Collapsible) */}
      <OrderKPIPanel isVisible={showKPIPanel} />

      {/* Status Summary + Quick Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <OrderSummaryCards 
          totalCount={totalCount} 
          summaryData={summaryData} 
          onStatusFilter={(status) => updateFilter('status', status)}
        />
        <FilterPresets activePreset={activePreset} onPresetSelect={handlePresetSelect} />
      </div>

      {/* Bulk Operations (only when items selected) */}
      {selectedOrders.size > 0 && (
        <BulkOperationsPanel
          selectedCount={selectedOrders.size}
          onStatusChange={handleBulkStatusChange}
          onCourierAssign={handleBulkCourierAssign}
          onCourierUnassign={handleBulkCourierUnassign}
          onExport={handleExport}
          onGenerateAWBs={handleBulkGenerateAWBs}
          progress={progress}
          couriers={couriers}
          userRole={primaryRole}
        />
      )}

      {/* Orders Table */}
      <Card className="border-border/50">
        {/* Unified Filter Bar */}
        <div className="flex items-center gap-3 p-3 border-b bg-muted/20">
          {/* Search Section - Expanded */}
          <div className="flex flex-1 gap-2 min-w-0">
            {/* Search Type Selector */}
            <Select value={filters.searchType} onValueChange={value => updateFilter('searchType', value)}>
              <SelectTrigger className="w-[130px] h-8 text-xs shrink-0 bg-background">
                <SelectValue placeholder="Search in" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Fields</SelectItem>
                <SelectItem value="order_number">Order Number</SelectItem>
                <SelectItem value="tracking_id">Tracking ID</SelectItem>
                <SelectItem value="tags">Tags</SelectItem>
                <SelectItem value="order_id">Order ID</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Search Input - Takes remaining space */}
            <Input 
              placeholder={
                filters.searchType === 'order_number' ? 'Search by order number...' :
                filters.searchType === 'tracking_id' ? 'Search by tracking ID...' :
                filters.searchType === 'tags' ? 'Search by tags...' :
                filters.searchType === 'order_id' ? 'Search by order ID...' :
                'Search orders, tracking, customer...'
              }
              value={searchInput} 
              onChange={e => setSearchInput(e.target.value)} 
              className="h-8 text-sm flex-1" 
            />
          </div>

          {/* Rows per page */}
          <Select value={String(pageSize)} onValueChange={val => handlePageSizeChange(Number(val))}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>

          {/* Active filters indicator */}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 gap-1 text-xs">
              <X className="h-3.5 w-3.5" />
              {activeFiltersCount} filters
            </Button>
          )}

          {/* Filter Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </Button>
            </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Orders</SheetTitle>
                  <SheetDescription>Apply filters to refine your order view</SheetDescription>
                </SheetHeader>

                <div className="space-y-6 py-6">
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Quick Filters</Label>
                    <Select value={quickFilter || 'none'} onValueChange={value => value === 'none' ? (setQuickFilter(null), resetFilters(), setSearchInput('')) : applyQuickFilter(value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select quick filter" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="none">No Quick Filter</SelectItem>
                        <SelectItem value="needsConfirmation">
                          <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />Needs Confirmation</div>
                        </SelectItem>
                        <SelectItem value="needsVerification">
                          <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />Needs Address Check</div>
                        </SelectItem>
                        <SelectItem value="actionRequired">
                          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Action Required</div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Order Status</Label>
                    <Select value={filters.status} onValueChange={value => updateFilter('status', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="dispatched">Dispatched</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Courier</Label>
                    <Select value={filters.courier} onValueChange={value => updateFilter('courier', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select courier" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Couriers</SelectItem>
                        <SelectItem value="none">No Courier</SelectItem>
                        {couriers.map(c => (
                          <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Date Range</Label>
                    <DatePickerWithRange
                      date={filters.statusDateRange}
                      setDate={(range) => updateFilter('statusDateRange', range)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Filter Date By</Label>
                    <Select value={filters.dateFilterMode} onValueChange={value => updateFilter('dateFilterMode', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select date field" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="created">Created Date</SelectItem>
                        <SelectItem value="status">Status Date</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {filters.dateFilterMode === 'created' 
                        ? 'Filter by when orders were created' 
                        : 'Filter by when orders reached their current status'}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      City
                    </Label>
                    <Input
                      placeholder="Filter by city..."
                      value={filters.city === 'all' ? '' : filters.city}
                      onChange={e => updateFilter('city', e.target.value || 'all')}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Amount Range
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.amountMin ?? ''}
                        onChange={e => updateFilter('amountMin', e.target.value ? Number(e.target.value) : undefined)}
                        className="bg-background"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.amountMax ?? ''}
                        onChange={e => updateFilter('amountMax', e.target.value ? Number(e.target.value) : undefined)}
                        className="bg-background"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Order Source
                    </Label>
                    <Select value={filters.orderType} onValueChange={value => updateFilter('orderType', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                        <SelectItem value="Prepaid">Prepaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Has Tracking ID
                    </Label>
                    <Select value={filters.hasTrackingId} onValueChange={value => updateFilter('hasTrackingId', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Orders</SelectItem>
                        <SelectItem value="yes">With Tracking ID</SelectItem>
                        <SelectItem value="no">Without Tracking ID</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <Boxes className="h-4 w-4" />
                      Bundle Filter
                    </Label>
                    <Select value={filters.hasBundle} onValueChange={value => updateFilter('hasBundle', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select bundle" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-60">
                        <SelectItem value="all">All Orders</SelectItem>
                        <SelectItem value="yes">Any Bundle</SelectItem>
                        <SelectItem value="no">No Bundle</SelectItem>
                        {availableBundles.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                              Specific Bundles
                            </div>
                            {availableBundles.map(bundle => (
                              <SelectItem key={bundle} value={bundle}>
                                {bundle}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4" />
                      Product Filter
                    </Label>
                    <Select value={filters.productId} onValueChange={value => updateFilter('productId', value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-60">
                        <SelectItem value="all">All Products</SelectItem>
                        {availableProducts.map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            <div className="flex items-center gap-2">
                              <span>{product.name}</span>
                              {product.sku && (
                                <span className="text-xs text-muted-foreground">({product.sku})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Filter orders containing this product (includes bundle components)
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-semibold flex items-center gap-2">
                      Sort Order
                    </Label>
                    <Select value={sortOrder} onValueChange={(value: 'latest' | 'oldest') => setSortOrder(value)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select order" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="latest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
        </div>

        {/* Table Header with Selection */}
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-base font-medium flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedOrders.size === orders.length && orders.length > 0}
                  onCheckedChange={handleSelectAllCurrentPage}
                />
                <span className="text-sm text-muted-foreground">Select Page</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectAllPages} onCheckedChange={handleSelectAllPages} />
                <span className="text-sm text-muted-foreground">Select All Pages</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                <TableRow>
                  <TableHead className="w-[50px] bg-background">Select</TableHead>
                  <TableHead className="min-w-[140px] bg-background">Order Number</TableHead>
                  <TableHead className="min-w-[180px] bg-background">Customer Name</TableHead>
                  <TableHead className="min-w-[140px] bg-background">Customer Phone</TableHead>
                  <TableHead className="min-w-[120px] bg-background">Total Price</TableHead>
                  <TableHead className="min-w-[200px] bg-background">Order Status</TableHead>
                  <TableHead className="min-w-[140px] bg-background">Courier</TableHead>
                  <TableHead className="w-[80px] bg-background">Actions</TableHead>
                  <TableHead className="w-[50px] bg-background">Expand</TableHead>
                </TableRow>
              </TableHeader>
              <OrderTableBody
                orders={orders}
                loading={loading}
                selectedOrders={selectedOrders}
                expandedRows={expandedRows}
                couriers={couriers}
                primaryRole={primaryRole}
                canUpdateStatus={canUpdateStatus}
                canOverrideDispatchLock={canOverrideDispatchLock}
                canAssignCouriers={permissions.canAssignCouriers}
                canSetDeliveredWithDate={hasAnyRole(['super_admin', 'super_manager', 'senior_staff'])}
                onSelectOrder={handleSelectOrder}
                onToggleExpand={toggleExpanded}
                onStatusChange={handleUpdateOrderStatus}
                onMarkDispatched={handleQuickMarkDispatched}
                onGenerateLabel={handleQuickGenerateLabel}
                onViewActivity={handleQuickViewActivity}
                onCourierAssigned={fetchOrders}
              />
            </Table>
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {pagination.start}-{pagination.end} of {totalCount.toLocaleString()} orders
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Page"
                    value={jumpToPage}
                    onChange={e => setJumpToPage(e.target.value)}
                    className="w-20 h-9"
                    onKeyDown={e => e.key === 'Enter' && handleJumpToPage()}
                  />
                  <Button variant="outline" size="sm" onClick={handleJumpToPage}>Go</Button>
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPage(Math.max(0, page - 1))} className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationLink isActive>{page + 1}</PaginationLink>
                    </PaginationItem>
                    <PaginationItem>
                      <span className="text-sm text-muted-foreground px-2">of {pagination.totalPages}</span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPage(page + 1)} className={(page + 1) >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <OrderDetailsModal open={detailsModalOpen} onOpenChange={setDetailsModalOpen} order={selectedOrder as any} />
      <CancelOrderDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        orderNumber={orderToCancel?.orderNumber || ''}
        onConfirm={handleConfirmCancellation}
      />
    </div>
  );
};

export default OrderDashboard;
