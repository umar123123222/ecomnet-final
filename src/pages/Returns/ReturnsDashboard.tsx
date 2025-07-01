
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
import { Search, Upload, Plus, Filter, Download, Scan, RotateCcw } from 'lucide-react';

const ReturnsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState('daily');

  const returns = [
    {
      id: 'RTN-001',
      trackingId: 'TRK-123456',
      customer: 'John Doe',
      phone: '+92-300-1234567',
      reason: 'Damaged',
      worth: 'PKR 2,500',
      status: 'received',
      date: '2024-01-15',
    },
    {
      id: 'RTN-002',
      trackingId: 'TRK-789012',
      customer: 'Jane Smith',
      phone: '+92-301-9876543',
      reason: 'Wrong Item',
      worth: 'PKR 1,800',
      status: 'processing',
      date: '2024-01-14',
    },
  ];

  const metrics = {
    daily: {
      returnedCount: 8,
      returnedWorth: 'PKR 18,500'
    },
    weekly: {
      returnedCount: 42,
      returnedWorth: 'PKR 125,000'
    }
  };

  const handleSelectReturn = (returnId: string) => {
    setSelectedReturns(prev => 
      prev.includes(returnId) 
        ? prev.filter(id => id !== returnId)
        : [...prev, returnId]
    );
  };

  const handleSelectAll = () => {
    setSelectedReturns(
      selectedReturns.length === returns.length 
        ? [] 
        : returns.map(r => r.id)
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-gray-600 mt-1">Track and manage returned orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Scan className="h-4 w-4 mr-2" />
            Scan Return
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returned Orders ({timeFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics[timeFilter as keyof typeof metrics].returnedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Worth of Returns ({timeFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics[timeFilter as keyof typeof metrics].returnedWorth}</div>
          </CardContent>
        </Card>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Time Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedReturns.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Returns</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedReturns.length === returns.length}
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
                <TableHead>Return ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Worth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((returnItem) => (
                <TableRow key={returnItem.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedReturns.includes(returnItem.id)}
                      onCheckedChange={() => handleSelectReturn(returnItem.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{returnItem.id}</TableCell>
                  <TableCell>{returnItem.trackingId}</TableCell>
                  <TableCell>{returnItem.customer}</TableCell>
                  <TableCell>{returnItem.phone}</TableCell>
                  <TableCell>{returnItem.reason}</TableCell>
                  <TableCell>{returnItem.worth}</TableCell>
                  <TableCell>
                    <Badge className={returnItem.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                      {returnItem.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{returnItem.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnsDashboard;
