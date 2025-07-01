
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
import { Search, Download, Plus, Truck } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';

const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });

  const dispatches = useMemo(() => [
    {
      id: 'DISP-001',
      orderId: 'ORD-123456',
      trackingId: 'TRK-123456',
      customer: 'John Doe',
      phone: '+92-300-1234567',
      address: '123 Main St, Karachi',
      status: 'pending',
      date: '2024-01-15',
      courier: 'TCS',
    },
    {
      id: 'DISP-002',
      orderId: 'ORD-789012',
      trackingId: 'TRK-789012',
      customer: 'Jane Smith',
      phone: '+92-301-9876543',
      address: '456 Oak Ave, Lahore',
      status: 'in-transit',
      date: '2024-01-14',
      courier: 'Leopards',
    },
    {
      id: 'DISP-003',
      orderId: 'ORD-345678',
      trackingId: 'TRK-345678',
      customer: 'Ali Khan',
      phone: '+92-302-5556789',
      address: '789 Pine Rd, Islamabad',
      status: 'delivered',
      date: '2024-01-16',
      courier: 'PostEx',
    },
    {
      id: 'DISP-004',
      orderId: 'ORD-901234',
      trackingId: 'TRK-901234',
      customer: 'Sara Ahmed',
      phone: '+92-303-7778888',
      address: '321 Elm St, Faisalabad',
      status: 'pending',
      date: '2024-01-13',
      courier: 'TCS',
    },
  ], []);

  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return dispatches;
    
    return dispatches.filter(dispatch => {
      const dispatchDate = parseISO(dispatch.date);
      if (dateRange.to) {
        return isWithinInterval(dispatchDate, { start: dateRange.from, end: dateRange.to });
      }
      return dispatchDate >= dateRange.from;
    });
  }, [dispatches, dateRange]);

  const filteredDispatches = useMemo(() => {
    return filteredByDate.filter(dispatch => {
      const matchesSearch = dispatch.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dispatch.courier.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || dispatch.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [filteredByDate, searchTerm, statusFilter]);

  const metrics = useMemo(() => {
    const pendingCount = filteredByDate.filter(d => d.status === 'pending').length;
    const inTransitCount = filteredByDate.filter(d => d.status === 'in-transit').length;
    const deliveredCount = filteredByDate.filter(d => d.status === 'delivered').length;
    const totalDispatches = filteredByDate.length;

    return {
      pendingCount,
      inTransitCount,
      deliveredCount,
      totalDispatches,
    };
  }, [filteredByDate]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in-transit':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispatch Management</h1>
          <p className="text-gray-600 mt-1">Track and manage order dispatches</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Dispatch
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Dispatches (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalDispatches}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Pending Dispatches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{metrics.pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              In Transit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.inTransitCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.deliveredCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Dispatches Table with integrated filters */}
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
          {/* Search and Filters integrated into the table section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer, order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
              className="w-full"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-transit">In Transit</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedDispatches.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell className="font-medium">{dispatch.orderId}</TableCell>
                  <TableCell>{dispatch.trackingId}</TableCell>
                  <TableCell>{dispatch.customer}</TableCell>
                  <TableCell>{dispatch.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{dispatch.address}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-gray-500" />
                      {dispatch.courier}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(dispatch.status)}>
                      {dispatch.status}
                    </Badge>
                  </TableCell>
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
