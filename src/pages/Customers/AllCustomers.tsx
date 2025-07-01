
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Eye, Edit, MessageCircle } from 'lucide-react';
import TagsNotes from '@/components/TagsNotes';

const AllCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const customers = [
    {
      id: 'CUST-001',
      name: 'John Doe',
      phone: '+92-300-1234567',
      email: 'john@example.com',
      status: 'Active',
      totalOrders: 15,
      totalSpent: 'Rs. 25,000',
      joinDate: '2023-12-15',
      ordersDelivered: 12,
      ordersCancelled: 2,
      ordersReturned: 1,
      tags: [
        { id: 'tag1', text: 'VIP Customer', addedBy: 'Muhammad Umar', addedAt: '2024-01-15 10:30', canDelete: true },
        { id: 'tag2', text: 'Regular Buyer', addedBy: 'Store Manager', addedAt: '2024-01-10 14:20', canDelete: false }
      ],
      notes: [
        { id: 'note1', text: 'Customer prefers morning delivery', addedBy: 'Muhammad Umar', addedAt: '2024-01-20 09:15', canDelete: true },
        { id: 'note2', text: 'Lives in apartment complex, building 3', addedBy: 'Delivery Staff', addedAt: '2024-01-18 16:45', canDelete: false }
      ],
      orders: [
        { id: 'ORD-001', date: '2024-01-20', status: 'Delivered', amount: 'Rs. 2,500' },
        { id: 'ORD-002', date: '2024-01-18', status: 'Delivered', amount: 'Rs. 1,800' },
        { id: 'ORD-003', date: '2024-01-15', status: 'Cancelled', amount: 'Rs. 3,200' },
        { id: 'ORD-004', date: '2024-01-12', status: 'Returned', amount: 'Rs. 1,500' },
      ]
    },
    {
      id: 'CUST-002',
      name: 'Jane Smith',
      phone: '+92-301-9876543',
      email: 'jane@example.com',
      status: 'Active',
      totalOrders: 8,
      totalSpent: 'Rs. 15,500',
      joinDate: '2024-01-10',
      ordersDelivered: 7,
      ordersCancelled: 1,
      ordersReturned: 0,
      tags: [
        { id: 'tag3', text: 'New Customer', addedBy: 'Store Manager', addedAt: '2024-01-10 11:00', canDelete: true }
      ],
      notes: [],
      orders: [
        { id: 'ORD-005', date: '2024-01-19', status: 'Delivered', amount: 'Rs. 2,200' },
        { id: 'ORD-006', date: '2024-01-16', status: 'Delivered', amount: 'Rs. 1,900' },
      ]
    },
    {
      id: 'CUST-003',
      name: 'Ali Hassan',
      phone: '+92-302-5555555',
      email: 'ali@example.com',
      status: 'Inactive',
      totalOrders: 3,
      totalSpent: 'Rs. 5,200',
      joinDate: '2023-11-20',
      ordersDelivered: 2,
      ordersCancelled: 0,
      ordersReturned: 1,
      tags: [],
      notes: [
        { id: 'note3', text: 'Customer requested no calls after 8 PM', addedBy: 'Customer Service', addedAt: '2023-12-01 13:30', canDelete: true }
      ],
      orders: [
        { id: 'ORD-007', date: '2023-12-15', status: 'Delivered', amount: 'Rs. 2,800' },
        { id: 'ORD-008', date: '2023-12-10', status: 'Returned', amount: 'Rs. 1,400' },
      ]
    },
  ];

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCustomers(
      selectedCustomers.length === customers.length 
        ? [] 
        : customers.map(c => c.id)
    );
  };

  const handleWhatsAppContact = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  const handleViewCustomer = (customer: any) => {
    setSelectedCustomer(customer);
  };

  const handleEditCustomer = (customer: any) => {
    console.log('Edit customer:', customer);
    // Implement edit functionality
  };

  const handleAddTag = (customerId: string, tag: string) => {
    console.log('Adding tag to customer:', customerId, tag);
    // In a real app, this would make an API call to add the tag
  };

  const handleAddNote = (customerId: string, note: string) => {
    console.log('Adding note to customer:', customerId, note);
    // In a real app, this would make an API call to add the note
  };

  const handleDeleteTag = (customerId: string, tagId: string) => {
    console.log('Deleting tag from customer:', customerId, tagId);
    // In a real app, this would make an API call to delete the tag
  };

  const handleDeleteNote = (customerId: string, noteId: string) => {
    console.log('Deleting note from customer:', customerId, noteId);
    // In a real app, this would make an API call to delete the note
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Customers</h1>
          <p className="text-gray-600 mt-1">Manage all customer accounts and information</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">1,089</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">156</div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Filters and Customer List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              Customer List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCustomers.length === customers.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
          
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer, order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" disabled={selectedCustomers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => handleSelectCustomer(customer.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>
                    <Badge className={
                      customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.totalOrders}</TableCell>
                  <TableCell>{customer.totalSpent}</TableCell>
                  <TableCell>{customer.joinDate}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewCustomer(customer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Customer Details - {customer.name}</DialogTitle>
                            <DialogDescription>
                              Complete customer information, order history, and notes
                            </DialogDescription>
                          </DialogHeader>
                          
                          <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="orders">Orders</TabsTrigger>
                              <TabsTrigger value="statistics">Statistics</TabsTrigger>
                              <TabsTrigger value="notes-tags">Notes & Tags</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="overview" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Name</label>
                                  <p className="text-sm text-gray-600">{customer.name}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Phone</label>
                                  <p className="text-sm text-gray-600">{customer.phone}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <p className="text-sm text-gray-600">{customer.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Badge className={
                                    customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }>
                                    {customer.status}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Join Date</label>
                                  <p className="text-sm text-gray-600">{customer.joinDate}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total Spent</label>
                                  <p className="text-sm text-gray-600">{customer.totalSpent}</p>
                                </div>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="orders" className="space-y-4">
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Order History</h3>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Order ID</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {customer.orders.map((order) => (
                                      <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>{order.date}</TableCell>
                                        <TableCell>
                                          <Badge className={
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                          }>
                                            {order.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{order.amount}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="statistics" className="space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">{customer.totalOrders}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Delivered</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-green-600">{customer.ordersDelivered}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Cancelled</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-red-600">{customer.ordersCancelled}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Returned</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-yellow-600">{customer.ordersReturned}</div>
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="notes-tags" className="space-y-4">
                              <TagsNotes
                                itemId={customer.id}
                                tags={customer.tags}
                                notes={customer.notes}
                                onAddTag={(tag) => handleAddTag(customer.id, tag)}
                                onAddNote={(note) => handleAddNote(customer.id, note)}
                                onDeleteTag={(tagId) => handleDeleteTag(customer.id, tagId)}
                                onDeleteNote={(noteId) => handleDeleteNote(customer.id, noteId)}
                              />
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEditCustomer(customer)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppContact(customer.phone)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AllCustomers;
