
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Search, Upload, Plus, Filter } from 'lucide-react';

const OrderDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');

  const orders = [
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
    },
  ];

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <p className="text-gray-600 mt-1">Manage and track all your orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <SelectItem value="tcs">TCS</SelectItem>
                <SelectItem value="bluex">BlueEx</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              Export Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        Track
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

export default OrderDashboard;
