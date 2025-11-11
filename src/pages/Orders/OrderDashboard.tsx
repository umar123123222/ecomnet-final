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

// Wrapper to avoid passing attributes directly to React.Fragment (fixes dev overlay warnings)
const Noop: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Upload, Plus, Filter, ChevronDown, ChevronUp, Package, Edit, Trash2, Send, Download, UserPlus, CheckCircle, Truck, X, Save, Shield, AlertTriangle, AlertCircle, MapPin, Clock, User, Phone, Mail, Calendar, ShoppingBag, FileText, RefreshCw, Copy } from 'lucide-react';
import { downloadCourierLabel } from '@/utils/courierLabelDownload';
import TagsNotes from '@/components/TagsNotes';
import NewOrderDialog from '@/components/NewOrderDialog';
import NewDispatchDialog from '@/components/dispatch/NewDispatchDialog';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { logActivity } from '@/utils/activityLogger';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { AdvancedFilterPanel } from '@/components/AdvancedFilterPanel';
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkUpdateOrderStatus, bulkUpdateOrderCourier, bulkAssignOrders, bulkUnassignCouriers, exportToCSV } from '@/utils/bulkOperations';
import { useToast } from '@/hooks/use-toast';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { batchAnalyzeOrders } from '@/utils/orderFraudDetection';
import { BulkUploadDialog } from '@/components/orders/BulkUploadDialog';
import { OrderActivityLog } from '@/components/orders/OrderActivityLog';
import { QuickActionButtons } from '@/components/orders/QuickActionButtons';
import { OrderAlertIndicators } from '@/components/orders/OrderAlertIndicators';
import { InlineCourierAssign } from '@/components/orders/InlineCourierAssign';
import { OrderKPIPanel } from '@/components/orders/OrderKPIPanel';
import { FilterPresets } from '@/components/orders/FilterPresets';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { Eye, EyeOff } from 'lucide-react';
import { AWBDownloadButton } from '@/components/orders/AWBDownloadButton';

const OrderDashboard = () => {
  const { isManager, isSeniorStaff, primaryRole } = useUserRoles();
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
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [activityLogOrderId, setActivityLogOrderId] = useState<string | null>(null);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [jumpToPage, setJumpToPage] = useState<string>('');
  const [showKPIPanel, setShowKPIPanel] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

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
          shopifyOrderNumber: order.shopify_order_number,
          shopifyOrderId: order.shopify_order_id,
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
          items: (itemsByOrderId.get(order.id) && (itemsByOrderId.get(order.id) as any[]).length > 0) ? itemsByOrderId.get(order.id) : (order.items || []),
          assignedTo: order.assigned_to,
          assignedToProfile: order.assigned_to ? profilesById.get(order.assigned_to) : null,
          dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : 'N/A',
          deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
          orderNotes: orderNotes,
          userComments: userComments,
          tags: [],
          shopify_order_id: order.shopify_order_id
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
    fetchCouriers();
  }, [page, pageSize]);

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCouriers(data || []);
    } catch (error) {
      console.error('Error fetching couriers:', error);
    }
  };

  // Real-time subscription for order updates
  useEffect(() => {
    const channel = supabase
      .channel('order-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Real-time order change detected:', payload);
          // Refetch orders to get the latest data
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, pageSize]);

  // Keyboard shortcuts for pagination
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'ArrowLeft' && page > 0) {
        setPage(p => Math.max(0, p - 1));
      } else if (e.key === 'ArrowRight' && (page + 1) * pageSize < totalCount) {
        setPage(p => p + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [page, pageSize, totalCount]);

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('orders_page_size', String(newSize));
    setPage(0);
  };

  const handleNewOrderCreated = async () => {
    setPage(0);
    await fetchOrders();
  };

  // Bulk status update handler
  const handleBulkStatusChange = async (status: string) => {
    try {
      const result = await bulkUpdateOrderStatus(selectedOrders, status as any);
      
      if (result.success > 0) {
        toast({
          title: "Success",
          description: `Updated ${result.success} order(s) to ${status}`,
        });
        fetchOrders();
        setSelectedOrders([]);
      }
      
      if (result.failed > 0) {
        toast({
          title: "Partial Success",
          description: `${result.failed} order(s) failed to update`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  // Bulk courier assignment with booking and label generation
  const handleBulkCourierAssign = async (courierId: string, courierName: string) => {
    try {
      // Show loading toast
      toast({
        title: "Processing",
        description: `Booking ${selectedOrders.length} orders with ${courierName}...`,
      });

      // Call bulk booking edge function
      const { data, error } = await supabase.functions.invoke('bulk-courier-booking', {
        body: {
          orderIds: selectedOrders,
          courierId: courierId
        }
      });

      if (error) {
        throw error;
      }

      if (!data.success && data.failedCount === data.total) {
        throw new Error(data.error || 'All bookings failed');
      }

      // Get successful order IDs for AWB generation
      const successfulOrderIds = data.results
        .filter((r: any) => r.success)
        .map((r: any) => r.orderId);

      // Show results
      if (data.successCount > 0) {
        toast({
          title: "Booking Complete",
          description: `Successfully booked ${data.successCount} of ${data.total} orders. Click to generate AWBs.`,
        });

        // Auto-generate AWBs after successful booking
        if (successfulOrderIds.length > 0) {
          setTimeout(() => {
            handleGenerateAWBs(successfulOrderIds, courierId, courierName);
          }, 1000);
        }
      }

      if (data.failedCount > 0) {
        const failedOrders = data.results.filter((r: any) => !r.success);
        const errorSummary = failedOrders
          .slice(0, 3)
          .map((r: any) => `${r.orderNumber}: ${r.error}`)
          .join('\n');
        
        toast({
          title: `${data.failedCount} Bookings Failed`,
          description: (
            <div className="text-xs">
              <p className="mb-2">Failed orders:</p>
              <pre className="whitespace-pre-wrap">{errorSummary}</pre>
              {failedOrders.length > 3 && (
                <p className="mt-2">...and {failedOrders.length - 3} more</p>
              )}
            </div>
          ),
          variant: "destructive",
        });
      }

      // Refresh orders and clear selection
      fetchOrders();
      if (data.successCount > 0) {
        setSelectedOrders([]);
      }

    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to book orders with courier",
        variant: "destructive",
      });
    }
  };

  // Generate AWBs for booked orders
  const handleGenerateAWBs = async (orderIds: string[], courierId: string, courierName: string) => {
    try {
      toast({
        title: "Generating AWBs...",
        description: `Processing ${orderIds.length} orders`,
      });

      // Get courier code
      const { data: courier } = await supabase
        .from('couriers')
        .select('code')
        .eq('id', courierId)
        .single();

      if (!courier) {
        throw new Error('Courier not found');
      }

      const { data, error } = await supabase.functions.invoke('generate-courier-awbs', {
        body: {
          courier_code: courier.code,
          order_ids: orderIds
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "AWBs Generated",
          description: `Generated ${data.pdf_count} PDF(s) for ${data.tracking_ids.length} orders`,
        });

        // Download generated AWBs
        const { data: awbRecord } = await supabase
          .from('courier_awbs')
          .select('*')
          .eq('id', data.awb_id)
          .single();

        if (awbRecord?.pdf_data) {
          const pdfData = awbRecord.pdf_data;
          
          // Check if it's multiple PDFs or single
          if (pdfData.startsWith('[')) {
            // Multiple PDFs (JSON array of base64 strings)
            const pdfArray = JSON.parse(pdfData);
            toast({
              title: "Downloading PDFs",
              description: `Downloading ${pdfArray.length} PDF file(s)...`,
            });
            pdfArray.forEach((base64: string, index: number) => {
              setTimeout(() => {
                const link = document.createElement('a');
                link.href = `data:application/pdf;base64,${base64}`;
                link.download = `awb-${courierName}-batch-${index + 1}.pdf`;
                link.click();
              }, index * 500);
            });
          } else {
            // Single PDF (base64 string)
            const link = document.createElement('a');
            link.href = `data:application/pdf;base64,${pdfData}`;
            link.download = `awb-${courierName}.pdf`;
            link.click();
          }
        }
      } else {
        throw new Error(data.message || 'Failed to generate AWBs');
      }
    } catch (error: any) {
      console.error('AWB generation error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate AWBs",
        variant: "destructive",
      });
    }
  };

  // Bulk courier unassignment - calls courier API to cancel
  const handleBulkCourierUnassign = async () => {
    try {
      // Show loading toast
      toast({
        title: "Processing",
        description: `Unassigning couriers from ${selectedOrders.length} orders...`,
      });

      // Call bulk unassign function
      const result = await bulkUnassignCouriers(selectedOrders);

      if (result.success > 0) {
        toast({
          title: "Success",
          description: `Unassigned ${result.success} order(s) from couriers. Orders cancelled on courier portals.`,
        });
        fetchOrders();
        setSelectedOrders([]);
      }

      if (result.failed > 0) {
        toast({
          title: "Partial Success",
          description: `${result.failed} order(s) failed to unassign. ${result.errors?.join(', ')}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unassign couriers",
        variant: "destructive",
      });
    }
  };

  // Export handler
  const handleExport = () => {
    const selectedOrdersData = orders.filter(o => selectedOrders.includes(o.id));
    exportToCSV(selectedOrdersData, `orders-${new Date().toISOString().split('T')[0]}`);
    toast({
      title: "Export Complete",
      description: `Exported ${selectedOrdersData.length} order(s)`,
    });
  };
  const getStatusBadge = (status: string, orderId: string, courierStatus?: string) => {
    const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
      'pending': { variant: 'warning', label: 'Pending', icon: Clock },
      'booked': { variant: 'info', label: 'Booked', icon: Package },
      'dispatched': { variant: 'processing', label: 'Dispatched', icon: Truck },
      'delivered': { variant: 'success', label: 'Delivered', icon: CheckCircle },
      'returned': { variant: 'destructive', label: 'Returned', icon: Package },
      'cancelled': { variant: 'destructive', label: 'Cancelled', icon: X },
    };
    
    const statusInfo = statusMap[status] || statusMap.pending;
    const StatusIcon = statusInfo.icon;
    
    const allStatuses = [
      { value: 'pending', label: 'Pending' },
      { value: 'booked', label: 'Booked' },
      { value: 'dispatched', label: 'Dispatched' },
      { value: 'delivered', label: 'Delivered' },
      { value: 'returned', label: 'Returned' },
      { value: 'cancelled', label: 'Cancelled' },
    ];
    
    // Check if user has permission to update orders
    const canUpdateStatus = isManager() || isSeniorStaff() || primaryRole === 'staff';
    
    // If user can't update, just show the badge without dropdown
    if (!canUpdateStatus) {
      return (
        <Badge variant={statusInfo.variant} className="gap-1.5">
          {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
          {statusInfo.label}
        </Badge>
      );
    }
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
            <Badge variant={statusInfo.variant} className="gap-1.5 cursor-pointer hover:opacity-80">
              {StatusIcon && <StatusIcon className="h-3.5 w-3.5" />}
              {statusInfo.label}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-background">
          {allStatuses.map((statusOption) => (
            <DropdownMenuItem
              key={statusOption.value}
              onClick={() => handleUpdateOrderStatus(orderId, statusOption.value)}
              className={status === statusOption.value ? 'bg-muted' : ''}
            >
              {statusOption.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('assigned_to')
        .eq('id', orderId)
        .single();

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
      await logActivity({
        action: 'order_assigned',
        entityType: 'order',
        entityId: orderId,
        details: { 
          previous_assignee: currentOrder?.assigned_to,
          new_assignee: staffId === 'unassigned' ? null : staffId
        },
      });

      toast({
        title: "Order assigned",
        description: "Order has been assigned successfully",
      });
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast({
        title: "Error",
        description: "Failed to assign order",
        variant: "destructive",
      });
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: string, additionalData?: Record<string, any>) => {
    try {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      const updateData: Record<string, any> = { status: newStatus, ...additionalData };
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Log the activity
      await logActivity({
        action: 'order_updated',
        entityType: 'order',
        entityId: orderId,
        details: {
          field: 'status',
          old_value: currentOrder?.status,
          new_value: newStatus,
          ...additionalData,
        },
      });

      // Update local state
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId
            ? { ...order, status: newStatus, ...additionalData }
            : order
        )
      );

      toast({
        title: "Status Updated",
        description: `Order status changed to ${newStatus}`,
      });

      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  // Quick action handlers
  const handleQuickMarkDispatched = async (orderId: string) => {
    await handleUpdateOrderStatus(orderId, 'dispatched', { dispatched_at: new Date().toISOString() });
  };

  const handleQuickGenerateLabel = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const courierName = order.courier && order.courier !== 'N/A' ? order.courier.toUpperCase() : 'COURIER';
    
    const labelHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Shipping Label - ${courierName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .label { border: 2px solid #000; padding: 20px; max-width: 600px; }
          .header { text-align: center; margin-bottom: 20px; font-size: 24px; font-weight: bold; }
          .section { margin-bottom: 15px; }
          .section strong { display: block; margin-bottom: 5px; }
          .divider { border-top: 1px dashed #000; margin: 15px 0; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">SHIPPING LABEL - ${courierName}</div>
          <div class="section">
            <strong>Order Number:</strong> ${order.orderNumber}
            <strong>Tracking ID:</strong> ${order.trackingId}
            <strong>Date:</strong> ${new Date().toLocaleDateString()}
          </div>
          <div class="section">
            <strong>Customer:</strong><br/>
            ${order.customer}<br/>
            ${order.phone}<br/>
            ${order.address}<br/>
            ${order.city}
          </div>
          <div class="section">
            <strong>Items:</strong><br/>
            ${order.items.map((item: any) => `${item.item_name} (x${item.quantity})`).join('<br/>')}
          </div>
          <div class="divider">
            <strong>Total Amount:</strong> PKR ${order.totalPrice.toFixed(2)}
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([labelHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${order.orderNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Label Downloaded",
      description: `Shipping label for order ${order.orderNumber} downloaded`,
    });
  };

  const handleQuickViewActivity = (order: any) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  const handleQuickViewDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsModalOpen(true);
  };

  // Handle filter presets
  const handlePresetSelect = (preset: any) => {
    if (!preset) {
      setActivePreset(null);
      resetFilters();
      return;
    }

    setActivePreset(preset.id);
    
    // Apply preset filters
    if (preset.filters.status) {
      updateFilter('status', preset.filters.status);
    }
    if (preset.filters.dateRange) {
      updateFilter('dateRange', preset.filters.dateRange);
    }
    if (preset.filters.minAmount) {
      updateFilter('amountMin', preset.filters.minAmount);
    }
  };

  // Jump to page handler
  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= totalPages) {
      setPage(pageNum - 1);
      setJumpToPage('');
    } else {
      toast({
        title: "Invalid page number",
        description: `Please enter a number between 1 and ${totalPages}`,
        variant: "destructive",
      });
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
    searchFields: ['orderNumber', 'customer', 'phone', 'shopifyOrderId', 'shopifyOrderNumber', 'trackingId', 'email', 'city'],
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
  let finalFilteredOrders = quickFilter === 'actionRequired' 
    ? filteredOrders.filter(order => order.status === 'pending' || order.verificationStatus === 'pending')
    : filteredOrders;

  // Apply sorting based on sortOrder
  finalFilteredOrders = [...finalFilteredOrders].sort((a, b) => {
    const dateA = new Date(a.createdAtISO || a.created_at).getTime();
    const dateB = new Date(b.createdAtISO || b.created_at).getTime();
    return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
  });

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalCount);
  const totalPages = Math.ceil(totalCount / pageSize);
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">Order Management</h1>
            <p className="text-muted-foreground mt-1">
              {totalCount > 0 ? `Showing ${start}–${end} of ${totalCount.toLocaleString()} orders` : 'Manage and track all your orders'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKPIPanel(!showKPIPanel)}
              className="gap-2"
            >
              {showKPIPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showKPIPanel ? 'Hide' : 'Show'} KPIs
            </Button>
            <Button variant="outline" onClick={fetchOrders} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <NewOrderDialog onOrderCreated={handleNewOrderCreated} />
            <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
            <BulkUploadDialog 
              open={showBulkUpload} 
              onOpenChange={setShowBulkUpload}
              onSuccess={handleNewOrderCreated}
            />
          </div>
        </div>

        {/* KPI Panel */}
        <OrderKPIPanel 
          orders={finalFilteredOrders.map(o => ({
            id: o.id,
            total_amount: o.totalPrice,
            city: o.city,
            courier: o.courier === 'N/A' ? null : o.courier,
            status: o.status,
            created_at: o.createdAtISO || o.date
          }))} 
          isVisible={showKPIPanel} 
        />

        {/* Filter Presets */}
        <FilterPresets
          activePreset={activePreset}
          onPresetSelect={handlePresetSelect}
        />

        {/* Bulk Operations */}
        <BulkOperationsPanel
          selectedCount={selectedOrders.length}
          onStatusChange={handleBulkStatusChange}
          onCourierAssign={handleBulkCourierAssign}
          onCourierUnassign={handleBulkCourierUnassign}
          onExport={handleExport}
          progress={progress}
          couriers={couriers}
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


      {/* Orders Table with Unified Filters */}
      <Card>
        {/* Unified Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-muted/30 border-b">
          {/* Left side - Search and Page Size */}
          <div className="flex flex-1 gap-3 flex-wrap items-center w-full sm:w-auto">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Rows:</Label>
              <Select value={String(pageSize)} onValueChange={(val) => handlePageSizeChange(Number(val))}>
                <SelectTrigger className="w-[90px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
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
            
            {/* Active filters badge */}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-9 px-3">
                {activeFiltersCount} filters active
              </Badge>
            )}
          </div>
          
          {/* Right side - Unified filters button */}
          <div className="flex gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter Orders</SheetTitle>
                  <SheetDescription>
                    Apply filters to refine your order view
                  </SheetDescription>
                </SheetHeader>
                
                <div className="space-y-6 py-6">
                  {/* Quick Filters Section */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Quick Filters</Label>
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
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select quick filter" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
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

                  {/* Status & Verification Filter */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Order Status</Label>
                    <Select 
                      value={combinedStatus} 
                      onValueChange={(value) => {
                        setCombinedStatus(value);
                        setQuickFilter(null);
                        
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
                          updateFilter('status', value);
                          updateCustomFilter('verificationStatus', 'all');
                        }
                      }}
                    >
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
                  
                  {/* Date Range */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Date Range</Label>
                    <DatePickerWithRange
                      date={filters.dateRange}
                      setDate={(date) => updateFilter('dateRange', date)}
                    />
                  </div>
                  
                  {/* Amount Range */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Amount Range (PKR)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm text-muted-foreground">Min Amount</Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={filters.amountMin || ''}
                          onChange={(e) => updateFilter('amountMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Max Amount</Label>
                        <Input
                          type="number"
                          placeholder="999999"
                          value={filters.amountMax || ''}
                          onChange={(e) => updateFilter('amountMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Courier */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Courier</Label>
                    <Select
                      value={filters.customValues?.courier || 'all'}
                      onValueChange={(value) => updateCustomFilter('courier', value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="All Couriers" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Couriers</SelectItem>
                        <SelectItem value="leopard">Leopard</SelectItem>
                        <SelectItem value="postex">PostEx</SelectItem>
                        <SelectItem value="tcs">TCS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Order Type */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Order Type</Label>
                    <Select
                      value={filters.customValues?.orderType || 'all'}
                      onValueChange={(value) => updateCustomFilter('orderType', value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                        <SelectItem value="Prepaid">Prepaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Sort Order */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Sort Order</Label>
                    <Select
                      value={sortOrder}
                      onValueChange={(value: 'latest' | 'oldest') => setSortOrder(value)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Sort order" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="latest">Latest to Oldest</SelectItem>
                        <SelectItem value="oldest">Oldest to Latest</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Saved Presets Section */}
                  {savedPresets.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <Label className="text-base font-semibold">Saved Presets</Label>
                      <div className="flex flex-wrap gap-2">
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
                    <div className="space-y-3 pt-4 border-t">
                      <Label className="text-base font-semibold">Save Current Filters</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Enter preset name..."
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
              </SheetContent>
            </Sheet>
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
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      <span className="text-sm text-muted-foreground">Loading orders...</span>
                    </div>
                  </TableCell>
                </TableRow> : finalFilteredOrders.length === 0 ? <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">No orders found</span>
                    </div>
                  </TableCell>
                </TableRow> : finalFilteredOrders.map(order => (
                  <Noop key={order.id}>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <Checkbox 
                        checked={selectedOrders.includes(order.id)} 
                        onCheckedChange={() => handleSelectOrder(order.id)} 
                      />
                    </TableCell>
                    
                    <TableCell className="font-mono text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span>{(order.orderNumber || order.shopify_order_id || order.id.slice(0, 8)).replace(/^SHOP-/, '')}</span>
                          </div>
                          {order.fraudIndicators?.isHighRisk && (
                            <Badge variant="destructive" className="gap-1 w-fit text-xs">
                              <Shield className="h-3 w-3" />
                              Risk: {order.fraudIndicators.riskScore}%
                            </Badge>
                          )}
                        </div>
                        <OrderAlertIndicators order={order} />
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm">{order.customer}</span>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm font-mono">{order.phone}</span>
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm font-semibold">{order.amount}</span>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {getStatusBadge(order.status, order.id)}
                        {order.status === 'dispatched' && order.courier && order.courier !== 'N/A' && (
                          <span className="text-xs text-muted-foreground">
                            Via {order.courier.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <InlineCourierAssign 
                        orderId={order.id}
                        currentCourier={order.courier}
                        trackingId={order.trackingId}
                        couriers={couriers}
                        orderDetails={{
                          orderNumber: order.orderNumber,
                          customer: order.customer,
                          phone: order.phone,
                          address: order.address,
                          city: order.city,
                          items: order.items,
                          totalPrice: order.totalPrice
                        }}
                        onAssigned={fetchOrders}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <QuickActionButtons 
                        orderId={order.id}
                        orderStatus={order.status}
                        onMarkDispatched={handleQuickMarkDispatched}
                        onGenerateLabel={handleQuickGenerateLabel}
                        onViewActivity={handleQuickViewActivity}
                      />
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
                       <TableCell colSpan={9} className="bg-muted/30 p-6">
                         <Tabs defaultValue="customer-details" className="w-full">
                           <TabsList className="grid w-full grid-cols-2">
                             <TabsTrigger value="customer-details">Customer Details</TabsTrigger>
                             <TabsTrigger value="order-details">Order Details</TabsTrigger>
                           </TabsList>
                           
                            <TabsContent value="customer-details" className="mt-4">
                              <Card className="border-border/50">
                                <CardContent className="p-5">
                                  <div className="flex items-center gap-2 mb-4">
                                    <User className="h-5 w-5 text-primary" />
                                    <h4 className="text-lg font-semibold">Customer Information</h4>
                                  </div>
                                  
                                  <div className="space-y-4">
                                    {/* Customer Name */}
                                    <div className="flex items-start gap-3">
                                      <User className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                      <div className="flex-1">
                                        <div className="text-xs text-muted-foreground mb-0.5">Full Name</div>
                                        <div className="font-medium">{order.customer || <span className="text-muted-foreground italic">Not Provided</span>}</div>
                                      </div>
                                    </div>
                                    
                                    {/* Customer Phone */}
                                    {order.phone && order.phone !== 'N/A' && (
                                      <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                        <Phone className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="text-xs text-muted-foreground mb-0.5">Phone Number</div>
                                          <div className="font-medium">{order.phone}</div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Customer Email */}
                                    {order.email && order.email !== 'N/A' && (
                                      <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                        <Mail className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="text-xs text-muted-foreground mb-0.5">Email Address</div>
                                          <div className="font-medium">{order.email}</div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Customer Address */}
                                    {order.address && order.address !== 'N/A' && (
                                      <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                        <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                        <div className="flex-1">
                                          <div className="text-xs text-muted-foreground mb-0.5">Delivery Address</div>
                                          <div className="font-medium">{order.address}</div>
                                          {order.city && order.city !== 'N/A' && (
                                            <div className="text-sm text-muted-foreground mt-1">{order.city}</div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </TabsContent>
                           
                            <TabsContent value="order-details" className="mt-4">
                              <div className="space-y-4">
                                {/* Order Summary Card */}
                                <Card className="border-border/50">
                                  <CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                      <Package className="h-5 w-5 text-primary" />
                                      <h4 className="text-lg font-semibold">Order Summary</h4>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      {/* Shopify Order ID */}
                                      {order.shopify_order_id && order.shopify_order_id !== 'N/A' && (
                                        <div className="flex items-start gap-3">
                                          <Package className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-0.5">Shopify Order ID</div>
                                            <div className="font-medium">{order.shopify_order_id}</div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Order Date */}
                                      {order.createdAtISO && (
                                        <div className={`flex items-start gap-3 ${order.shopify_order_id && order.shopify_order_id !== 'N/A' ? 'pt-3 border-t border-border/50' : ''}`}>
                                          <Calendar className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-0.5">Order Date</div>
                                            <div className="font-medium">{new Date(order.createdAtISO).toLocaleDateString()}</div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Order Type */}
                                      {order.orderType && order.orderType !== 'N/A' && (
                                        <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                          <ShoppingBag className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-0.5">Order Type</div>
                                            <div className="font-medium">{order.orderType}</div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Courier & Tracking ID */}
                                      <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                        <Truck className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                        <div className="flex-1 space-y-3">
                                          <div>
                                            <div className="text-xs text-muted-foreground mb-0.5">Courier</div>
                                            <div className="font-medium">
                                              {order.courier && order.courier !== 'N/A' ? (
                                                order.courier.toUpperCase()
                                              ) : (
                                                <span className="text-muted-foreground">Not assigned</span>
                                              )}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-muted-foreground mb-0.5">Tracking ID</div>
                                            {order.trackingId && order.trackingId !== 'N/A' ? (
                                                <div className="flex items-center gap-2">
                                                  <code className="font-mono text-sm font-medium bg-muted px-2 py-1 rounded">{order.trackingId}</code>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0"
                                                    onClick={async () => {
                                                      await navigator.clipboard.writeText(order.trackingId);
                                                      toast({ description: "Tracking ID copied to clipboard" });
                                                    }}
                                                  >
                                                    <Copy className="h-3 w-3" />
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={async () => {
                                                      const toastId = toast({ description: "Downloading label..." });
                                                      
                                                      try {
                                                        // Fetch dispatch record
                                                        const { data: dispatch, error: dispatchError } = await supabase
                                                          .from('dispatches')
                                                          .select('label_url, label_data, label_format, courier, tracking_id, id')
                                                          .eq('order_id', order.id)
                                                          .order('created_at', { ascending: false })
                                                          .limit(1)
                                                          .single();
                                                        
                                                        if (dispatchError || !dispatch) {
                                                          console.error('Dispatch fetch error:', dispatchError);
                                                          toast({
                                                            description: "No dispatch record found",
                                                            variant: "destructive"
                                                          });
                                                          return;
                                                        }
                                                        
                                                        console.log('Dispatch record:', dispatch);
                                                        
                                                        // If label exists, download it
                                                        if (dispatch.label_url || dispatch.label_data) {
                                                          await downloadCourierLabel(
                                                            dispatch.label_data,
                                                            dispatch.label_url,
                                                            dispatch.label_format || 'pdf',
                                                            order.trackingId
                                                          );
                                                          toast({ description: "Label downloaded successfully" });
                                                        } else {
                                                          // Label missing - attempt to fetch it for Postex
                                                          if (dispatch.courier?.toUpperCase() === 'POSTEX' && dispatch.tracking_id) {
                                                            console.log('Attempting to fetch Postex label for:', dispatch.tracking_id);
                                                            toast({ description: "Fetching label from Postex..." });
                                                            
                                                            // Get Postex API key from settings
                                                            const { data: apiSettings, error: keyError } = await supabase
                                                              .from('api_settings')
                                                              .select('setting_value')
                                                              .eq('setting_key', 'POSTEX_API_KEY')
                                                              .single();
                                                            
                                                            if (keyError || !apiSettings?.setting_value) {
                                                              console.error('API key fetch error:', keyError);
                                                              toast({
                                                                description: "Postex API key not configured in settings",
                                                                variant: "destructive"
                                                              });
                                                              return;
                                                            }
                                                            
                                                            console.log('Fetching label from Postex API...');
                                                            
                                                            // Fetch label from Postex
                                                            const labelResponse = await fetch('https://api.postex.pk/services/integration/api/order/v1/get-label', {
                                                              method: 'POST',
                                                              headers: {
                                                                'token': apiSettings.setting_value,
                                                                'Content-Type': 'application/json',
                                                              },
                                                              body: JSON.stringify({ trackingNumber: dispatch.tracking_id })
                                                            });
                                                            
                                                            console.log('Postex API response status:', labelResponse.status);
                                                            
                                                            if (!labelResponse.ok) {
                                                              const errorText = await labelResponse.text();
                                                              console.error('Postex API error response:', errorText);
                                                              
                                                              // Try to parse error message
                                                              let errorMessage = 'Failed to fetch label from Postex';
                                                              try {
                                                                const errorJson = JSON.parse(errorText);
                                                                errorMessage = errorJson.message || errorJson.statusMessage || errorMessage;
                                                              } catch {}
                                                              
                                                              toast({
                                                                description: `${errorMessage} (Status: ${labelResponse.status}). The label might not be ready yet - wait a few minutes and try again.`,
                                                                variant: "destructive",
                                                                duration: 6000
                                                              });
                                                              return;
                                                            }
                                                            
                                                            const labelData = await labelResponse.json();
                                                            console.log('Postex label response:', labelData);
                                                            
                                                            if (labelData.dist?.pdfData || labelData.dist?.labelUrl) {
                                                              // Update dispatch with label data
                                                              const { error: updateError } = await supabase
                                                                .from('dispatches')
                                                                .update({
                                                                  label_data: labelData.dist.pdfData,
                                                                  label_url: labelData.dist.labelUrl,
                                                                  label_format: 'pdf'
                                                                })
                                                                .eq('id', dispatch.id);
                                                              
                                                              if (updateError) {
                                                                console.error('Dispatch update error:', updateError);
                                                              }
                                                              
                                                              // Download the label
                                                              await downloadCourierLabel(
                                                                labelData.dist.pdfData,
                                                                labelData.dist.labelUrl,
                                                                'pdf',
                                                                dispatch.tracking_id
                                                              );
                                                              toast({ description: "Label downloaded successfully" });
                                                            } else {
                                                              console.warn('No label data in response:', labelData);
                                                              toast({
                                                                description: "Label not ready yet. Postex labels are available after the order is processed (usually within a few minutes). Please try again shortly.",
                                                                variant: "destructive",
                                                                duration: 6000
                                                              });
                                                            }
                                                          } else {
                                                            toast({
                                                              description: "No label available for this order",
                                                              variant: "destructive"
                                                            });
                                                          }
                                                        }
                                                      } catch (error: any) {
                                                        console.error('Label download error:', error);
                                                        toast({
                                                          description: error.message || "Failed to download label. Check console for details.",
                                                          variant: "destructive",
                                                          duration: 5000
                                                        });
                                                      }
                                                    }}
                                                  >
                                                    <Download className="h-3 w-3 mr-1" />
                                                    Label
                                                  </Button>
                                                  <AWBDownloadButton 
                                                    orderId={order.id} 
                                                    courierCode={order.courier}
                                                  />
                                                </div>
                                              ) : (
                                                <span className="text-muted-foreground">Not assigned</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      
                                      {/* Dispatched At */}
                                      {order.dispatchedAt && order.dispatchedAt !== 'N/A' && (
                                        <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                          <Clock className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-0.5">Dispatched At</div>
                                            <div className="font-medium">{order.dispatchedAt}</div>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {/* Delivered At */}
                                      {order.deliveredAt && order.deliveredAt !== 'N/A' && (
                                        <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                                          <Clock className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                                          <div className="flex-1">
                                            <div className="text-xs text-muted-foreground mb-0.5">Delivered At</div>
                                            <div className="font-medium">{order.deliveredAt}</div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Manual Verification Buttons */}
                                    {(order.status === 'pending_confirmation' || order.status === 'pending_address') && (
                                      <div className="mt-4 flex flex-col gap-2">
                                        {order.status === 'pending_confirmation' && (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => handleUpdateOrderStatus(order.id, 'booked', { 
                                              verified_at: new Date().toISOString(),
                                              verified_by: user?.id
                                            })}
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
                                            onClick={() => handleUpdateOrderStatus(order.id, 'booked', {
                                              verification_status: 'verified',
                                              verified_at: new Date().toISOString(),
                                              verified_by: user?.id
                                            })}
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
                                        className="mt-3 w-full"
                                      >
                                        <Truck className="h-4 w-4 mr-2" />
                                        Quick Dispatch
                                      </Button>
                                    )}
                                  </CardContent>
                                </Card>
                                
                                {/* Items Ordered Card */}
                                <Card className="border-border/50">
                                  <CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                      <Package className="h-5 w-5 text-primary" />
                                      <h4 className="text-lg font-semibold">Items Ordered</h4>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {(() => {
                                        // Normalize items from either order_items table or inline JSON on orders
                                        const rawItems = order.items || [];
                                        if (!Array.isArray(rawItems) || rawItems.length === 0) {
                                          return (
                                            <p className="text-sm text-muted-foreground italic">No items available</p>
                                          );
                                        }

                                        type NormItem = { name: string; quantity: number; price: number };
                                        const normalized: NormItem[] = rawItems.map((it: any) => ({
                                          name: it.item_name || it.name || it.title || 'Item',
                                          quantity: Number(it.quantity ?? 1) || 1,
                                          price: Number(it.price ?? it.unit_price ?? 0) || 0,
                                        }));

                                        // Merge duplicates by name
                                        const map = new Map<string, NormItem & { total: number }>();
                                        normalized.forEach((i) => {
                                          const key = i.name.trim();
                                          if (map.has(key)) {
                                            const cur = map.get(key)!;
                                            cur.quantity += i.quantity;
                                            cur.total += i.price * i.quantity;
                                          } else {
                                            map.set(key, { ...i, total: i.price * i.quantity });
                                          }
                                        });

                                        const merged = Array.from(map.values());

                                        return merged.map((item, idx) => (
                                          <div key={idx} className="bg-muted/30 rounded-xl p-3.5 hover:bg-muted/40 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="flex-1">
                                                <div className="font-semibold text-foreground">{item.name}</div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                  {item.quantity} × PKR {item.price.toLocaleString()}
                                                </div>
                                              </div>
                                              <div className="font-semibold text-foreground">PKR {item.total.toLocaleString()}</div>
                                            </div>
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-border">
                                      <div className="flex items-center justify-between">
                                        <span className="text-lg font-semibold">Total Amount</span>
                                        <span className="text-2xl font-bold text-primary">
                                          {order.amount}
                                        </span>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                                
                                {/* Internal Notes Card */}
                                <Card className="border-border/50">
                                  <CardContent className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                      <FileText className="h-5 w-5 text-primary" />
                                      <h4 className="text-lg font-semibold">Internal Notes</h4>
                                    </div>
                                    <TagsNotes
                                      itemId={order.id}
                                      orderNotes={order.orderNotes}
                                      notes={order.userComments}
                                      onAddNote={(note) => handleAddNote(order.id, note)}
                                      onDeleteNote={(noteId) => handleDeleteNote(order.id, noteId)}
                                    />
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>
                         </Tabs>
                      </TableCell>
                    </TableRow>}
                 </Noop>
                ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Enhanced Pagination */}
      {totalCount > pageSize && (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="gap-2"
                >
                  <ChevronDown className="h-4 w-4 rotate-90" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Page <span className="font-semibold text-foreground">{page + 1}</span> of{' '}
                    <span className="font-semibold text-foreground">{totalPages}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({totalCount.toLocaleString()} total)
                  </span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * pageSize >= totalCount}
                  className="gap-2"
                >
                  Next
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </Button>
              </div>

              {/* Jump to Page */}
              <div className="flex items-center gap-2">
                <Label htmlFor="jump-page" className="text-sm text-muted-foreground whitespace-nowrap">
                  Jump to:
                </Label>
                <Input
                  id="jump-page"
                  type="number"
                  min="1"
                  max={totalPages}
                  value={jumpToPage}
                  onChange={(e) => setJumpToPage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleJumpToPage();
                    }
                  }}
                  placeholder="Page"
                  className="w-20 h-9"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleJumpToPage}
                  disabled={!jumpToPage}
                >
                  Go
                </Button>
              </div>

              {/* Keyboard shortcuts hint */}
              <div className="text-xs text-muted-foreground hidden lg:block">
                Use ← → arrow keys to navigate
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* New Dispatch Dialog */}
      <NewDispatchDialog 
        open={isDispatchDialogOpen}
        onOpenChange={setIsDispatchDialogOpen}
        preSelectedOrderId={dispatchOrderId}
      />

      <BulkUploadDialog 
        open={showBulkUpload} 
        onOpenChange={setShowBulkUpload}
      />

      {activityLogOrderId && (
        <OrderActivityLog
          orderId={activityLogOrderId}
          open={!!activityLogOrderId}
          onOpenChange={(open) => !open && setActivityLogOrderId(null)}
        />
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal 
        order={selectedOrder ? {
          id: selectedOrder.id,
          order_number: selectedOrder.orderNumber,
          customer_name: selectedOrder.customer || '',
          customer_phone: selectedOrder.phone || '',
          customer_address: selectedOrder.address || '',
          customer_email: selectedOrder.email !== 'N/A' ? selectedOrder.email : '',
          city: selectedOrder.city || '',
          total_amount: selectedOrder.totalPrice || 0,
          status: selectedOrder.status || 'pending',
          courier: selectedOrder.courier !== 'N/A' ? selectedOrder.courier : null,
          items: selectedOrder.items || [],
          created_at: selectedOrder.createdAtISO || selectedOrder.date,
          customer_id: selectedOrder.customerId !== 'N/A' ? selectedOrder.customerId : null
        } : null}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
      />
    </div>;
};
export default OrderDashboard;