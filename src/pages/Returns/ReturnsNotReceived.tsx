import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Phone, AlertTriangle, Clock, DollarSign, RotateCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
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
  const {
    toast
  } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [returns, setReturns] = useState<ReturnNotReceived[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchReturnsNotReceived();
    const channel = supabase.channel('returns-not-received-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders'
    }, () => fetchReturnsNotReceived()).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'dispatches'
    }, () => fetchReturnsNotReceived()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchReturnsNotReceived = async () => {
    try {
      setLoading(true);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const {
        data: returnedTracking,
        error: trackingError
      } = await supabase.from('courier_tracking_history').select(`
          order_id,
          tracking_id,
          status,
          checked_at,
          current_location,
          dispatch_id,
          dispatches!courier_tracking_history_dispatch_id_fkey (
            courier,
            orders!inner (
              id,
              order_number,
              customer_name,
              customer_phone,
              notes,
              total_amount,
              status
            )
          )
        `).eq('status', 'returned').eq('dispatches.orders.status', 'dispatched').lt('checked_at', threeDaysAgo.toISOString()).order('checked_at', {
        ascending: true
      });
      if (trackingError) throw trackingError;
      const latestByOrder = new Map();
      (returnedTracking || []).forEach((tracking: any) => {
        const order = tracking.dispatches?.orders;
        if (!order || !order.id) return;
        if (!latestByOrder.has(order.id)) {
          latestByOrder.set(order.id, {
            tracking,
            order,
            dispatch: tracking.dispatches
          });
        }
      });
      const formattedReturns: ReturnNotReceived[] = Array.from(latestByOrder.values()).map(({
        tracking,
        order,
        dispatch
      }: any) => {
        const markedDate = new Date(tracking.checked_at);
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
          trackingId: tracking.tracking_id,
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
    return returns.filter(returnItem => returnItem.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) || returnItem.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || returnItem.customerPhone && returnItem.customerPhone.includes(searchTerm) || returnItem.trackingId && returnItem.trackingId.toLowerCase().includes(searchTerm.toLowerCase()));
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
    alert(`Viewing return details for ${returnId}`);
  };
  const handleCallCustomer = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };
  const getPriorityColor = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'text-destructive font-bold';
    if (daysSinceMarked >= 7) return 'text-orange-600 font-semibold';
    if (daysSinceMarked >= 3) return 'text-yellow-600 font-medium';
    return 'text-muted-foreground';
  };
  const getPriorityBadge = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (daysSinceMarked >= 7) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (daysSinceMarked >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-muted text-muted-foreground border-border';
  };
  const criticalCount = filteredReturns.filter(item => item.daysSinceMarked >= 10).length;
  const highPriorityCount = filteredReturns.filter(item => item.daysSinceMarked >= 7 && item.daysSinceMarked < 10).length;
  const totalValue = filteredReturns.reduce((sum, item) => sum + item.returnValue, 0);
  return <PageContainer>
      <PageHeader title="Returns Not Received" description="Orders marked as returned but not received at warehouse for more than 3 days" icon={RotateCcw} />

      {loading ? <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div> : <>
          <StatsGrid columns={4}>
            <StatsCard title="Total Overdue" value={filteredReturns.length.toString()} icon={AlertTriangle} variant="danger" />
            <StatsCard title="Critical (10+ days)" value={criticalCount.toString()} icon={Clock} variant="danger" />
            <StatsCard title="High Priority (7+ days)" value={highPriorityCount.toString()} icon={AlertTriangle} variant="warning" />
            <StatsCard title="Total Value at Risk" value={`₨${totalValue.toLocaleString()}`} icon={DollarSign} variant="default" />
          </StatsGrid>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Returns Awaiting Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input placeholder="Search by order number, customer name, phone, or tracking ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
              </div>

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
                        <TableCell className="font-medium text-foreground">{returnItem.orderNumber}</TableCell>
                        <TableCell>
                          <p className="font-medium text-foreground">{returnItem.customerName}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{returnItem.customerPhone}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-muted-foreground">
                          {returnItem.returnReason}
                        </TableCell>
                        <TableCell className="text-foreground">{returnItem.courier}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{returnItem.trackingId}</TableCell>
                        <TableCell className="text-muted-foreground">{returnItem.markedReturnedDate}</TableCell>
                        <TableCell>
                          <span className={getPriorityColor(returnItem.daysSinceMarked)}>
                            {returnItem.daysSinceMarked} days
                          </span>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">₨{returnItem.returnValue.toLocaleString()}</TableCell>
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
                            
                          </div>
                        </TableCell>
                      </TableRow>)}
                  </TableBody>
                </Table>
              </div>

              {filteredReturns.length === 0 && <div className="text-center py-8">
                  <p className="text-muted-foreground">No overdue returns found matching your search criteria.</p>
                </div>}
            </CardContent>
          </Card>
        </>}
    </PageContainer>;
};
export default ReturnsNotReceived;