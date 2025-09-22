
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Search, Upload, Plus, Filter, Download, ChevronDown, ChevronUp, Package, Send, Edit, Trash2 } from 'lucide-react';
import TagsNotes from '@/components/TagsNotes';
import NewOrderDialog from '@/components/NewOrderDialog';
import { useAuth } from '@/contexts/AuthContext';

const OrderDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [editForm, setEditForm] = useState({ email: '', address: '' });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState({
    totalOrders: 0,
    booked: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    returns: 0
  });
  const fetchOrders = async () => {
    setLoading(true);
    try {
      console.log('Fetching orders...');
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            item_name,
            quantity,
            price
          )
        `)
        .order('created_at', { ascending: false });

      console.log('Supabase response:', { data, error });

      if (error) {
        console.error('Error fetching orders:', error);
        // Still try to show any data we got
      }
      
      // Process data even if empty array to show proper state
      console.log('Processing orders:', data?.length || 0);
      const formattedOrders = (data || []).map(order => ({
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
          dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : 'N/A',
          deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
          orderNotes: order.notes || 'No notes',
          tags: [],
          notes: []
        }));

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

  const { user } = useAuth();

  const getStatusBadge = (status: string) => {
    const statusMap = {
      delivered: { color: 'bg-green-100 text-green-800', label: 'Delivered' },
      dispatched: { color: 'bg-blue-100 text-blue-800', label: 'Dispatched' },
      booked: { color: 'bg-orange-100 text-orange-800', label: 'Booked' },
      cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      returned: { color: 'bg-gray-100 text-gray-800', label: 'Returned' },
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.booked;
    
    return (
      <Badge className={statusInfo.color}>
        {statusInfo.label}
      </Badge>
    );
  };

  const summaryCards = [
    { title: 'Total Orders', value: summaryData.totalOrders.toLocaleString(), color: 'bg-blue-500' },
    { title: 'Booked', value: summaryData.booked.toLocaleString(), color: 'bg-orange-500' },
    { title: 'Dispatched', value: summaryData.dispatched.toLocaleString(), color: 'bg-purple-500' },
    { title: 'Delivered', value: summaryData.delivered.toLocaleString(), color: 'bg-green-500' },
    { title: 'Cancelled', value: summaryData.cancelled.toLocaleString(), color: 'bg-red-500' },
    { title: 'Returns', value: summaryData.returns.toLocaleString(), color: 'bg-gray-500' },
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
    // Bulk action implementation would go here
  };

  const handleAddTag = (orderId: string, tag: string) => {
    // Add tag to order implementation
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              tags: [
                ...order.tags,
                {
                  id: `tag_${Date.now()}`,
                  text: tag,
                  addedBy: user?.name || 'Current User',
                  addedAt: new Date().toLocaleString(),
                  canDelete: true
                }
              ]
            }
          : order
      )
    );
  };

  const handleAddNote = (orderId: string, note: string) => {
    // Add note to order implementation
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              notes: [
                ...order.notes,
                {
                  id: `note_${Date.now()}`,
                  text: note,
                  addedBy: user?.name || 'Current User',
                  addedAt: new Date().toLocaleString(),
                  canDelete: true
                }
              ]
            }
          : order
      )
    );
  };

  const handleDeleteTag = (orderId: string, tagId: string) => {
    // Delete tag from order implementation
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              tags: order.tags.filter(tag => tag.id !== tagId)
            }
          : order
      )
    );
  };

  const handleDeleteNote = (orderId: string, noteId: string) => {
    // Delete note from order implementation
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId 
          ? {
              ...order,
              notes: order.notes.filter(note => note.id !== noteId)
            }
          : order
      )
    );
  };

  const handleEditOrder = (order: any) => {
    setEditingOrder(order);
    setEditForm({ email: order.email, address: order.address });
  };

  const handleSaveEdit = () => {
    if (!editingOrder) return;
    
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === editingOrder.id 
          ? { ...order, email: editForm.email, address: editForm.address }
          : order
      )
    );
    setEditingOrder(null);
    setEditForm({ email: '', address: '' });
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    setSelectedOrders(prev => prev.filter(id => id !== orderId));
    setExpandedRows(prev => prev.filter(id => id !== orderId));
  };

  // Filter orders based on search and filters
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesCourier = courierFilter === 'all' || order.courier.toLowerCase() === courierFilter;
    
    return matchesSearch && matchesStatus && matchesCourier;
  });

  return (
    <div className="p-6 space-y-6">
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

        {/* Bulk Actions Section */}
        {selectedOrders.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  <span className="font-medium text-orange-800">
                    {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => handleBulkAction('recommender')}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Recommender
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => handleBulkAction('leopard')}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Leopard
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={() => handleBulkAction('postex')}
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    PostEx
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
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
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders Table with Integrated Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Orders ({filteredOrders.length})</span>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={handleSelectAllCurrentPage}
                />
                <span className="text-sm text-gray-600">Select All (Current Page)</span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectAllPages}
                  onCheckedChange={handleSelectAllPages}
                />
                <span className="text-sm text-gray-600">Select All Pages</span>
              </div>
            </div>
          </CardTitle>
          
          {/* Integrated Filters Section */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="dispatched">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Courier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                <SelectItem value="leopard">Leopard</SelectItem>
                <SelectItem value="postex">PostEx</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
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
                <TableHead>Expand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading orders...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">No orders found</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => handleSelectOrder(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.customerId}</TableCell>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.trackingId}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>{order.courier}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(order.id)}
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
                      <TableCell colSpan={7} className="bg-gray-50 p-6">
                        <Tabs defaultValue="additional-details" className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="additional-details">Additional Details</TabsTrigger>
                            <TabsTrigger value="second-tab">Second Tab</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="additional-details" className="mt-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold mb-3">Customer Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">Customer Name:</span> {order.customer}</p>
                                    <p><span className="font-medium">Customer Phone:</span> {order.phone}</p>
                                    <p><span className="font-medium">Customer Email:</span> {order.email}</p>
                                    <p><span className="font-medium">Customer Address:</span> {order.address}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold mb-3">Order Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">Customer Order Total Worth:</span> {order.amount}</p>
                                    <p><span className="font-medium">Assigned Courier:</span> {order.courier}</p>
                                    <p><span className="font-medium">Dispatched At:</span> {order.dispatchedAt}</p>
                                    <p><span className="font-medium">Delivered At:</span> {order.deliveredAt}</p>
                                    <p><span className="font-medium">Order Type:</span> {order.orderType}</p>
                                    <p><span className="font-medium">City:</span> {order.city}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold mb-3">Order Items</h4>
                                  <div className="space-y-2">
                                    {order.items.length > 0 ? order.items.map((item, index) => (
                                      <div key={index} className="text-sm border-b pb-2">
                                        <p><span className="font-medium">Item:</span> {item.item_name}</p>
                                        <p><span className="font-medium">Quantity:</span> {item.quantity}</p>
                                        <p><span className="font-medium">Price:</span> PKR {item.price}</p>
                                      </div>
                                    )) : (
                                      <p className="text-sm text-gray-500">No items available</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="font-semibold mb-3">Internal Notes</h4>
                                  <div className="text-sm">
                                    <p className="bg-gray-100 p-3 rounded">{order.orderNotes}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="second-tab" className="mt-4">
                            <div className="p-4 bg-gray-100 rounded">
                              <p className="text-gray-600">Second tab content - please specify what should be shown here.</p>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDashboard;
