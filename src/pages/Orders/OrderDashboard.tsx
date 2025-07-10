
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
  const [orders, setOrders] = useState([
    {
      id: 'ORD-001',
      trackingId: 'TRK-123456',
      customer: 'John Doe',
      email: 'john@example.com',
      phone: '+92-300-1234567',
      courier: 'Leopard',
      status: 'delivered',
      amount: 'PKR 2,500',
      date: '2024-01-15',
      address: 'House 123, Street 45, Block F, Gulberg, Lahore',
      gptScore: 85,
      totalPrice: 2500,
      orderType: 'COD',
      city: 'Lahore',
      items: [
        { name: 'T-Shirt', quantity: 2, price: 1000 },
        { name: 'Jeans', quantity: 1, price: 1500 }
      ],
      tags: [
        { id: 'tag1', text: 'Priority', addedBy: 'Muhammad Umar', addedAt: '2024-01-15 10:30', canDelete: true },
        { id: 'tag2', text: 'VIP Customer', addedBy: 'Staff Member', addedAt: '2024-01-15 11:00', canDelete: false }
      ],
      notes: [
        { id: 'note1', text: 'Customer requested express delivery', addedBy: 'Muhammad Umar', addedAt: '2024-01-15 10:30', canDelete: true },
        { id: 'note2', text: 'Fragile items - handle with care', addedBy: 'Staff Member', addedAt: '2024-01-15 11:00', canDelete: false }
      ]
    },
    {
      id: 'ORD-002',
      trackingId: 'TRK-789012',
      customer: 'Jane Smith',
      email: 'jane@example.com',
      phone: '+92-301-9876543',
      courier: 'PostEx',
      status: 'dispatched',
      amount: 'PKR 1,800',
      date: '2024-01-14',
      address: 'Flat 7, Building 12, Main Road, Karachi',
      gptScore: 92,
      totalPrice: 1800,
      orderType: 'Prepaid',
      city: 'Karachi',
      items: [
        { name: 'Shoes', quantity: 1, price: 1800 }
      ],
      tags: [],
      notes: []
    },
    {
      id: 'ORD-003',
      trackingId: 'TRK-345678',
      customer: 'Ahmed Ali',
      email: 'ahmed@example.com',
      phone: '+92-302-5555555',
      courier: 'Leopard',
      status: 'booked',
      amount: 'PKR 3,200',
      date: '2024-01-13',
      address: 'Plot 45, Sector 12, Islamabad',
      gptScore: 78,
      totalPrice: 3200,
      orderType: 'COD',
      city: 'Islamabad',
      items: [
        { name: 'Laptop Case', quantity: 1, price: 2000 },
        { name: 'Mouse', quantity: 1, price: 1200 }
      ],
      tags: [],
      notes: []
    },
  ]);

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
    { title: 'Total Orders', value: '2,847', color: 'bg-blue-500' },
    { title: 'Booked', value: '1,234', color: 'bg-orange-500' },
    { title: 'Dispatched', value: '987', color: 'bg-purple-500' },
    { title: 'Delivered', value: '2,156', color: 'bg-green-500' },
    { title: 'Cancelled', value: '89', color: 'bg-red-500' },
    { title: 'Returns', value: '168', color: 'bg-gray-500' },
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
    console.log(`Bulk ${action} for orders:`, selectedOrders);
  };

  const handleAddTag = (orderId: string, tag: string) => {
    console.log(`Adding tag "${tag}" to order ${orderId}`);
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
    console.log(`Adding note "${note}" to order ${orderId}`);
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
    console.log(`Deleting tag ${tagId} from order ${orderId}`);
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
    console.log(`Deleting note ${noteId} from order ${orderId}`);
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
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
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
              {filteredOrders.map((order) => (
                <React.Fragment key={order.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.includes(order.id)}
                        onCheckedChange={() => handleSelectOrder(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.id}</TableCell>
                    <TableCell>{order.trackingId}</TableCell>
                    <TableCell>{order.customer}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{order.email}</div>
                        <div className="text-gray-500">{order.phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>{order.courier}</TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>{order.amount}</TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        Track
                      </Button>
                    </TableCell>
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
                      <TableCell colSpan={11} className="bg-gray-50 p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-6">
                            <div>
                              <h4 className="font-semibold mb-2">Customer Address</h4>
                              <p className="text-sm text-gray-600">{order.address}</p>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Order Details</h4>
                              <div className="space-y-1 text-sm">
                                <p><span className="font-medium">GPT Score:</span> {order.gptScore}%</p>
                                <p><span className="font-medium">Total Price:</span> PKR {order.totalPrice}</p>
                                <p><span className="font-medium">Order Type:</span> {order.orderType}</p>
                                <p><span className="font-medium">City:</span> {order.city}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-2">Items</h4>
                              <div className="space-y-1">
                                {order.items.map((item, index) => (
                                  <div key={index} className="text-sm">
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-gray-500 ml-2">x{item.quantity} - PKR {item.price}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div>
                              <h4 className="font-semibold mb-4">Tags & Notes</h4>
                              <TagsNotes
                                itemId={order.id}
                                tags={order.tags}
                                notes={order.notes}
                                onAddTag={(tag) => handleAddTag(order.id, tag)}
                                onAddNote={(note) => handleAddNote(order.id, note)}
                                onDeleteTag={(tagId) => handleDeleteTag(order.id, tagId)}
                                onDeleteNote={(noteId) => handleDeleteNote(order.id, noteId)}
                              />
                            </div>
                            <div>
                              <h4 className="font-semibold mb-4">Order Actions</h4>
                              <div className="flex gap-3">
                                <Dialog open={editingOrder?.id === order.id} onOpenChange={(open) => !open && setEditingOrder(null)}>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => handleEditOrder(order)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Order
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Edit Order {order.id}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                          id="email"
                                          value={editForm.email}
                                          onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor="address">Address</Label>
                                        <Input
                                          id="address"
                                          value={editForm.address}
                                          onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" onClick={() => setEditingOrder(null)}>
                                          Cancel
                                        </Button>
                                        <Button onClick={handleSaveEdit}>
                                          Save Changes
                                        </Button>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Order
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Order</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete order {order.id}? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDeleteOrder(order.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderDashboard;
