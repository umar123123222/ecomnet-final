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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Search, Download, Scan, Edit, Truck, ChevronDown, ChevronUp } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import TagsNotes from '@/components/TagsNotes';
import { Scanner } from '@/components/Scanner';
import { useToast } from '@/hooks/use-toast';

const DispatchDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDispatches, setSelectedDispatches] = useState<string[]>([]);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [isScanningOpen, setIsScanningOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm({
    defaultValues: {
      trackingIds: '',
    },
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
      tags: [
        { id: '1', text: 'Urgent', addedBy: 'John Admin', addedAt: '2024-01-15 10:30', canDelete: true }
      ],
      notes: [
        { id: '1', text: 'Customer requested morning delivery', addedBy: 'Jane Staff', addedAt: '2024-01-15 09:15', canDelete: false }
      ]
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
      
      return matchesSearch;
    });
  }, [filteredByDate, searchTerm]);

  const metrics = useMemo(() => {
    const totalDispatches = filteredByDate.length;
    const worthOfDispatches = filteredByDate.reduce((total, dispatch) => {
      // Assuming a default worth per dispatch or you can add amount to dispatch data
      return total + 2500; // Default amount per dispatch
    }, 0);

    return {
      totalDispatches,
      worthOfDispatches,
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

  const handleScanDispatch = (scanData: { orderId?: string; trackingId?: string; rawData: string }) => {
    const { orderId, trackingId, rawData } = scanData;
    
    if (orderId || trackingId) {
      toast({
        title: "Dispatch Scanned Successfully",
        description: `Order ID: ${orderId || 'Not found'}, Tracking ID: ${trackingId || 'Not found'}`,
      });
      
      // Auto-fill the search with the scanned tracking ID or order ID
      if (trackingId) {
        setSearchTerm(trackingId);
      } else if (orderId) {
        setSearchTerm(orderId);
      }
    } else {
      toast({
        title: "No Order Information Found",
        description: `Scanned: ${rawData.substring(0, 50)}${rawData.length > 50 ? '...' : ''}`,
        variant: "destructive",
      });
    }
  };

  const handleManualEntry = (data: { trackingIds: string }) => {
    // Manual entry tracking IDs processed
    setIsManualEntryOpen(false);
    form.reset();
  };

  const toggleRowExpansion = (dispatchId: string) => {
    setExpandedRows(prev => 
      prev.includes(dispatchId) 
        ? prev.filter(id => id !== dispatchId)
        : [...prev, dispatchId]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dispatch Management</h1>
          <p className="text-gray-600 mt-1">Track and manage order dispatches</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsScanningOpen(true)}>
            <Scan className="h-4 w-4 mr-2" />
            Scan Dispatch
          </Button>
          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Tracking ID Entry</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(() => {})} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="trackingIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking IDs</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter tracking IDs (one per line or comma separated)..."
                            className="min-h-[100px]"
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

      {/* Scanner Component */}
      <Scanner
        isOpen={isScanningOpen}
        onClose={() => setIsScanningOpen(false)}
        onScan={handleScanDispatch}
        title="Scan Dispatch QR Code"
        scanType="dispatch"
      />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              Worth of Dispatches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rs. {metrics.worthOfDispatches.toLocaleString()}</div>
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
                onCheckedChange={() => {}} // handleSelectAll
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
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
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDispatches.map((dispatch) => (
                <React.Fragment key={dispatch.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedDispatches.includes(dispatch.id)}
                        onCheckedChange={() => {}} // handleSelectDispatch
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
                      <Badge className={dispatch.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : dispatch.status === 'in-transit' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                        {dispatch.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{dispatch.date}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(dispatch.id)}
                      >
                        {expandedRows.includes(dispatch.id) ? 
                          <ChevronUp className="h-4 w-4" /> : 
                          <ChevronDown className="h-4 w-4" />
                        }
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(dispatch.id) && (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-gray-50 p-4">
                        <TagsNotes
                          itemId={dispatch.id}
                          tags={dispatch.tags}
                          notes={dispatch.notes}
                          onAddTag={(tag) => {/* Add tag functionality */}}
                          onAddNote={(note) => {/* Add note functionality */}}
                          onDeleteTag={(tagId) => {/* Delete tag functionality */}}
                          onDeleteNote={(noteId) => {/* Delete note functionality */}}
                        />
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

export default DispatchDashboard;
