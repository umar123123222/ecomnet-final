
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Search, Plus, Download, Scan, RotateCcw } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const manualEntrySchema = z.object({
  trackingIds: z.string().min(1, 'Please enter at least one tracking ID'),
});

const ReturnsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);

  const form = useForm<z.infer<typeof manualEntrySchema>>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      trackingIds: '',
    },
  });

  const returns = useMemo(() => [
    {
      id: 'RTN-001',
      orderId: 'ORD-123456',
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
      orderId: 'ORD-789012',
      trackingId: 'TRK-789012',
      customer: 'Jane Smith',
      phone: '+92-301-9876543',
      reason: 'Wrong Item',
      worth: 'PKR 1,800',
      status: 'processing',
      date: '2024-01-14',
    },
    {
      id: 'RTN-003',
      orderId: 'ORD-345678',
      trackingId: 'TRK-345678',
      customer: 'Ali Khan',
      phone: '+92-302-5556789',
      reason: 'Defective',
      worth: 'PKR 3,200',
      status: 'received',
      date: '2024-01-16',
    },
    {
      id: 'RTN-004',
      orderId: 'ORD-901234',
      trackingId: 'TRK-901234',
      customer: 'Sara Ahmed',
      phone: '+92-303-7778888',
      reason: 'Size Issue',
      worth: 'PKR 1,500',
      status: 'processing',
      date: '2024-01-13',
    },
  ], []);

  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return returns;
    
    return returns.filter(returnItem => {
      const returnDate = parseISO(returnItem.date);
      if (dateRange.to) {
        return isWithinInterval(returnDate, { start: dateRange.from, end: dateRange.to });
      }
      return returnDate >= dateRange.from;
    });
  }, [returns, dateRange]);

  const filteredReturns = useMemo(() => {
    return filteredByDate.filter(returnItem => 
      returnItem.trackingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      returnItem.orderId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredByDate, searchTerm]);

  const metrics = useMemo(() => {
    const returnedCount = filteredByDate.length;
    const returnedWorth = filteredByDate.reduce((sum, returnItem) => {
      const worth = parseInt(returnItem.worth.replace('PKR ', '').replace(',', ''));
      return sum + worth;
    }, 0);

    return {
      returnedCount,
      returnedWorth: `PKR ${returnedWorth.toLocaleString()}`,
    };
  }, [filteredByDate]);

  const handleSelectReturn = (returnId: string) => {
    setSelectedReturns(prev => 
      prev.includes(returnId) 
        ? prev.filter(id => id !== returnId)
        : [...prev, returnId]
    );
  };

  const handleSelectAll = () => {
    setSelectedReturns(
      selectedReturns.length === filteredReturns.length 
        ? [] 
        : filteredReturns.map(r => r.id)
    );
  };

  const handleScanReturn = () => {
    // Open camera/scanner
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setIsScanDialogOpen(true);
      // Camera logic would go here
      console.log('Opening camera for scanning return...');
    } else {
      alert('Camera not available on this device');
    }
  };

  const onManualEntrySubmit = (values: z.infer<typeof manualEntrySchema>) => {
    console.log('Manual entry tracking IDs:', values.trackingIds);
    // Process the tracking IDs here
    setIsManualEntryOpen(false);
    form.reset();
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
          <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleScanReturn}>
                <Scan className="h-4 w-4 mr-2" />
                Scan Return
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Scan Return</DialogTitle>
              </DialogHeader>
              <div className="p-4 text-center">
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                  <p className="text-gray-500">Camera view would appear here</p>
                </div>
                <Button onClick={() => setIsScanDialogOpen(false)}>
                  Close Camera
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Entry</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onManualEntrySubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="trackingIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking ID(s)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter tracking ID(s) separated by commas"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsManualEntryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returned Orders (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Worth of Returns (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedWorth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Returns Table with integrated filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Returns ({filteredReturns.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedReturns.length === filteredReturns.length && filteredReturns.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters integrated into the table section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
            <Button variant="outline" disabled={selectedReturns.length === 0}>
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
                <TableHead>Reason</TableHead>
                <TableHead>Worth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReturns.map((returnItem) => (
                <TableRow key={returnItem.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedReturns.includes(returnItem.id)}
                      onCheckedChange={() => handleSelectReturn(returnItem.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{returnItem.orderId}</TableCell>
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
