import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  Package, 
  Plus, 
  ChevronDown,
  Clock,
  CheckCircle,
  Truck,
  X,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { FormattedOrder, SummaryData, OrderFilters } from '@/hooks/useOrdersData';
import { cn } from '@/lib/utils';

interface OrdersMobileViewProps {
  orders: FormattedOrder[];
  totalCount: number;
  summaryData: SummaryData;
  loading: boolean;
  searchInput: string;
  onSearchChange: (value: string) => void;
  filters: OrderFilters;
  updateFilter: (key: string, value: any) => void;
  resetFilters: () => void;
  couriers: Array<{ id: string; name: string; code: string }>;
  onViewDetails: (order: FormattedOrder) => void;
  onNewOrder: () => void;
  onRefresh: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  activeFiltersCount: number;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
  booked: { label: 'Booked', className: 'bg-orange-100 text-orange-800 border-orange-200', icon: Package },
  dispatched: { label: 'Dispatched', className: 'bg-purple-100 text-purple-800 border-purple-200', icon: Truck },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  returned: { label: 'Returned', className: 'bg-red-100 text-red-800 border-red-200', icon: X },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800 border-gray-200', icon: X },
};

const QUICK_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'booked', label: 'Booked' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
];

const OrdersMobileView: React.FC<OrdersMobileViewProps> = ({
  orders,
  totalCount,
  summaryData,
  loading,
  searchInput,
  onSearchChange,
  filters,
  updateFilter,
  resetFilters,
  couriers,
  onViewDetails,
  onNewOrder,
  onRefresh,
  hasMore,
  onLoadMore,
  activeFiltersCount,
}) => {
  const formatCurrency = (amount: number) => {
    return `₨${amount?.toLocaleString() || 0}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short' 
    });
  };

  // Calculate pending count from totalOrders minus other statuses
  const pendingCount = summaryData.totalOrders - summaryData.booked - summaryData.dispatched - summaryData.delivered - summaryData.cancelled - summaryData.returns;

  return (
    <div className="flex flex-col gap-3 p-3 pb-24">
      {/* Header with New Order Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Orders</h1>
          <p className="text-xs text-muted-foreground">{totalCount.toLocaleString()} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onRefresh} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={onNewOrder} size="sm" className="gap-1.5 h-9">
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Compact Metrics - 3 key stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-foreground">{Math.max(0, pendingCount)}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-orange-600">{summaryData.booked || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Booked</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600">{summaryData.delivered || 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Delivered</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Status Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {QUICK_FILTERS.map((filter) => (
          <Button
            key={filter.id}
            variant={filters.status === filter.id || (filter.id === 'all' && filters.status === 'all') ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-3 text-xs whitespace-nowrap shrink-0"
            onClick={() => updateFilter('status', filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {/* Search + Filter Sheet */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant={activeFiltersCount > 0 ? 'default' : 'outline'}
              size="icon"
              className="h-10 w-10 shrink-0 relative"
            >
              <Filter className="h-4 w-4" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filter Orders</SheetTitle>
              <SheetDescription>Apply filters to refine your order view</SheetDescription>
            </SheetHeader>

            <div className="space-y-6 py-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold">Order Status</Label>
                <Select value={filters.status} onValueChange={value => updateFilter('status', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="booked">Booked</SelectItem>
                    <SelectItem value="dispatched">Dispatched</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Courier</Label>
                <Select value={filters.courier} onValueChange={value => updateFilter('courier', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Couriers</SelectItem>
                    <SelectItem value="none">No Courier</SelectItem>
                    {couriers.map(c => (
                      <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Date Range</Label>
                <DatePickerWithRange
                  date={filters.statusDateRange}
                  setDate={(range) => updateFilter('statusDateRange', range)}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Amount Range
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.amountMin ?? ''}
                    onChange={e => updateFilter('amountMin', e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-background"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.amountMax ?? ''}
                    onChange={e => updateFilter('amountMax', e.target.value ? Number(e.target.value) : undefined)}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">City</Label>
                <Input
                  placeholder="Filter by city..."
                  value={filters.city === 'all' ? '' : filters.city}
                  onChange={e => updateFilter('city', e.target.value || 'all')}
                  className="bg-background"
                />
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Has Tracking ID</Label>
                <Select value={filters.hasTrackingId} onValueChange={value => updateFilter('hasTrackingId', value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="yes">With Tracking ID</SelectItem>
                    <SelectItem value="no">Without Tracking ID</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {activeFiltersCount > 0 && (
                <Button variant="outline" onClick={resetFilters} className="w-full">
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Order List - Card Based */}
      <div className="space-y-2">
        {loading && orders.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No orders found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const orderNum = order.orderNumber?.replace('SHOP-', '') || 'N/A';

            return (
              <Card 
                key={order.id} 
                className="bg-card active:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => onViewDetails(order)}
              >
                <CardContent className="p-3">
                  {/* Top Row: Order Number + Status */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">#{orderNum}</span>
                      {order.courier && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {order.courier}
                        </Badge>
                      )}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs px-2 py-0.5 border', statusConfig.className)}
                    >
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Customer Info */}
                  <div className="text-sm text-foreground truncate mb-1">
                    {order.customer || 'Unknown Customer'}
                  </div>

                  {/* Bottom Row: City, Amount, Date */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate max-w-[120px]">{order.city || 'N/A'}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{formatCurrency(order.totalPrice)}</span>
                      <span>{formatDate(order.createdAtISO)}</span>
                    </div>
                  </div>

                  {/* Tracking ID if available */}
                  {order.trackingId && (
                    <div className="mt-2 pt-2 border-t text-xs text-muted-foreground flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      <span className="font-mono">{order.trackingId}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Load More Button */}
      {hasMore && orders.length > 0 && (
        <Button 
          variant="outline" 
          onClick={onLoadMore}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Load More
            </>
          )}
        </Button>
      )}

      {/* Bottom Info */}
      {orders.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-1">
          Showing {orders.length} of {totalCount.toLocaleString()} orders
        </p>
      )}
    </div>
  );
};

export default OrdersMobileView;
