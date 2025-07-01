
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Upload, Plus, Filter, Download, ChevronDown, ChevronUp, Package, Send, Loader2 } from 'lucide-react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { orderService, Order } from '@/services/orderService';
import { userService } from '@/services/userService';
import { activityLogService } from '@/services/activityLogService';
import { useToast } from '@/hooks/use-toast';

const OrderDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch orders with filters
  const {
    data: orders = [],
    isLoading: ordersLoading,
    refetch: refetchOrders
  } = useSupabaseQuery(
    ['orders', statusFilter, courierFilter, searchTerm],
    () => orderService.getOrders({
      status: statusFilter,
      courier: courierFilter,
      search: searchTerm,
      limit: 100
    })
  );

  // Fetch order statistics
  const { data: stats } = useSupabaseQuery(
    ['order-stats'],
    () => orderService.getOrderStats()
  );

  // Fetch current user
  const { data: currentUser } = useSupabaseQuery(
    ['current-user'],
    () => userService.getCurrentUser()
  );

  // Bulk update mutation
  const bulkUpdateMutation = useSupabaseMutation(
    ({ orderIds, updates }: { orderIds: string[], updates: Partial<Order> }) =>
      orderService.bulkUpdateOrders(orderIds, updates),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Orders updated successfully',
        });
        setSelectedOrders([]);
        refetchOrders();
      },
      invalidateKeys: [['orders'], ['order-stats']]
    }
  );

  // Add tag mutation
  const addTagMutation = useSupabaseMutation(
    ({ orderId, tag }: { orderId: string, tag: string }) =>
      orderService.addTag(orderId, tag, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Tag added successfully',
        });
        refetchOrders();
      },
      invalidateKeys: [['orders']]
    }
  );

  const getStatusBadge = (status: string) => {
    const statusMap = {
      delivered: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Delivered' },
      dispatched: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Dispatched' },
      booked: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Booked' },
      cancelled: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Cancelled' },
      returned: { color: 'bg-gray-50 text-gray-700 border-gray-200', label: 'Returned' },
      pending: { color: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Pending' },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    
    return (
      <Badge className={`${statusInfo.color} border font-medium`}>
        {statusInfo.label}
      </Badge>
    );
  };

  const summaryCards = [
    { title: 'Total Orders', value: stats?.total || 0, color: 'bg-slate-50 border-slate-200' },
    { title: 'Booked', value: stats?.booked || 0, color: 'bg-amber-50 border-amber-200' },
    { title: 'Dispatched', value: stats?.dispatched || 0, color: 'bg-blue-50 border-blue-200' },
    { title: 'Delivered', value: stats?.delivered || 0, color: 'bg-emerald-50 border-emerald-200' },
    { title: 'Cancelled', value: stats?.cancelled || 0, color: 'bg-red-50 border-red-200' },
    { title: 'Returns', value: stats?.returned || 0, color: 'bg-gray-50 border-gray-200' },
  ];

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAllCurrentPage = () => {
    setSelectedOrders(
      selectedOrders.length === orders.length 
        ? [] 
        : orders.map(order => order.id)
    );
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
    setExpandedRows(prev => 
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleBulkAction = (action: string) => {
    if (selectedOrders.length === 0) return;

    let updates: Partial<Order> = {};
    
    switch (action) {
      case 'dispatch':
        updates = { status: 'dispatched', dispatched_at: new Date().toISOString() };
        break;
      case 'deliver':
        updates = { status: 'delivered', delivered_at: new Date().toISOString() };
        break;
      case 'cancel':
        updates = { status: 'cancelled' };
        break;
      default:
        return;
    }

    bulkUpdateMutation.mutate({ orderIds: selectedOrders, updates });

    // Log activity
    if (currentUser) {
      selectedOrders.forEach(orderId => {
        activityLogService.logActivity(
          currentUser.id,
          `bulk_${action}`,
          'order',
          orderId,
          { action, count: selectedOrders.length }
        );
      });
    }
  };

  const handleAddTag = (orderId: string, tag: string) => {
    if (!tag.trim()) return;
    addTagMutation.mutate({ orderId, tag: tag.trim() });
  };

  const handleAddNote = (orderId: string, note: string) => {
    if (!note.trim()) return;
    // For now, we'll add notes as a special tag prefixed with "Note:"
    addTagMutation.mutate({ orderId, tag: `Note: ${note.trim()}` });
  };

  if (ordersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Order Management</h1>
            <p className="text-slate-600 mt-1">Manage and track all your orders</p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Upload
            </Button>
          </div>
        </div>

        {/* Bulk Actions Section */}
        {selectedOrders.length > 0 && (
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => handleBulkAction('dispatch')}
                    disabled={bulkUpdateMutation.isPending}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Dispatch
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => handleBulkAction('deliver')}
                    disabled={bulkUpdateMutation.isPending}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Deliver
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    disabled={bulkUpdateMutation.isPending}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryCards.map((card, index) => (
          <Card key={index} className={`${card.color} border shadow-sm hover:shadow-md transition-shadow`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{card.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-white">
          <CardTitle className="flex items-center justify-between">
            <span className="text-slate-900">Orders ({orders.length})</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onCheckedChange={handleSelectAllCurrentPage}
                />
                <span className="text-sm text-slate-600">Select All (Current Page)</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAllPages}
                  onCheckedChange={handleSelectAllPages}
                />
                <span className="text-sm text-slate-600">Select All Pages</span>
              </div>
            </div>
          </CardTitle>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Filter by Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                <SelectItem value="leopard">Leopard</SelectItem>
                <SelectItem value="postex">PostEx</SelectItem>
                <SelectItem value="tcs">TCS</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Select</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <React.Fragment key={order.id}>
                    <TableRow className="hover:bg-slate-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.includes(order.id)}
                          onCheckedChange={() => handleSelectOrder(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-slate-700">{order.tracking_id || 'N/A'}</TableCell>
                      <TableCell className="text-slate-700">{order.customer?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-slate-700">{order.customer?.email || 'N/A'}</div>
                          <div className="text-slate-500">{order.customer?.phone || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-300 text-slate-700">
                          {order.courier.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="font-medium text-slate-900">PKR {order.price.toLocaleString()}</TableCell>
                      <TableCell className="text-slate-600">{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50">
                            View
                          </Button>
                          <Button variant="outline" size="sm" className="border-slate-300 hover:bg-slate-50">
                            Track
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleExpanded(order.id)}
                          className="border-slate-300 hover:bg-slate-50"
                        >
                          {expandedRows.includes(order.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.includes(order.id) && (
                      <TableRow>
                        <TableCell colSpan={11} className="bg-slate-50 p-6">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                              <div>
                                <h4 className="font-semibold mb-2 text-slate-900">Customer Address</h4>
                                <p className="text-sm text-slate-600">{order.shipping_address}</p>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-slate-900">Order Details</h4>
                                <div className="space-y-1 text-sm">
                                  <p><span className="font-medium text-slate-700">GPT Score:</span> {order.gpt_score}%</p>
                                  <p><span className="font-medium text-slate-700">Order Type:</span> {order.order_type}</p>
                                  <p><span className="font-medium text-slate-700">City:</span> {order.city}</p>
                                  {order.assigned_user && (
                                    <p><span className="font-medium text-slate-700">Assigned to:</span> {order.assigned_user.name}</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-slate-900">Items</h4>
                                <div className="space-y-1">
                                  {order.order_items?.map((item, index) => (
                                    <div key={index} className="text-sm">
                                      <span className="font-medium text-slate-700">{item.item_name}</span>
                                      <span className="text-slate-500 ml-2">x{item.quantity} - PKR {item.price.toLocaleString()}</span>
                                    </div>
                                  )) || <p className="text-sm text-slate-500">No items found</p>}
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-4 text-slate-900">Tags & Notes</h4>
                              <div className="space-y-4">
                                {order.tags && order.tags.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {order.tags.map((tag, index) => (
                                      <Badge key={index} variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500">No tags or notes</p>
                                )}
                                
                                <div className="flex gap-2">
                                  <Input
                                    placeholder="Add a tag or note..."
                                    className="flex-1 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        const input = e.target as HTMLInputElement;
                                        handleAddTag(order.id, input.value);
                                        input.value = '';
                                      }
                                    }}
                                  />
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    className="border-slate-300 hover:bg-slate-50"
                                    onClick={(e) => {
                                      const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                                      if (input.value.trim()) {
                                        handleAddTag(order.id, input.value);
                                        input.value = '';
                                      }
                                    }}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDashboard;
