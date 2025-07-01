
import React, { useState, useMemo } from 'react';
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
import { Search, Plus, Filter, Download, Scan } from 'lucide-react';

const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState('daily');

  const dispatches = useMemo(() => [
    {
      id: 'DSP-001',
      trackingId: 'TRK-123456',
      customer: 'John Doe',
      phone: '+92-300-1234567',
      courier: 'Leopard',
      status: 'dispatched',
      worth: 'PKR 2,500',
      date: '2024-01-15',
    },
    {
      id: 'DSP-002',
      trackingId: 'TRK-789012',
      customer: 'Jane Smith',
      phone: '+92-301-9876543',
      courier: 'PostEx',
      status: 'delivered',
      worth: 'PKR 1,800',
      date: '2024-01-14',
    },
  ], []);

  const metrics = useMemo(() => ({
    daily: {
      dispatched: 45,
      totalWorth: 'PKR 125,000',
      returnedCount: 3,
      returnedWorth: 'PKR 8,500'
    },
    weekly: {
      dispatched: 312,
      totalWorth: 'PKR 875,000',
      returnedCount: 18,
      returnedWorth: 'PKR 42,000'
    }
  }), []);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter(dispatch => 
      dispatch.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispatch.customer.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dispatches, searchTerm]);

  const handleSelectDispatch = (dispatchId: string) => {
    setSelectedDispatches(prev => 
      prev.includes(dispatchId) 
        ? prev.filter(id => id !== dispatchId)
        : [...prev, dispatchId]
    );
  };

  const handleSelectAll = () => {
    setSelectedDispatches(
      selectedDispatches.length === filteredDispatches.length 
        ? [] 
        : filteredDispatches.map(d => d.id)
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispatch Portal</h1>
          <p className="text-gray-600 mt-1">Manage dispatched orders and returns</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Scan className="h-4 w-4 mr-2" />
            Scan Parcel
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Manual Entry
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Dispatched Orders ({timeFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics[timeFilter as keyof typeof metrics].dispatched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Worth ({timeFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics[timeFilter as keyof typeof metrics].totalWorth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returns Received ({timeFilter})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics[timeFilter as keyof typeof metrics].returnedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returns Worth ({timeFilter})
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            <Button variant="outline" disabled={selectedDispatches.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dispatches Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Dispatches ({filteredDispatches.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedDispatches.length === filteredDispatches.length && filteredDispatches.length > 0}
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
                <TableHead>Dispatch ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Worth</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDispatches.map((dispatch) => (
                <TableRow key={dispatch.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedDispatches.includes(dispatch.id)}
                      onCheckedChange={() => handleSelectDispatch(dispatch.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{dispatch.id}</TableCell>
                  <TableCell>{dispatch.trackingId}</TableCell>
                  <TableCell>{dispatch.customer}</TableCell>
                  <TableCell>{dispatch.phone}</TableCell>
                  <TableCell>{dispatch.courier}</TableCell>
                  <TableCell>
                    <Badge className={dispatch.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                      {dispatch.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{dispatch.worth}</TableCell>
                  <TableCell>{dispatch.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DispatchDashboard;
