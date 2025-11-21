import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Eye, Phone, AlertTriangle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface ReturnNotReceived {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  returnReason: string | null;
  markedReturnedDate: string;
  daysSinceMarked: number;
  courier: string;
  trackingId: string | null;
  returnValue: number;
}

const ReturnsNotReceived = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [returns, setReturns] = useState<ReturnNotReceived[]>([]);
  const [loading, setLoading] = useState(true);
  // Fetch returns not received from database
  useEffect(() => {
    fetchReturnsNotReceived();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('returns-not-received-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'orders' }, 
        () => fetchReturnsNotReceived()
      )
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'dispatches' }, 
        () => fetchReturnsNotReceived()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchReturnsNotReceived = async () => {
    try {
      setLoading(true);
      
      // Query orders marked as returned by courier but still dispatched in Ecomnet
      // and older than 3 days
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          notes,
          total_amount,
          status,
          updated_at,
          dispatches!inner (
            courier,
            tracking_id,
            last_tracking_update,
            status
          )
        `)
        .eq('status', 'returned')
        .lt('updated_at', threeDaysAgo.toISOString())
        .order('updated_at', { ascending: true });

      if (error) throw error;

      const formattedReturns: ReturnNotReceived[] = (data || []).map((order: any) => {
        const dispatch = order.dispatches;
        const markedDate = new Date(dispatch.last_tracking_update);
        const daysSince = Math.floor((Date.now() - markedDate.getTime()) / (1000 * 60 * 60 * 24));

        return {
          id: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          returnReason: order.notes || 'Not specified',
          markedReturnedDate: markedDate.toISOString().split('T')[0],
          daysSinceMarked: daysSince,
          courier: dispatch.courier,
          trackingId: dispatch.tracking_id,
          returnValue: order.total_amount
        };
      });

      setReturns(formattedReturns);
    } catch (error: any) {
      console.error('Error fetching returns:', error);
      toast({
        title: "Error",
        description: "Failed to load returns not received",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredReturns = useMemo(() => {
    return returns.filter(returnItem => 
      returnItem.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      returnItem.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (returnItem.customerPhone && returnItem.customerPhone.includes(searchTerm)) ||
      (returnItem.trackingId && returnItem.trackingId.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [returns, searchTerm]);
  const handleSelectReturn = (returnId: string, checked: boolean) => {
    if (checked) {
      setSelectedReturns([...selectedReturns, returnId]);
    } else {
      setSelectedReturns(selectedReturns.filter(id => id !== returnId));
    }
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedReturns(filteredReturns.map(returnItem => returnItem.id));
    } else {
      setSelectedReturns([]);
    }
  };
  const handleExportSelected = () => {
    const selectedData = filteredReturns.filter(returnItem => selectedReturns.includes(returnItem.id));
    const csvContent = [['Order Number', 'Customer Name', 'Phone', 'Return Reason', 'Courier', 'Tracking ID', 'Marked Date', 'Days Overdue', 'Value'], ...selectedData.map(returnItem => [returnItem.orderNumber, returnItem.customerName, returnItem.customerPhone, returnItem.returnReason, returnItem.courier, returnItem.trackingId, returnItem.markedReturnedDate, returnItem.daysSinceMarked.toString(), `₨${returnItem.returnValue.toLocaleString()}`])].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `returns-not-received-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };
  const handleViewReturn = (returnId: string) => {
    // For now, we'll show an alert. In a real app, this would navigate to return details
    alert(`Viewing return details for ${returnId}`);
  };
  const handleCallCustomer = (phone: string) => {
    // Open phone dialer
    window.open(`tel:${phone}`, '_self');
  };
  const getPriorityColor = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'text-red-600 font-bold';
    if (daysSinceMarked >= 7) return 'text-orange-600 font-semibold';
    if (daysSinceMarked >= 3) return 'text-yellow-600 font-medium';
    return 'text-gray-600';
  };
  const getPriorityBadge = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'bg-red-100 text-red-800 border-red-200';
    if (daysSinceMarked >= 7) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (daysSinceMarked >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };
  return <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Returns Not Received</h1>
          <p className="text-gray-600 mt-1">Orders marked as returned but not received at warehouse for more than 3 days</p>
        </div>
        
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Overdue</p>
                <p className="text-2xl font-bold text-red-600">{filteredReturns.length}</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical (10+ days)</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredReturns.filter(item => item.daysSinceMarked >= 10).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority (7+ days)</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredReturns.filter(item => item.daysSinceMarked >= 7 && item.daysSinceMarked < 10).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value at Risk</p>
                <p className="text-2xl font-bold text-purple-600">
                  ₨{filteredReturns.reduce((sum, item) => sum + item.returnValue, 0).toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Eye className="h-4 w-4 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Main Content */}
      {!loading && (
      <Card>
        <CardHeader>
          <CardTitle>Returns Awaiting Receipt</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search by order number, customer name, phone, or tracking ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox checked={selectedReturns.length === filteredReturns.length && filteredReturns.length > 0} onCheckedChange={handleSelectAll} />
                  </TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Return Reason</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Marked Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map(returnItem => <TableRow key={returnItem.id}>
                    <TableCell>
                      <Checkbox checked={selectedReturns.includes(returnItem.id)} onCheckedChange={checked => handleSelectReturn(returnItem.id, checked as boolean)} />
                    </TableCell>
                    <TableCell className="font-medium">{returnItem.orderNumber}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{returnItem.customerName}</p>
                      </div>
                    </TableCell>
                    <TableCell>{returnItem.customerPhone}</TableCell>
                    <TableCell className="max-w-[120px] truncate">
                      {returnItem.returnReason}
                    </TableCell>
                    <TableCell>{returnItem.courier}</TableCell>
                    <TableCell className="font-mono text-sm">{returnItem.trackingId}</TableCell>
                    <TableCell>{returnItem.markedReturnedDate}</TableCell>
                    <TableCell>
                      <span className={getPriorityColor(returnItem.daysSinceMarked)}>
                        {returnItem.daysSinceMarked} days
                      </span>
                    </TableCell>
                    <TableCell>₨{returnItem.returnValue.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge className={getPriorityBadge(returnItem.daysSinceMarked)}>
                        {returnItem.daysSinceMarked >= 10 ? 'Critical' : returnItem.daysSinceMarked >= 7 ? 'High' : returnItem.daysSinceMarked >= 3 ? 'Medium' : 'Low'}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       <div className="flex gap-2">
                         <Button variant="outline" size="sm" onClick={() => handleViewReturn(returnItem.id)}>
                           <Eye className="h-3 w-3" />
                         </Button>
                         <Button variant="outline" size="sm" onClick={() => handleCallCustomer(returnItem.customerPhone)}>
                           <Phone className="h-3 w-3" />
                         </Button>
                       </div>
                     </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>
          </div>

          {filteredReturns.length === 0 && <div className="text-center py-8">
              <p className="text-gray-500">No overdue returns found matching your search criteria.</p>
            </div>}
        </CardContent>
      </Card>
      )}
    </div>;
};
export default ReturnsNotReceived;