import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, AlertTriangle, Clock, DollarSign, RotateCcw, ChevronLeft, ChevronRight, Download, ArrowUp, FileWarning, Filter, X, Package } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
import ClaimSheet from "@/components/returns/ClaimSheet";
import ReturnNotReceivedCard from "@/components/returns/ReturnNotReceivedCard";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

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
  isClaimed?: boolean;
  claimAmount?: number;
  claimStatus?: string;
  claimReference?: string;
}

const ITEMS_PER_PAGE = 50;

const ReturnsNotReceived = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [allReturns, setAllReturns] = useState<ReturnNotReceived[]>([]);
  const [claimedReturns, setClaimedReturns] = useState<ReturnNotReceived[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeTab, setActiveTab] = useState<'awaiting' | 'claimed'>('awaiting');
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedOrderForClaim, setSelectedOrderForClaim] = useState<ReturnNotReceived | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchReturnsNotReceived();
    fetchClaimedReturns();
    const channel = supabase.channel('returns-not-received-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchReturnsNotReceived();
        fetchClaimedReturns();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispatches' }, () => fetchReturnsNotReceived())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'returns' }, () => fetchClaimedReturns())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRange]);

  const fetchClaimedReturns = async () => {
    try {
      const { data, error } = await supabase
        .from('returns')
        .select(`
          *,
          orders!returns_order_id_fkey (
            id,
            order_number,
            customer_name,
            customer_phone,
            total_amount
          )
        `)
        .eq('return_status', 'claimed')
        .order('claimed_at', { ascending: false });

      if (error) throw error;

      const formatted: ReturnNotReceived[] = (data || []).map((item: any) => ({
        id: item.orders?.id || item.order_id,
        orderNumber: item.orders?.order_number || 'N/A',
        customerName: item.orders?.customer_name || 'N/A',
        customerPhone: item.orders?.customer_phone,
        returnReason: item.reason || 'Claimed',
        markedReturnedDate: item.claimed_at ? new Date(item.claimed_at).toISOString().split('T')[0] : '',
        daysSinceMarked: item.claimed_at 
          ? Math.floor((Date.now() - new Date(item.claimed_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0,
        courier: item.tracking_id?.includes('LP') ? 'Leopard' : item.tracking_id?.includes('PX') ? 'PostEx' : 'Unknown',
        trackingId: item.tracking_id,
        returnValue: item.worth || item.orders?.total_amount || 0,
        isClaimed: true,
        claimAmount: item.claim_amount,
        claimStatus: item.claim_status,
        claimReference: item.claim_reference,
      }));

      setClaimedReturns(formatted);
    } catch (error) {
      console.error('Error fetching claimed returns:', error);
    }
  };

  const handleOpenClaimDialog = (returnItem: ReturnNotReceived) => {
    setSelectedOrderForClaim(returnItem);
    setClaimDialogOpen(true);
  };

  const handleClaimSuccess = () => {
    fetchReturnsNotReceived();
    fetchClaimedReturns();
  };

  const fetchReturnsNotReceived = async () => {
    try {
      setLoading(true);
      
      const fromDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : subDays(new Date(), 30).toISOString();
      const toDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : new Date().toISOString();

      const CHUNK_SIZE = 1000;
      let allTrackingData: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: returnedTracking, error: trackingError } = await supabase
          .from('courier_tracking_history')
          .select(`
            order_id,
            tracking_id,
            status,
            checked_at,
            current_location,
            dispatch_id,
            raw_response,
            dispatches!courier_tracking_history_dispatch_id_fkey (
              courier,
              orders!inner (
                id,
                order_number,
                customer_name,
                customer_phone,
                notes,
                total_amount,
                status,
                cancellation_reason
              )
            )
          `)
          .eq('status', 'returned')
          .eq('dispatches.orders.status', 'dispatched')
          .gte('checked_at', fromDate)
          .lte('checked_at', toDate)
          .order('checked_at', { ascending: false })
          .range(offset, offset + CHUNK_SIZE - 1);

        if (trackingError) throw trackingError;

        if (returnedTracking && returnedTracking.length > 0) {
          allTrackingData = [...allTrackingData, ...returnedTracking];
          offset += CHUNK_SIZE;
          hasMore = returnedTracking.length === CHUNK_SIZE;
        } else {
          hasMore = false;
        }
      }

      const latestByOrder = new Map();
      allTrackingData.forEach((tracking: any) => {
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

        let returnReason = 'Not specified';
        if (order.cancellation_reason) {
          returnReason = order.cancellation_reason;
        } else if (tracking.raw_response) {
          const rawResponse = typeof tracking.raw_response === 'string' 
            ? JSON.parse(tracking.raw_response) 
            : tracking.raw_response;
          returnReason = rawResponse?.reason || 
            rawResponse?.return_reason || 
            rawResponse?.status_reason || 
            rawResponse?.packet_data?.reason || 
            rawResponse?.shipment_data?.reason || 
            tracking.current_location || 
            order.notes || 
            'Not specified';
        } else if (tracking.current_location) {
          returnReason = tracking.current_location;
        } else if (order.notes) {
          returnReason = order.notes;
        }

        return {
          id: order.id,
          orderNumber: order.order_number,
          customerName: order.customer_name,
          customerPhone: order.customer_phone,
          returnReason,
          markedReturnedDate: markedDate.toISOString().split('T')[0],
          daysSinceMarked: daysSince,
          courier: dispatch.courier,
          trackingId: tracking.tracking_id,
          returnValue: order.total_amount || 0
        };
      });

      setAllReturns(formattedReturns);
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

  const metrics = useMemo(() => {
    const criticalCount = allReturns.filter(item => item.daysSinceMarked >= 10).length;
    const highPriorityCount = allReturns.filter(item => item.daysSinceMarked >= 7 && item.daysSinceMarked < 10).length;
    const totalValue = allReturns.reduce((sum, item) => sum + (item.returnValue || 0), 0);
    const claimedCount = claimedReturns.length;
    const claimedValue = claimedReturns.reduce((sum, item) => sum + (item.claimAmount || item.returnValue || 0), 0);
    return {
      totalReturns: allReturns.length,
      criticalCount,
      highPriorityCount,
      totalValue,
      claimedCount,
      claimedValue,
    };
  }, [allReturns, claimedReturns]);

  const currentTabData = activeTab === 'awaiting' ? allReturns : claimedReturns;
  
  const filteredReturns = useMemo(() => {
    if (!searchTerm.trim()) return currentTabData;
    const term = searchTerm.toLowerCase();
    return currentTabData.filter(returnItem => 
      returnItem.orderNumber.toLowerCase().includes(term) || 
      returnItem.customerName.toLowerCase().includes(term) || 
      (returnItem.customerPhone && returnItem.customerPhone.includes(searchTerm)) || 
      (returnItem.trackingId && returnItem.trackingId.toLowerCase().includes(term)) ||
      (returnItem.courier && returnItem.courier.toLowerCase().includes(term))
    );
  }, [currentTabData, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredReturns.length / ITEMS_PER_PAGE);
  const paginatedReturns = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredReturns.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredReturns, currentPage]);

  const handleSelectReturn = useCallback((returnId: string, checked: boolean) => {
    if (checked) {
      setSelectedReturns(prev => [...prev, returnId]);
    } else {
      setSelectedReturns(prev => prev.filter(id => id !== returnId));
    }
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedReturns(paginatedReturns.map(returnItem => returnItem.id));
    } else {
      setSelectedReturns([]);
    }
  }, [paginatedReturns]);

  const handleExportSelected = () => {
    const selectedData = filteredReturns.filter(returnItem => selectedReturns.includes(returnItem.id));
    if (selectedData.length === 0) {
      toast({
        title: "No items selected",
        description: "Please select items to export",
        variant: "destructive"
      });
      return;
    }
    const csvContent = [
      ['Order Number', 'Customer Name', 'Phone', 'Return Reason', 'Courier', 'Tracking ID', 'Marked Date', 'Days Overdue', 'Value'],
      ...selectedData.map(returnItem => [
        returnItem.orderNumber, 
        returnItem.customerName, 
        returnItem.customerPhone, 
        returnItem.returnReason, 
        returnItem.courier, 
        returnItem.trackingId, 
        returnItem.markedReturnedDate, 
        returnItem.daysSinceMarked.toString(), 
        `₨${returnItem.returnValue.toLocaleString()}`
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `returns-not-received-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleViewReturn = (orderNumber: string) => {
    const numericOrderNumber = orderNumber.replace(/^[A-Za-z]+-/, '');
    window.open(`/orders?search=${numericOrderNumber}`, '_blank');
  };

  const getPriorityColor = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'text-destructive font-bold';
    if (daysSinceMarked >= 7) return 'text-orange-600 dark:text-orange-400 font-semibold';
    if (daysSinceMarked >= 3) return 'text-yellow-600 dark:text-yellow-400 font-medium';
    return 'text-muted-foreground';
  };

  const getPriorityBadge = (daysSinceMarked: number) => {
    if (daysSinceMarked >= 10) return 'bg-destructive/10 text-destructive border-destructive/20';
    if (daysSinceMarked >= 7) return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
    if (daysSinceMarked >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
    return 'bg-muted text-muted-foreground border-border';
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Returns Not Received" 
        description="Track returns marked by courier but not yet at warehouse" 
        icon={RotateCcw}
        actions={
          <div className="hidden sm:block">
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
        }
      />

      {loading ? (
        <div className="flex flex-col justify-center items-center py-16 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading returns data...</p>
        </div>
      ) : (
        <>
          {/* Mobile Stats - Horizontal Scroll */}
          <div className="sm:hidden -mx-4 px-4 mb-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              <div className="flex-shrink-0 w-[140px] rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Package className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{metrics.totalReturns}</p>
                <p className="text-xs text-muted-foreground">In Route</p>
              </div>
              <div className="flex-shrink-0 w-[140px] rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  </div>
                </div>
                <p className="text-lg font-bold text-destructive">{metrics.criticalCount}</p>
                <p className="text-xs text-muted-foreground">Critical (10+)</p>
              </div>
              <div className="flex-shrink-0 w-[140px] rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">₨{(metrics.totalValue / 1000).toFixed(0)}k</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
              <div className="flex-shrink-0 w-[140px] rounded-xl border bg-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <FileWarning className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground">{metrics.claimedCount}</p>
                <p className="text-xs text-muted-foreground">Claimed</p>
              </div>
            </div>
          </div>

          {/* Desktop Stats Grid */}
          <div className="hidden sm:block">
            <StatsGrid columns={6}>
              <StatsCard 
                title="Returns in Route" 
                value={metrics.totalReturns.toString()} 
                icon={Package} 
                variant="warning" 
              />
              <StatsCard 
                title="Critical (10+ days)" 
                value={metrics.criticalCount.toString()} 
                icon={AlertTriangle} 
                variant="danger" 
              />
              <StatsCard 
                title="High Priority (7+ days)" 
                value={metrics.highPriorityCount.toString()} 
                icon={Clock} 
                variant="warning" 
              />
              <StatsCard 
                title="Value at Risk" 
                value={`₨${metrics.totalValue.toLocaleString()}`} 
                icon={DollarSign} 
                variant="default" 
              />
              <StatsCard 
                title="Total Claimed" 
                value={metrics.claimedCount.toString()} 
                icon={FileWarning} 
                variant="default" 
              />
              <StatsCard 
                title="Claimed Value" 
                value={`₨${metrics.claimedValue.toLocaleString()}`} 
                icon={DollarSign} 
                variant="default" 
              />
            </StatsGrid>
          </div>

          {/* Main Content Card */}
          <Card className="overflow-hidden">
            {/* Card Header with Tabs */}
            <div className="border-b bg-muted/30 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Tabs 
                  value={activeTab} 
                  onValueChange={(v) => { 
                    setActiveTab(v as 'awaiting' | 'claimed'); 
                    setCurrentPage(1); 
                    setSelectedReturns([]);
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 h-10">
                    <TabsTrigger value="awaiting" className="text-sm">
                      Awaiting ({allReturns.length})
                    </TabsTrigger>
                    <TabsTrigger value="claimed" className="text-sm">
                      Claimed ({claimedReturns.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="flex items-center gap-2 ml-auto">
                  {selectedReturns.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleExportSelected}>
                      <Download className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Export</span> ({selectedReturns.length})
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="sm:hidden"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Mobile Filters */}
              {showFilters && (
                <div className="mt-3 sm:hidden space-y-3 animate-fade-in">
                  <DatePickerWithRange date={dateRange} setDate={setDateRange} />
                </div>
              )}
            </div>

            <CardContent className="p-3 sm:p-6">
              {/* Search Bar */}
              <div className="mb-4 sm:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input 
                    placeholder="Search order, customer, phone, tracking..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-10 pr-10 h-11" 
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                      onClick={() => setSearchTerm('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Mobile Card View */}
              {isMobile ? (
                <div className="space-y-3">
                  {paginatedReturns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <RotateCcw className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {activeTab === 'claimed' ? 'No claimed returns' : 'No pending returns'}
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {activeTab === 'claimed' 
                          ? 'Returns filed as claims will appear here.'
                          : searchTerm 
                            ? 'No returns match your search.'
                            : 'No returns awaiting receipt.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      {paginatedReturns.map(returnItem => (
                        <ReturnNotReceivedCard
                          key={returnItem.id}
                          returnItem={returnItem}
                          isSelected={selectedReturns.includes(returnItem.id)}
                          onSelect={handleSelectReturn}
                          onView={handleViewReturn}
                          onClaim={handleOpenClaimDialog}
                          activeTab={activeTab}
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                /* Desktop Table View */
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">
                          <Checkbox 
                            checked={paginatedReturns.length > 0 && paginatedReturns.every(r => selectedReturns.includes(r.id))} 
                            onCheckedChange={handleSelectAll} 
                          />
                        </TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>{activeTab === 'claimed' ? 'Reason' : 'Return Status'}</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead>Tracking ID</TableHead>
                        <TableHead>{activeTab === 'claimed' ? 'Claimed Date' : 'Marked Date'}</TableHead>
                        <TableHead>{activeTab === 'claimed' ? 'Days Since' : 'Days Overdue'}</TableHead>
                        <TableHead>{activeTab === 'claimed' ? 'Claim Amount' : 'Value'}</TableHead>
                        <TableHead>{activeTab === 'claimed' ? 'Claim Status' : 'Priority'}</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedReturns.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12}>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
                                <RotateCcw className="h-7 w-7 text-muted-foreground" />
                              </div>
                              <h3 className="font-semibold text-foreground mb-1">
                                {activeTab === 'claimed' ? 'No claimed returns' : 'No pending returns'}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {activeTab === 'claimed' 
                                  ? 'Returns filed as claims against couriers will appear here.'
                                  : searchTerm 
                                    ? 'No overdue returns match your search criteria.'
                                    : 'Great news! There are no returns awaiting receipt at the warehouse.'}
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedReturns.map(returnItem => (
                          <TableRow key={returnItem.id} className="hover:bg-muted/30">
                            <TableCell>
                              <Checkbox 
                                checked={selectedReturns.includes(returnItem.id)} 
                                onCheckedChange={checked => handleSelectReturn(returnItem.id, checked as boolean)} 
                              />
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{returnItem.orderNumber}</TableCell>
                            <TableCell>
                              <p className="font-medium text-foreground">{returnItem.customerName}</p>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{returnItem.customerPhone || '-'}</TableCell>
                            <TableCell className="max-w-[140px]">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block truncate text-muted-foreground cursor-help">
                                      {returnItem.returnReason}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-[300px]">{returnItem.returnReason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-foreground">{returnItem.courier}</TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{returnItem.trackingId || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{returnItem.markedReturnedDate}</TableCell>
                            <TableCell>
                              <span className={activeTab === 'claimed' ? 'text-muted-foreground' : getPriorityColor(returnItem.daysSinceMarked)}>
                                {returnItem.daysSinceMarked} days
                              </span>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">
                              ₨{(activeTab === 'claimed' && returnItem.claimAmount ? returnItem.claimAmount : returnItem.returnValue).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {activeTab === 'claimed' ? (
                                <Badge variant="outline" className={
                                  returnItem.claimStatus === 'settled' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400' :
                                  returnItem.claimStatus === 'approved' ? 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400' :
                                  returnItem.claimStatus === 'rejected' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' :
                                  'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
                                }>
                                  {returnItem.claimStatus || 'pending'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={getPriorityBadge(returnItem.daysSinceMarked)}>
                                  {returnItem.daysSinceMarked >= 10 ? 'Critical' : 
                                   returnItem.daysSinceMarked >= 7 ? 'High' : 
                                   returnItem.daysSinceMarked >= 3 ? 'Medium' : 'Low'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleViewReturn(returnItem.orderNumber)}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View order</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {activeTab === 'awaiting' && returnItem.daysSinceMarked >= 7 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button 
                                          variant="outline" 
                                          size="icon"
                                          className="h-8 w-8 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                          onClick={() => handleOpenClaimDialog(returnItem)}
                                        >
                                          <FileWarning className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>File courier claim</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {filteredReturns.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground order-2 sm:order-1">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredReturns.length)} of {filteredReturns.length}
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline ml-1">Previous</span>
                    </Button>
                    <span className="text-sm text-muted-foreground px-2 min-w-[80px] text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <span className="hidden sm:inline mr-1">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Claim Sheet */}
          <ClaimSheet
            open={claimDialogOpen}
            onOpenChange={setClaimDialogOpen}
            order={selectedOrderForClaim ? {
              id: selectedOrderForClaim.id,
              orderNumber: selectedOrderForClaim.orderNumber,
              customerName: selectedOrderForClaim.customerName,
              returnValue: selectedOrderForClaim.returnValue,
              trackingId: selectedOrderForClaim.trackingId,
              courier: selectedOrderForClaim.courier,
            } : null}
            onSuccess={handleClaimSuccess}
          />
        </>
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground h-12 w-12"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </PageContainer>
  );
};

export default ReturnsNotReceived;
