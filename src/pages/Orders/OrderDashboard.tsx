import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Upload, Plus, Filter, ChevronDown, ChevronUp, Package, Edit, Trash2, Send, Download, UserPlus, CheckCircle, Truck, X, Save, Shield, AlertTriangle, AlertCircle, MapPin } from 'lucide-react';
import TagsNotes from '@/components/TagsNotes';
import NewOrderDialog from '@/components/NewOrderDialog';
import NewDispatchDialog from '@/components/dispatch/NewDispatchDialog';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/utils/activityLogger';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { AdvancedFilterPanel } from '@/components/AdvancedFilterPanel';
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkUpdateOrderStatus, bulkUpdateOrderCourier, bulkAssignOrders, exportToCSV } from '@/utils/bulkOperations';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { batchAnalyzeOrders } from '@/utils/orderFraudDetection';

const OrderDashboard = () => {
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    address: ''
  });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState({
    totalOrders: 0,
    booked: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    returns: 0
  });
  const [dispatchOrderId, setDispatchOrderId] = useState<string>("");
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('orders_page_size');
    return saved ? Number(saved) : 50;
  });
  const [totalCount, setTotalCount] = useState(0);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [combinedStatus, setCombinedStatus] = useState<string>('all');

  const { user } = useAuth();
  const { progress, executeBulkOperation } = useBulkOperations();
  const { toast } = useToast();
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const offset = page * pageSize;
      
      // 1. Get base orders with pagination and count
      const { data: baseOrders, error: ordersError, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        toast({
          title: "Error loading orders",
          description: ordersError.message,
          variant: "destructive"
        });
        setOrders([]);
        return;
      }

      if (!baseOrders || baseOrders.length === 0) {
        setOrders([]);
        setTotalCount(0);
        return;
      }

      setTotalCount(count || 0);

      // 2. Collect IDs for batch fetching related data
      const orderIds = baseOrders.map(o => o.id);
      const assignedIds = baseOrders
        .map(o => o.assigned_to)
        .filter((id): id is string => id != null);

      // 3. Fetch related data in parallel
      const [itemsResult, profilesResult] = await Promise.all([
        supabase
          .from('order_items')
          .select('item_name, quantity, price, order_id')
          .in('order_id', orderIds),
        assignedIds.length > 0
          ? supabase
              .from('profiles')
              .select('id, full_name, email')
              .in('id', assignedIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      // 4. Build lookup maps
      const itemsByOrderId = new Map<string, any[]>();
      (itemsResult.data || []).forEach(item => {
        if (!itemsByOrderId.has(item.order_id)) {
          itemsByOrderId.set(item.order_id, []);
        }
        itemsByOrderId.get(item.order_id)!.push(item);
      });

      const profilesById = new Map<string, any>();
      (profilesResult.data || []).forEach(profile => {
        profilesById.set(profile.id, profile);
      });

      // 5. Merge data and format orders
      const formattedOrders = baseOrders.map(order => {
        let orderNotes = '';
        let userComments = [];
        
        if (order.notes && typeof order.notes === 'string') {
          orderNotes = order.notes;
        }
        
        if (order.comments) {
          try {
            if (typeof order.comments === 'string') {
              userComments = JSON.parse(order.comments);
            } else if (Array.isArray(order.comments)) {
              userComments = order.comments;
            }
          } catch (e) {
            userComments = [];
          }
        }
        
        return {
          id: order.id,
          orderNumber: order.order_number,
          customerId: order.customer_id || 'N/A',
          trackingId: order.tracking_id || 'N/A',
          customer: order.customer_name,
          email: order.customer_email || 'N/A',
          phone: order.customer_phone,
          courier: order.courier || 'N/A',
          status: order.status,
          verificationStatus: order.verification_status || 'pending',
          amount: `PKR ${order.total_amount?.toLocaleString() || '0'}`,
          date: new Date(order.created_at || '').toLocaleDateString(),
          createdAtISO: order.created_at,
          address: order.customer_address,
          gptScore: order.gpt_score || 0,
          totalPrice: order.total_amount || 0,
          orderType: order.order_type || 'COD',
          city: order.city,
          items: itemsByOrderId.get(order.id) || [],
          assignedTo: order.assigned_to,
          assignedToProfile: order.assigned_to ? profilesById.get(order.assigned_to) : null,
          dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : 'N/A',
          deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
          orderNotes: orderNotes,
          userComments: userComments,
          tags: []
        };
      });

      // Phase 4: Analyze orders for fraud
      const fraudAnalyses = batchAnalyzeOrders(formattedOrders, baseOrders);
      const ordersWithFraud = formattedOrders.map((order, index) => ({
        ...order,
        fraudIndicators: fraudAnalyses[index]?.fraudIndicators || { riskScore: 0, riskLevel: 'low', flags: [], patterns: [], autoActions: [], shouldBlock: false, shouldFlag: false }
      }));

      setOrders(ordersWithFraud);

      // Calculate summary data from current page
      setSummaryData({
        totalOrders: count || 0,
        booked: formattedOrders.filter(o => o.status === 'booked').length,
        dispatched: formattedOrders.filter(o => o.status === 'dispatched').length,
        delivered: formattedOrders.filter(o => o.status === 'delivered').length,
        cancelled: formattedOrders.filter(o => o.status === 'cancelled').length,
        returns: formattedOrders.filter(o => o.status === 'returned').length
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Error",
        description: "Failed to load orders. Please try again.",
        variant: "destructive"
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOrders();
  }, [page, pageSize]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('orders_page_size', String(newSize));
    setPage(0);
  };

  const handleNewOrderCreated = async () => {
    setPage(0);
    await fetchOrders();
  };

  // Bulk operations
  const bulkOperations: BulkOperation[] = [
    {
      id: 'dispatch',
      label: 'Mark as Dispatched',
      icon: Send,
      action: async (ids) => bulkUpdateOrderStatus(ids, 'dispatched'),
    },
    {
      id: 'deliver',
      label: 'Mark as Delivered',
      icon: CheckCircle,
      action: async (ids) => bulkUpdateOrderStatus(ids, 'delivered'),
    },
    {
      id: 'leopard',
      label: 'Assign to Leopard',
      icon: Send,
      action: async (ids) => bulkUpdateOrderCourier(ids, 'leopard'),
    },
    {
      id: 'postex',
      label: 'Assign to PostEx',
      icon: Send,
      action: async (ids) => bulkUpdateOrderCourier(ids, 'postex'),
    },
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      action: async (ids) => {
        const selectedOrders = orders.filter(o => ids.includes(o.id));
        exportToCSV(selectedOrders, `orders-${new Date().toISOString().split('T')[0]}`);
        return { success: ids.length, failed: 0 };
      },
    },
  ];

  const handleBulkOperation = (operation: BulkOperation) => {
    executeBulkOperation(operation, selectedOrders, () => {
      fetchOrders();
      setSelectedOrders([]);
    });
  };
  const getStatusBadge = (status: string, courierStatus?: string) => {
    const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
      // New comprehensive statuses
      'received': { variant: 'secondary', label: 'Received', icon: Package },
      'pending_confirmation': { variant: 'warning', label: 'Order Confirmation Needed', icon: AlertCircle },
      'pending_address': { variant: 'warning', label: 'Address Confirmation Needed', icon: MapPin },
      'pending_dispatch': { variant: 'info', label: 'Pending for Dispatch', icon: AlertTriangle },
      'dispatched': { variant: 'default', label: 'Order Dispatched', icon: Truck },
      'in_transit': { variant: 'default', label: courierStatus || 'In Transit', icon: Truck },
      'out_for_delivery': { variant: 'default', label: 'Out for Delivery', icon: Truck },
      'delivered': { variant: 'success', label: 'Delivered', icon: CheckCircle },
      'return_marked': { variant: 'destructive', label: 'Returned - Marked by Courier', icon: AlertTriangle },
      'return_received': { variant: 'secondary', label: 'Return Received at Warehouse', icon: Package },
      
      // Legacy statuses for backward compatibility
      'booked': { variant: 'warning', label: 'Booked', icon: Package },
      'cancelled': { variant: 'destructive', label: 'Cancelled', icon: X },
      'returned': { variant: 'secondary', label: 'Returned', icon: Package },
      'pending': { variant: 'secondary', label: 'Pending', icon: AlertCircle }
    };
    
    const statusInfo = statusMap[status] || statusMap.pending;
    const StatusIcon = statusInfo.icon;
    
    return (
      <Badge variant={statusInfo.variant} className="gap-1.5">
        {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
        {statusInfo.label}
      </Badge>
    );
  };
  const summaryCards = [{
    title: 'Total Orders',
    value: totalCount.toLocaleString(),
    color: 'bg-blue-500'
  }, {
    title: 'Booked',
    value: summaryData.booked.toLocaleString(),
    color: 'bg-orange-500'
  }, {
    title: 'Dispatched',
    value: summaryData.dispatched.toLocaleString(),
    color: 'bg-purple-500'
  }, {
    title: 'Delivered',
    value: summaryData.delivered.toLocaleString(),
    color: 'bg-green-500'
  }, {
    title: 'Cancelled',
    value: summaryData.cancelled.toLocaleString(),
    color: 'bg-red-500'
  }, {
    title: 'Returns',
    value: summaryData.returns.toLocaleString(),
    color: 'bg-gray-500'
  }];
  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };
  const handleSelectAllCurrentPage = () => {
    setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map(order => order.id));
  };
  const handleSelectAllPages = () => {
    setSelectAllPages(!selectAllPages);
    if (!selectAllPages) {
      setSelectedOrders(orders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };
  const toggleExpanded = (orderId: string) => {
    setExpandedRows(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };
  const handleBulkAction = (action: string) => {
    // Bulk action implementation would go here
  };
  const handleAddTag = (orderId: string, tag: string) => {
    // Add tag to order implementation
    setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? {
      ...order,
      tags: [...order.tags, {
        id: `tag_${Date.now()}`,
        text: tag,
        addedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
        addedAt: new Date().toLocaleString(),
        canDelete: true
      }]
    } : order));
  };
  const handleAddNote = async (orderId: string, note: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const currentComments = order?.userComments || [];
      
      const newComment = {
        id: `comment_${Date.now()}`,
        text: note,
        addedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
        addedAt: new Date().toISOString(),
        canDelete: true
      };
      
      const updatedComments = [...currentComments, newComment];
      
      // Save to comments field (not notes!)
      const { error } = await supabase
        .from('orders')
        .update({ comments: updatedComments })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => prevOrders.map(o => 
        o.id === orderId ? {
          ...o,
          userComments: updatedComments
        } : o
      ));
      
      // Log activity
      await logActivity({
        action: 'order_updated',
        entityType: 'order',
        entityId: orderId,
        details: { comment: note },
      });
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };
  
  const handleDeleteTag = (orderId: string, tagId: string) => {
    // Delete tag from order implementation
    setOrders(prevOrders => prevOrders.map(order => order.id === orderId ? {
      ...order,
      tags: order.tags.filter(tag => tag.id !== tagId)
    } : order));
  };
  
  const handleDeleteNote = async (orderId: string, noteId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const updatedComments = order?.userComments.filter(c => c.id !== noteId) || [];
      
      // Save to comments field
      const { error } = await supabase
        .from('orders')
        .update({ comments: updatedComments })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => prevOrders.map(o => 
        o.id === orderId ? {
          ...o,
          userComments: updatedComments
        } : o
      ));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };
  const handleEditOrder = (order: any) => {
    setEditingOrder(order);
    setEditForm({
      email: order.email,
      address: order.address
    });
  };
  const handleSaveEdit = () => {
    if (!editingOrder) return;
    setOrders(prevOrders => prevOrders.map(order => order.id === editingOrder.id ? {
      ...order,
      email: editForm.email,
      address: editForm.address
    } : order));
    setEditingOrder(null);
    setEditForm({
      email: '',
      address: ''
    });
  };
  const handleDeleteOrder = (orderId: string) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    setSelectedOrders(prev => prev.filter(id => id !== orderId));
    setExpandedRows(prev => prev.filter(id => id !== orderId));
  };

  const handleAssignStaff = async (orderId: string, staffId: string | null) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_to: staffId === 'unassigned' ? null : staffId })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? {
                ...order,
                assignedTo: staffId === 'unassigned' ? null : staffId,
                assignedToProfile: staffId === 'unassigned' 
                  ? null 
                  : staffUsers.find(u => u.id === staffId)
              }
            : order
        )
      );
      
      // Log activity
      if (user) {
        await logActivity({
          userId: user.id,
          action: 'order_assigned',
          entityType: 'order',
          entityId: orderId,
          details: { assignedTo: staffId },
        });
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
    }
  };

  // Advanced filtering
  const {
    filters,
    filteredData: filteredOrders,
    updateFilter,
    updateCustomFilter,
    resetFilters,
    savedPresets,
    savePreset,
    loadPreset,
    deletePreset,
    activeFiltersCount,
  } = useAdvancedFilters(orders, {
    searchFields: ['orderNumber', 'trackingId', 'customer', 'id', 'email', 'phone', 'city'],
    statusField: 'status',
    dateField: 'createdAtISO',
    amountField: 'totalPrice',
    customFilters: {
      courier: (order, value) => order.courier?.toLowerCase() === value.toLowerCase(),
      orderType: (order, value) => order.orderType === value,
      verificationStatus: (order, value) => order.verificationStatus === value,
    },
  });

  // Quick filter handlers
  const applyQuickFilter = (filterType: string) => {
    if (quickFilter === filterType) {
      // Deactivate if clicking the same filter
      setQuickFilter(null);
      setCombinedStatus('all');
      resetFilters();
    } else {
      setQuickFilter(filterType);
      
      switch (filterType) {
        case 'needsConfirmation':
          setCombinedStatus('pending_order');
          updateFilter('status', 'pending');
          updateCustomFilter('verificationStatus', 'all');
          break;
        case 'needsVerification':
          setCombinedStatus('pending_address');
          updateCustomFilter('verificationStatus', 'pending');
          updateFilter('status', 'all');
          break;
        case 'actionRequired':
          // This will show orders where either status is pending
          // We'll handle this with a custom filter approach
          setCombinedStatus('all');
          updateFilter('status', 'all');
          updateCustomFilter('verificationStatus', 'all');
          break;
      }
    }
  };

  // Apply action required filter manually
  const finalFilteredOrders = quickFilter === 'actionRequired' 
    ? filteredOrders.filter(order => order.status === 'pending' || order.verificationStatus === 'pending')
    : filteredOrders;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalCount);
  const totalPages = Math.ceil(totalCount / pageSize);
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600 mt-1">
              {totalCount > 0 ? `Showing ${start}–${end} of ${totalCount.toLocaleString()} orders` : 'Manage and track all your orders'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={fetchOrders} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <NewOrderDialog onOrderCreated={handleNewOrderCreated} />
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        </div>

        {/* Bulk Operations */}
        <BulkOperationsPanel
          selectedCount={selectedOrders.length}
          operations={bulkOperations}
          onExecute={handleBulkOperation}
          progress={progress}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card, index) => <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>)}
      </div>


      {/* Orders Table with Integrated Filters */}
      <Card>
        {/* Combined Quick Filter Buttons */}
        <div className="flex gap-2 p-4 border-b bg-muted/20">
          <Select 
            value={quickFilter || 'none'} 
            onValueChange={(value) => {
              if (value === 'none') {
                setQuickFilter(null);
                setCombinedStatus('all');
                resetFilters();
              } else {
                applyQuickFilter(value);
              }
            }}
          >
            <SelectTrigger className="w-[250px] h-9">
              <SelectValue placeholder="Quick Filters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Quick Filter</SelectItem>
              <SelectItem value="needsConfirmation">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Needs Confirmation
                </div>
              </SelectItem>
              <SelectItem value="needsVerification">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Needs Address Check
                </div>
              </SelectItem>
              <SelectItem value="actionRequired">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Action Required
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Inline Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-muted/30 border-b">
          {/* Left side - Quick filters */}
          <div className="flex flex-1 gap-3 flex-wrap items-center w-full sm:w-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Rows:</Label>
              <Select value={String(pageSize)} onValueChange={(val) => handlePageSizeChange(Number(val))}>
                <SelectTrigger className="w-[90px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                  <SelectItem value="500">500</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search orders, tracking ID, customer..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* Combined Status & Verification Filter */}
            <Select 
              value={combinedStatus} 
              onValueChange={(value) => {
                setCombinedStatus(value);
                setQuickFilter(null);
                
                // Handle combined status/verification values
                if (value === 'all') {
                  updateFilter('status', 'all');
                  updateCustomFilter('verificationStatus', 'all');
                } else if (value === 'pending_order') {
                  updateFilter('status', 'pending');
                  updateCustomFilter('verificationStatus', 'all');
                } else if (value === 'pending_address') {
                  updateFilter('status', 'all');
                  updateCustomFilter('verificationStatus', 'pending');
                } else if (value === 'pending_verification') {
                  updateFilter('status', 'all');
                  updateCustomFilter('verificationStatus', 'pending');
                } else if (value === 'approved_verification') {
                  updateFilter('status', 'all');
                  updateCustomFilter('verificationStatus', 'approved');
                } else if (value === 'disapproved_verification') {
                  updateFilter('status', 'all');
                  updateCustomFilter('verificationStatus', 'disapproved');
                } else {
                  // For standard status values
                  updateFilter('status', value);
                  updateCustomFilter('verificationStatus', 'all');
                }
              }}
            >
              <SelectTrigger className="w-[250px] h-9">
                <SelectValue placeholder="All Statuses & Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_order">Pending Order Confirmation</SelectItem>
                <SelectItem value="pending_address">Pending Address Confirmation</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="pending_verification">Pending Verification</SelectItem>
                <SelectItem value="approved_verification">Approved</SelectItem>
                <SelectItem value="disapproved_verification">Disapproved</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Date Range */}
            <DatePickerWithRange
              date={filters.dateRange}
              setDate={(date) => updateFilter('dateRange', date)}
            />
            
            {/* Active filters badge */}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-9 px-3">
                {activeFiltersCount} filters
              </Badge>
            )}
          </div>
          
          {/* Right side - Advanced filters button */}
          <div className="flex gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  More Filters
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Advanced Filters</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Amount Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Min Amount (PKR)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={filters.amountMin || ''}
                        onChange={(e) => updateFilter('amountMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                    <div>
                      <Label>Max Amount (PKR)</Label>
                      <Input
                        type="number"
                        placeholder="999999"
                        value={filters.amountMax || ''}
                        onChange={(e) => updateFilter('amountMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                  </div>
                  
                  {/* Courier */}
                  <div>
                    <Label>Courier</Label>
                    <Select
                      value={filters.customValues?.courier || 'all'}
                      onValueChange={(value) => updateCustomFilter('courier', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Couriers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Couriers</SelectItem>
                        <SelectItem value="leopard">Leopard</SelectItem>
                        <SelectItem value="postex">PostEx</SelectItem>
                        <SelectItem value="tcs">TCS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Order Type */}
                  <div>
                    <Label>Order Type</Label>
                    <Select
                      value={filters.customValues?.orderType || 'all'}
                      onValueChange={(value) => updateCustomFilter('orderType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                        <SelectItem value="Prepaid">Prepaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Saved Presets Section */}
                  {savedPresets.length > 0 && (
                    <div>
                      <Label>Saved Filter Presets</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {savedPresets.map(preset => (
                          <div key={preset.id} className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadPreset(preset.id)}
                            >
                              {preset.name}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePreset(preset.id)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Save Current Filters as Preset */}
                  {activeFiltersCount > 0 && (
                    <div className="pt-4 border-t">
                      <Label>Save Current Filters</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Preset name..."
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                        />
                        <Button onClick={() => {
                          if (presetName.trim()) {
                            savePreset(presetName);
                            setPresetName('');
                          }
                        }}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table Header with Selection */}
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span>Orders {start}–{end} of {totalCount.toLocaleString()}</span>
              {activeFiltersCount > 0 && (
                <span className="text-xs text-muted-foreground font-normal">
                  Some orders may be hidden by active filters
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedOrders.length === finalFilteredOrders.length && finalFilteredOrders.length > 0} onCheckedChange={handleSelectAllCurrentPage} />
                <span className="text-sm text-muted-foreground">Select All (Current Page)</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectAllPages} onCheckedChange={handleSelectAllPages} />
                <span className="text-sm text-muted-foreground">Select All Pages</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">Select</TableHead>
                <TableHead className="min-w-[140px]">Order ID</TableHead>
                <TableHead className="min-w-[140px]">Tracking ID</TableHead>
                <TableHead className="min-w-[240px]">Order Status</TableHead>
                <TableHead className="min-w-[140px]">Courier Assigned</TableHead>
                <TableHead className="w-[50px]">Expand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Loading orders...</span>
                    </div>
                  </TableCell>
                </TableRow> : finalFilteredOrders.length === 0 ? <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">No orders found</span>
                    </div>
                  </TableCell>
                </TableRow> : finalFilteredOrders.map(order => (
                  <React.Fragment key={order.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox 
                        checked={selectedOrders.includes(order.id)} 
                        onCheckedChange={() => handleSelectOrder(order.id)} 
                      />
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{order.orderNumber || order.id.slice(0, 8)}</span>
                        {order.fraudIndicators?.isHighRisk && (
                          <Badge variant="destructive" className="gap-1 w-fit text-xs">
                            <Shield className="h-3 w-3" />
                            Risk: {order.fraudIndicators.riskScore}%
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className={`font-mono text-sm ${order.trackingId === 'N/A' ? 'text-muted-foreground' : 'font-medium'}`}>
                          {order.trackingId}
                        </span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {getStatusBadge(order.status)}
                        {order.status === 'dispatched' && order.courier && order.courier !== 'N/A' && (
                          <span className="text-xs text-muted-foreground">
                            Via {order.courier.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      {order.courier && order.courier !== 'N/A' ? (
                        <Badge variant="outline" className="gap-1.5">
                          <Truck className="h-3.5 w-3.5" />
                          {order.courier.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not Assigned</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleExpanded(order.id)}
                        className="h-8 w-8 p-0"
                      >
                        {expandedRows.includes(order.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  
                  {expandedRows.includes(order.id) && <TableRow>
                       <TableCell colSpan={6} className="bg-muted/30 p-6">
                         <Tabs defaultValue="customer-details" className="w-full">
                           <TabsList className="grid w-full grid-cols-2">
                             <TabsTrigger value="customer-details">Customer Details</TabsTrigger>
                             <TabsTrigger value="order-details">Order Details</TabsTrigger>
                           </TabsList>
                           
                           <TabsContent value="customer-details" className="mt-4">
                             <div className="space-y-4">
                               <h4 className="font-semibold mb-3">Customer Information</h4>
                               <div className="space-y-3 text-sm">
                                 <p><span className="font-medium">Customer Name:</span> {order.customer}</p>
                                 <p><span className="font-medium">Customer Phone:</span> {order.phone}</p>
                                 <p><span className="font-medium">Customer Email:</span> {order.email}</p>
                                 <p><span className="font-medium">Customer Address:</span> {order.address}</p>
                                 <p><span className="font-medium">City:</span> {order.city}</p>
                               </div>
                             </div>
                           </TabsContent>
                           
                           <TabsContent value="order-details" className="mt-4">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-semibold mb-3">Order Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <p><span className="font-medium">Customer Order Total Worth:</span> {order.amount}</p>
                                      
                                      <p><span className="font-medium">Dispatched At:</span> {order.dispatchedAt}</p>
                                      <p><span className="font-medium">Delivered At:</span> {order.deliveredAt}</p>
                                      <p><span className="font-medium">Order Type:</span> {order.orderType}</p>
                                    </div>
                                    
                                    {/* Manual Verification Buttons */}
                                    {(order.status === 'pending_confirmation' || order.status === 'pending_address') && (
                                      <div className="mt-4 flex flex-col gap-2">
                                        {order.status === 'pending_confirmation' && (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => {
                                              toast({
                                                title: "Order Verified",
                                                description: "Order has been manually verified.",
                                              });
                                              // TODO: Implement actual verification logic
                                            }}
                                            className="w-full"
                                          >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Verify Order
                                          </Button>
                                        )}
                                        
                                        {order.status === 'pending_address' && (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => {
                                              toast({
                                                title: "Address Verified",
                                                description: "Address has been manually verified.",
                                              });
                                              // TODO: Implement actual verification logic
                                            }}
                                            className="w-full"
                                          >
                                            <MapPin className="h-4 w-4 mr-2" />
                                            Verify Address
                                          </Button>
                                        )}
                                      </div>
                                    )}
                                    
                                    {order.status === 'booked' && (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setDispatchOrderId(order.id);
                                          setIsDispatchDialogOpen(true);
                                        }}
                                        className="mt-3"
                                      >
                                        <Truck className="h-4 w-4 mr-2" />
                                        Quick Dispatch
                                      </Button>
                                    )}
                                  </div>
                                 
                  <div>
                    <h4 className="font-semibold mb-3">Internal Notes</h4>
                    <TagsNotes
                      itemId={order.id}
                      orderNotes={order.orderNotes}
                      notes={order.userComments}
                      onAddNote={(note) => handleAddNote(order.id, note)}
                      onDeleteNote={(noteId) => handleDeleteNote(order.id, noteId)}
                    />
                  </div>
                               </div>
                               
                               <div className="space-y-4">
                                 <div>
                                   <h4 className="font-semibold mb-3">Order Items</h4>
                                   <div className="space-y-2">
                                     {order.items.length > 0 ? order.items.map((item, index) => <div key={index} className="text-sm border-b pb-2">
                                         <p><span className="font-medium">Item:</span> {item.item_name}</p>
                                         <p><span className="font-medium">Quantity:</span> {item.quantity}</p>
                                         <p><span className="font-medium">Price:</span> PKR {item.price}</p>
                                       </div>) : <p className="text-sm text-gray-500">No items available</p>}
                                   </div>
                                 </div>
                               </div>
                             </div>
                           </TabsContent>
                         </Tabs>
                      </TableCell>
                    </TableRow>}
                 </React.Fragment>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Pagination */}
      {totalCount > pageSize && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                </PaginationItem>
                 <PaginationItem>
                   <span className="text-sm px-4">
                     Page {page + 1} of {totalPages} ({totalCount.toLocaleString()} total orders)
                   </span>
                 </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                  >
                    Next
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        </Card>
      )}
      
      {/* New Dispatch Dialog */}
      <NewDispatchDialog 
        open={isDispatchDialogOpen}
        onOpenChange={setIsDispatchDialogOpen}
        preSelectedOrderId={dispatchOrderId}
      />
    </div>;
};
export default OrderDashboard;