
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, Download, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';

const SuspiciousCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const customers = [
    {
      id: 'CUST-001',
      name: 'John Doe',
      phone: '+92-300-1234567',
      email: 'john@example.com',
      riskScore: 'High',
      totalOrders: 15,
      deliveredOrders: 8,
      failedOrders: 7,
      lastMessages: [
        'Order not received',
        'Wrong address provided',
        'Cancel my order',
      ]
    },
    {
      id: 'CUST-002',
      name: 'Jane Smith',
      phone: '+92-301-9876543',
      email: 'jane@example.com',
      riskScore: 'Medium',
      totalOrders: 8,
      deliveredOrders: 5,
      failedOrders: 3,
      lastMessages: [
        'When will my order arrive?',
        'I need to change address',
        'Thank you for delivery',
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

  const toggleExpanded = (customerId: string) => {
    setExpandedRows(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleWhatsAppContact = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suspicious Customers</h1>
          <p className="text-gray-600 mt-1">Monitor and manage high-risk customers</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, phone, email..."
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
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Suspicious Customers</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCustomers.length === customers.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Expand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <React.Fragment key={customer.id}>
                  <TableRow>
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
                        customer.riskScore === 'High' ? 'bg-red-100 text-red-800' : 
                        customer.riskScore === 'Medium' ? 'bg-orange-100 text-orange-800' : 
                        'bg-green-100 text-green-800'
                      }>
                        {customer.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppContact(customer.phone)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(customer.id)}
                      >
                        {expandedRows.includes(customer.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(customer.id) && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Order History</h4>
                            <div className="space-y-2">
                              <p><span className="font-medium">Total Orders:</span> {customer.totalOrders}</p>
                              <p><span className="font-medium">Delivered:</span> {customer.deliveredOrders}</p>
                              <p><span className="font-medium">Failed:</span> {customer.failedOrders}</p>
                              <p><span className="font-medium">Success Rate:</span> {Math.round((customer.deliveredOrders / customer.totalOrders) * 100)}%</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Last 10 Messages</h4>
                            <div className="space-y-1">
                              {customer.lastMessages.map((message, index) => (
                                <p key={index} className="text-sm text-gray-600 bg-white p-2 rounded border">
                                  {message}
                                </p>
                              ))}
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

export default SuspiciousCustomers;
