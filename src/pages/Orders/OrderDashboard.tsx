import React, { useState, useEffect } from 'react';
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
import { Search, Upload, Plus, Filter, ChevronDown, ChevronUp, Package, Edit, Trash2, Send, Download, UserPlus, CheckCircle, Truck } from 'lucide-react';
import TagsNotes from '@/components/TagsNotes';
import NewOrderDialog from '@/components/NewOrderDialog';
import NewDispatchDialog from '@/components/dispatch/NewDispatchDialog';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/utils/activityLogger';
import { useAdvancedFilters } from '@/hooks/useAdvancedFilters';
import { AdvancedFilterPanel } from '@/components/AdvancedFilterPanel';
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkUpdateOrderStatus, bulkUpdateOrderCourier, bulkAssignOrders, exportToCSV } from '@/utils/bulkOperations';

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

  const { user } = useAuth();
  const { progress, executeBulkOperation } = useBulkOperations();
  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders...');
      const {
        data,
        error
      } = await supabase.from('orders').select(`
          *,
          order_items (
            item_name,
            quantity,
            price
          ),
          assigned_to_profile:profiles!orders_assigned_to_fkey(
            id,
            full_name,
            email
          )
        `).order('created_at', {
        ascending: false
      });
      console.log('Supabase response:', {
        data,
        error
      });
      if (error) {
        console.error('Error fetching orders:', error);
        // Still try to show any data we got
      }

      // Process data even if empty array to show proper state
      console.log('Processing orders:', data?.length || 0);
      const formattedOrders = (data || []).map(order => {
        // Parse notes if they're stored as JSON string
        let parsedNotes = [];
        try {
          if (order.notes && typeof order.notes === 'string') {
            parsedNotes = JSON.parse(order.notes);
          } else if (Array.isArray(order.notes)) {
            parsedNotes = order.notes;
          }
        } catch (e) {
          console.error('Error parsing notes:', e);
          parsedNotes = [];
        }
        
        return {
          id: order.id,
          customerId: order.customer_id || 'N/A',
          trackingId: order.tracking_id || 'N/A',
          customer: order.customer_name,
          email: order.customer_email || 'N/A',
          phone: order.customer_phone,
          courier: order.courier || 'N/A',
          status: order.status,
          amount: `PKR ${order.total_amount?.toLocaleString() || '0'}`,
          date: new Date(order.created_at || '').toLocaleDateString(),
          address: order.customer_address,
          gptScore: order.gpt_score || 0,
          totalPrice: order.total_amount || 0,
          orderType: order.order_type || 'COD',
          city: order.city,
          items: order.order_items || [],
          assignedTo: order.assigned_to,
          assignedToProfile: order.assigned_to_profile,
          dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : 'N/A',
          deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
          orderNotes: typeof order.notes === 'string' && order.notes ? order.notes : 'No notes',
          tags: [],
          notes: parsedNotes
        };
      });
      setOrders(formattedOrders);

      // Calculate summary data
      setSummaryData({
        totalOrders: formattedOrders.length,
        booked: formattedOrders.filter(o => o.status === 'booked').length,
        dispatched: formattedOrders.filter(o => o.status === 'dispatched').length,
        delivered: formattedOrders.filter(o => o.status === 'delivered').length,
        cancelled: formattedOrders.filter(o => o.status === 'cancelled').length,
        returns: formattedOrders.filter(o => o.status === 'returned').length
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchOrders();
  }, []);

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
  const getStatusBadge = (status: string) => {
    const statusMap = {
      delivered: {
        color: 'bg-green-100 text-green-800',
        label: 'Delivered'
      },
      dispatched: {
        color: 'bg-blue-100 text-blue-800',
        label: 'Dispatched'
      },
      booked: {
        color: 'bg-orange-100 text-orange-800',
        label: 'Booked'
      },
      cancelled: {
        color: 'bg-red-100 text-red-800',
        label: 'Cancelled'
      },
      returned: {
        color: 'bg-gray-100 text-gray-800',
        label: 'Returned'
      }
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.booked;
    return <Badge className={statusInfo.color}>
        {statusInfo.label}
      </Badge>;
  };
  const summaryCards = [{
    title: 'Total Orders',
    value: summaryData.totalOrders.toLocaleString(),
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
      // Get current order notes
      const order = orders.find(o => o.id === orderId);
      const currentNotes = order?.notes || [];
      
      const newNote = {
        id: `note_${Date.now()}`,
        text: note,
        addedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
        addedAt: new Date().toISOString(),
        canDelete: true
      };
      
      const updatedNotes = [...currentNotes, newNote];
      
      // Save to Supabase
      const { error } = await supabase
        .from('orders')
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? {
        ...o,
        notes: updatedNotes
      } : o));
      
      // Log activity
      await logActivity({
        action: 'order_updated',
        entityType: 'order',
        entityId: orderId,
        details: { noteAdded: note },
      });
    } catch (error) {
      console.error('Error adding note:', error);
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
      // Get current order notes
      const order = orders.find(o => o.id === orderId);
      const updatedNotes = order?.notes.filter(n => n.id !== noteId) || [];
      
      // Save to Supabase
      const { error } = await supabase
        .from('orders')
        .update({ notes: JSON.stringify(updatedNotes) })
        .eq('id', orderId);
      
      if (error) throw error;
      
      // Update local state
      setOrders(prevOrders => prevOrders.map(o => o.id === orderId ? {
        ...o,
        notes: updatedNotes
      } : o));
    } catch (error) {
      console.error('Error deleting note:', error);
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
    searchFields: ['trackingId', 'customer', 'id', 'email', 'phone', 'city'],
    statusField: 'status',
    dateField: 'date',
    amountField: 'totalPrice',
    customFilters: {
      courier: (order, value) => order.courier?.toLowerCase() === value.toLowerCase(),
      orderType: (order, value) => order.orderType === value,
    },
  });
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600 mt-1">Manage and track all your orders</p>
          </div>
          <div className="flex items-center gap-3">
            <NewOrderDialog onOrderCreated={fetchOrders} />
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

      {/* Advanced Filters */}
      <AdvancedFilterPanel
        filters={filters}
        onFilterChange={updateFilter}
        onCustomFilterChange={updateCustomFilter}
        onReset={resetFilters}
        activeFiltersCount={activeFiltersCount}
        statusOptions={[
          { value: 'booked', label: 'Booked' },
          { value: 'dispatched', label: 'Dispatched' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'returned', label: 'Returned' },
        ]}
        showAmountFilter={true}
        showDateFilter={true}
        customFilters={[
          {
            key: 'courier',
            label: 'Courier',
            options: [
              { value: 'leopard', label: 'Leopard' },
              { value: 'postex', label: 'PostEx' },
              { value: 'tcs', label: 'TCS' },
            ],
          },
          {
            key: 'orderType',
            label: 'Order Type',
            options: [
              { value: 'standard', label: 'Standard' },
              { value: 'COD', label: 'COD' },
              { value: 'exchange', label: 'Exchange' },
            ],
          },
        ]}
        savedPresets={savedPresets}
        onSavePreset={savePreset}
        onLoadPreset={loadPreset}
        onDeletePreset={deletePreset}
      />

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orders ({filteredOrders.length})</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0} onCheckedChange={handleSelectAllCurrentPage} />
                <span className="text-sm text-gray-600">Select All (Current Page)</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={selectAllPages} onCheckedChange={handleSelectAllPages} />
                <span className="text-sm text-gray-600">Select All Pages</span>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Order Status</TableHead>
                <TableHead>Assigned Courier</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Expand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading orders...</TableCell>
                </TableRow> : filteredOrders.length === 0 ? <TableRow>
                  <TableCell colSpan={8} className="text-center">No orders found</TableCell>
                </TableRow> : filteredOrders.map(order => (
                  <React.Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox checked={selectedOrders.includes(order.id)} onCheckedChange={() => handleSelectOrder(order.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{order.customerId}</TableCell>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.trackingId}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>{order.courier}</TableCell>
                    <TableCell>
                      <Select 
                        value={order.assignedTo || "unassigned"} 
                        onValueChange={(value) => handleAssignStaff(order.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Assign Staff" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {staffUsers.map((staff) => (
                            <SelectItem key={staff.id} value={staff.id}>
                              {staff.full_name} ({staff.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => toggleExpanded(order.id)}>
                        {expandedRows.includes(order.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(order.id) && <TableRow>
                       <TableCell colSpan={8} className="bg-gray-50 p-6">
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
                      notes={order.notes}
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
      
      {/* New Dispatch Dialog */}
      <NewDispatchDialog 
        open={isDispatchDialogOpen}
        onOpenChange={setIsDispatchDialogOpen}
        preSelectedOrderId={dispatchOrderId}
      />
    </div>;
};
export default OrderDashboard;