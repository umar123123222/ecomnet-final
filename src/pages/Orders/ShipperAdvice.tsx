import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Eye, MessageSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagsNotes from "@/components/TagsNotes";
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const ShipperAdvice = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [courierFilter, setCourierFilter] = useState<string>('all');
  const [attemptsFilter, setAttemptsFilter] = useState<string>('all');
  const [availableCouriers, setAvailableCouriers] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProblematicOrders = async () => {
      setLoading(true);
      try {
        // Fetch only dispatched orders (with courier) that need shipper advice
        const { data, error } = await supabase
          .from('orders')
          .select(`
            *,
            dispatches (
              *,
              courier_tracking_history (
                status,
                current_location,
                checked_at,
                raw_response
              )
            )
          `)
          .eq('status', 'dispatched')
          .not('tracking_id', 'is', null)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching orders:', error);
          toast({
            title: "Error",
            description: "Failed to fetch orders",
            variant: "destructive",
          });
        } else {
          // Filter orders that have actually been attempted but failed delivery
          const needsAdviceStatuses = ['delivery_failed', 'pending', 'out_for_delivery'];
          
          const formattedOrders = (data || [])
            .filter(order => {
              const dispatch = order.dispatches?.[0];
              if (!dispatch || !order.tracking_id) return false;
              
              // Get the latest tracking status
              const trackingHistory = dispatch.courier_tracking_history || [];
              if (trackingHistory.length === 0) return false;
              
              const latestTracking = [...trackingHistory].sort(
                (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
              )[0];
              
              // Only show orders with failed delivery attempts or pending actions
              return needsAdviceStatuses.includes(latestTracking.status);
            })
            .map((order) => {
              const dispatch = order.dispatches[0];
              const trackingHistory = dispatch.courier_tracking_history || [];
              
              // Sort tracking history by date
              const sortedHistory = [...trackingHistory].sort(
                (a, b) => new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
              );
              
              const latestTracking = sortedHistory[0];
              
              // Count actual delivery attempts (out_for_delivery or delivery_failed events)
              const attemptStatuses = ['out_for_delivery', 'delivery_failed'];
              const attemptCount = trackingHistory.filter(h => 
                attemptStatuses.includes(h.status)
              ).length;
              
              // Calculate days stuck since last tracking update
              const lastUpdate = new Date(latestTracking.checked_at);
              const daysStuck = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
              
              return {
                id: order.id,
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                address: order.customer_address,
                status: latestTracking.status,
                courier: order.courier || 'TCS',
                attemptDate: latestTracking.checked_at.split('T')[0],
                attemptCount: attemptCount || 1,
                lastAttemptReason: latestTracking.current_location || 'Unknown reason',
                totalAmount: order.total_amount || 0,
                daysStuck: daysStuck
              };
            });

          setOrders(formattedOrders);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchCouriers = async () => {
      try {
        const { data, error } = await supabase
          .from('couriers')
          .select('name')
          .eq('is_active', true)
          .order('name');

        if (error) throw error;
        
        if (data) {
          setAvailableCouriers(data.map(c => c.name));
        }
      } catch (error) {
        console.error('Error fetching couriers:', error);
      }
    };

    fetchProblematicOrders();
    fetchCouriers();
  }, [toast]);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = 
        order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerPhone.includes(searchTerm);
      
      const matchesCourier = courierFilter === 'all' || order.courier === courierFilter;
      
      const matchesAttempts = 
        attemptsFilter === 'all' || 
        (attemptsFilter === '1' && order.attemptCount === 1) ||
        (attemptsFilter === '2' && order.attemptCount === 2) ||
        (attemptsFilter === '3+' && order.attemptCount >= 3);
      
      return matchesSearch && matchesCourier && matchesAttempts;
    });
  }, [orders, searchTerm, courierFilter, attemptsFilter]);

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleExportSelected = () => {
    const selectedData = filteredOrders.filter(order => selectedOrders.includes(order.id));
    const csvContent = [
      ['Order Number', 'Customer Name', 'Phone', 'Status', 'Courier', 'Attempts', 'Days Stuck', 'Amount'],
      ...selectedData.map(order => [
        order.orderNumber,
        order.customerName,
        order.customerPhone,
        order.status,
        order.courier,
        order.attemptCount.toString(),
        order.daysStuck.toString(),
        `₨${order.totalAmount.toLocaleString()}`
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shipper-advice-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleViewOrder = (orderId: string) => {
    // For now, we'll show an alert. In a real app, this would navigate to order details
    alert(`Viewing order details for ${orderId}`);
  };

  const handleWhatsApp = (phone: string) => {
    // Open WhatsApp with phone number
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const toggleRowExpansion = (orderId: string) => {
    setExpandedRows(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivery_failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'attempted':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (daysStuck: number) => {
    if (daysStuck >= 7) return 'text-red-600 font-semibold';
    if (daysStuck >= 3) return 'text-orange-600 font-medium';
    return 'text-green-600';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipper Advice</h1>
          <p className="text-gray-600 mt-1">Orders that need attention or are stuck in delivery</p>
        </div>
        <Button variant="outline" disabled={selectedOrders.length === 0} onClick={handleExportSelected}>
          <Download className="h-4 w-4 mr-2" />
          Export Selected
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <Filter className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredOrders.filter(order => order.daysStuck >= 7).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Multiple Attempts</p>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredOrders.filter(order => order.attemptCount > 2).length}
                </p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ₨{filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0).toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Orders Requiring Attention</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by order number, customer name, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={courierFilter} onValueChange={setCourierFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {availableCouriers.map((courier) => (
                  <SelectItem key={courier} value={courier}>
                    {courier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={attemptsFilter} onValueChange={setAttemptsFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Attempts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Attempts</SelectItem>
                <SelectItem value="1">1 Attempt</SelectItem>
                <SelectItem value="2">2 Attempts</SelectItem>
                <SelectItem value="3+">3+ Attempts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto -mx-6 px-6">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Last Reason</TableHead>
                  <TableHead>Days Stuck</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
               <TableBody>
                 {loading ? (
                   <TableRow>
                     <TableCell colSpan={11} className="text-center">Loading orders...</TableCell>
                   </TableRow>
                 ) : filteredOrders.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={11} className="text-center">No problematic orders found</TableCell>
                   </TableRow>
                 ) : (
                   filteredOrders.map((order) => (
                     <React.Fragment key={order.id}>
                       <TableRow>
                         <TableCell>
                           <Checkbox
                             checked={selectedOrders.includes(order.id)}
                             onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                           />
                         </TableCell>
                         <TableCell className="font-medium">{order.orderNumber}</TableCell>
                         <TableCell>
                           <div>
                             <p className="font-medium">{order.customerName}</p>
                             <p className="text-xs text-gray-500 truncate max-w-[150px]">{order.address}</p>
                           </div>
                         </TableCell>
                         <TableCell>{order.customerPhone}</TableCell>
                         <TableCell>
                           <Badge className={`${getStatusColor(order.status)} capitalize`}>
                             {order.status}
                           </Badge>
                         </TableCell>
                         <TableCell>{order.courier}</TableCell>
                         <TableCell>
                           <span className={order.attemptCount > 2 ? 'text-red-600 font-semibold' : ''}>
                             {order.attemptCount}
                           </span>
                         </TableCell>
                         <TableCell className="max-w-[120px] truncate">
                           {order.lastAttemptReason}
                         </TableCell>
                         <TableCell>
                           <span className={getPriorityColor(order.daysStuck)}>
                             {order.daysStuck} days
                           </span>
                         </TableCell>
                         <TableCell>₨{order.totalAmount.toLocaleString()}</TableCell>
                         <TableCell>
                           <div className="flex gap-2">
                             <Button variant="outline" size="sm" onClick={() => toggleRowExpansion(order.id)}>
                               <Eye className="h-3 w-3" />
                             </Button>
                             <Button variant="outline" size="sm" onClick={() => handleWhatsApp(order.customerPhone)}>
                               <MessageSquare className="h-3 w-3" />
                             </Button>
                           </div>
                         </TableCell>
                       </TableRow>
                       {expandedRows.includes(order.id) && (
                         <TableRow>
                           <TableCell colSpan={11}>
                             <div className="p-4 bg-gray-50 rounded-lg">
                               <TagsNotes
                                 itemId={order.id}
                                 tags={[
                                   { id: '1', text: 'Priority', addedBy: 'System', addedAt: '2024-01-15', canDelete: true },
                                   { id: '2', text: 'VIP Customer', addedBy: 'Manager', addedAt: '2024-01-14', canDelete: true }
                                 ]}
                                 notes={[
                                   { id: '1', text: 'Customer requested express delivery', addedBy: 'Agent', addedAt: '2024-01-15', canDelete: true },
                                   { id: '2', text: 'Fragile items - handle with care', addedBy: 'Dispatch', addedAt: '2024-01-14', canDelete: true }
                                 ]}
                                 onAddTag={(tag) => {/* Add tag functionality */}}
                                 onAddNote={(note) => {/* Add note functionality */}}
                                 onDeleteTag={(tagId) => {/* Delete tag functionality */}}
                                 onDeleteNote={(noteId) => {/* Delete note functionality */}}
                               />
                             </div>
                           </TableCell>
                         </TableRow>
                       )}
                     </React.Fragment>
                   ))
                 )}
               </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipperAdvice;