
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
import { Search, Filter, Download, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

const AddressVerification = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);

  const addresses = [
    {
      id: 'ADDR-001',
      orderId: 'ORD-001',
      customerName: 'John Doe',
      phone: '+92-300-1234567',
      address: 'House 123, Street 45, Block F, Gulberg, Lahore',
      gptScore: 85,
      status: 'pending'
    },
    {
      id: 'ADDR-002',
      orderId: 'ORD-002',
      customerName: 'Jane Smith',
      phone: '+92-301-9876543',
      address: 'Flat 7, Building 12, Main Road, Karachi',
      gptScore: 45,
      status: 'pending'
    },
  ];

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddresses(prev => 
      prev.includes(addressId) 
        ? prev.filter(id => id !== addressId)
        : [...prev, addressId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAddresses(
      selectedAddresses.length === addresses.length 
        ? [] 
        : addresses.map(a => a.id)
    );
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk ${action} for addresses:`, selectedAddresses);
    // Implement bulk action logic here
  };

  const handleIndividualAction = (addressId: string, action: string) => {
    console.log(`${action} for address:`, addressId);
    // Implement individual action logic here
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Address Verification</h1>
          <p className="text-gray-600 mt-1">Verify and manage customer addresses</p>
        </div>
      </div>

      {/* Bulk Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4">
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              onClick={() => handleBulkAction('approve')}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              onClick={() => handleBulkAction('disapprove')}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Disapprove Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              onClick={() => handleBulkAction('clarification')}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Send Clarification
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by order ID, customer name, phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Addresses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Address Verification Queue</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddresses.length === addresses.length}
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
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>GPT Score</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addresses.map((address) => (
                <TableRow key={address.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAddresses.includes(address.id)}
                      onCheckedChange={() => handleSelectAddress(address.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{address.orderId}</TableCell>
                  <TableCell>{address.customerName}</TableCell>
                  <TableCell>{address.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{address.address}</TableCell>
                  <TableCell>
                    <Badge className={getScoreBadge(address.gptScore)}>
                      {address.gptScore}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIndividualAction(address.id, 'approve')}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIndividualAction(address.id, 'disapprove')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIndividualAction(address.id, 'clarification')}
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

export default AddressVerification;
