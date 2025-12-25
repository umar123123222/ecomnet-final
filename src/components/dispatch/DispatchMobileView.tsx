import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Search, Filter, Truck, Package } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';

interface DispatchMobileViewProps {
  onOpenScanner: () => void;
  metrics: {
    totalDispatches: number;
    worthOfDispatches: number;
    mostUsedCourier: string;
  };
  searchTerm: string;
  onSearchChange: (value: string) => void;
  courierFilter: string;
  onCourierFilterChange: (value: string) => void;
  couriers: Array<{ id: string; name: string; code: string }>;
  dispatches: Array<{
    id: string;
    tracking_id?: string;
    courier?: string;
    dispatch_date?: string;
    created_at: string;
    orders?: {
      order_number?: string;
      customer_name?: string;
      total_amount?: number;
    };
  }>;
  loading: boolean;
  canUseDispatchActions: boolean;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const DispatchMobileView: React.FC<DispatchMobileViewProps> = ({
  onOpenScanner,
  metrics,
  searchTerm,
  onSearchChange,
  courierFilter,
  onCourierFilterChange,
  couriers,
  dispatches,
  loading,
  canUseDispatchActions,
  dateRange,
  onDateRangeChange,
}) => {
  const [showFilters, setShowFilters] = React.useState(false);

  return (
    <div className="flex flex-col gap-3 p-3 pb-24">
      {/* Hero Scan Button */}
      {canUseDispatchActions && (
        <Button
          onClick={onOpenScanner}
          size="lg"
          className="w-full h-14 text-lg font-semibold gap-3 bg-primary hover:bg-primary/90 shadow-lg"
        >
          <Camera className="h-6 w-6" />
          Scan to Dispatch
        </Button>
      )}

      {/* Compact Metrics */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-foreground">{metrics.totalDispatches}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Dispatches</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-primary truncate">{metrics.mostUsedCourier}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Top Courier</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600">₨{(metrics.worthOfDispatches / 1000).toFixed(0)}K</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Worth</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Collapsible Filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-2">
          <DatePickerWithRange 
            date={dateRange} 
            setDate={onDateRangeChange} 
            className="w-full"
          />
          <Select value={courierFilter} onValueChange={onCourierFilterChange}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="All Couriers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Couriers</SelectItem>
              {couriers.map((courier) => (
                <SelectItem key={courier.id} value={courier.name}>
                  {courier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CollapsibleContent>
      </Collapsible>

      {/* Simplified Order List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : dispatches.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No dispatches found</p>
            </CardContent>
          </Card>
        ) : (
          dispatches.slice(0, 50).map((dispatch) => {
            const orderNumber = dispatch.orders?.order_number?.replace('SHOP-', '') || 'N/A';
            const dispatchDate = dispatch.dispatch_date
              ? new Date(dispatch.dispatch_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
              : new Date(dispatch.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

            return (
              <Card key={dispatch.id} className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-semibold text-sm">{orderNumber}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {dispatch.courier || 'N/A'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{dispatch.orders?.customer_name || 'Unknown'}</span>
                    <span>{dispatchDate}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {dispatches.length > 50 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          Showing 50 of {dispatches.length} dispatches
        </p>
      )}
    </div>
  );
};

export default DispatchMobileView;
