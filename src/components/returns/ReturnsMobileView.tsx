import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Camera, Search, Filter, RotateCcw, Package } from 'lucide-react';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { useCurrency } from '@/hooks/useCurrency';

interface ReturnsMobileViewProps {
  onOpenScanner: () => void;
  metrics: {
    returnedCount: number;
    returnedWorth: string;
  };
  searchTerm: string;
  onSearchChange: (value: string) => void;
  returns: Array<{
    id: string;
    tracking_id?: string;
    worth?: number;
    return_status?: string;
    created_at: string;
    orders?: {
      order_number?: string;
      customer_name?: string;
    };
  }>;
  loading: boolean;
  canUseReturnActions: boolean;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const ReturnsMobileView: React.FC<ReturnsMobileViewProps> = ({
  onOpenScanner,
  metrics,
  searchTerm,
  onSearchChange,
  returns,
  loading,
  canUseReturnActions,
  dateRange,
  onDateRangeChange,
}) => {
  const [showFilters, setShowFilters] = React.useState(false);
  const { formatCurrency } = useCurrency();

  // Calculate active filter count
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (dateRange?.from || dateRange?.to) count++;
    return count;
  }, [dateRange]);
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'received':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'claimed':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-orange-100 text-orange-800 border-orange-200';
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 pb-24">
      {/* Hero Scan Button */}
      {canUseReturnActions && (
        <Button
          onClick={onOpenScanner}
          size="lg"
          className="w-full h-14 text-lg font-semibold gap-3 bg-primary hover:bg-primary/90 shadow-lg"
        >
          <Camera className="h-6 w-6" />
          Scan to Return
        </Button>
      )}

      {/* Compact Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-foreground">{metrics.returnedCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total Returns</div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{metrics.returnedWorth}</div>
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
          className={`h-10 w-10 shrink-0 relative transition-all active:scale-95 ${showFilters || activeFilterCount > 0 ? 'border-primary bg-primary/5' : ''}`}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className={`h-4 w-4 ${activeFilterCount > 0 ? 'text-primary' : ''}`} />
          {activeFilterCount > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary">
              {activeFilterCount}
            </Badge>
          )}
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
        </CollapsibleContent>
      </Collapsible>

      {/* Simplified Order List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : returns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No returns found</p>
            </CardContent>
          </Card>
        ) : (
          returns.slice(0, 50).map((returnItem) => {
            const orderNumber = returnItem.orders?.order_number?.replace('SHOP-', '') || 'N/A';
            const returnDate = new Date(returnItem.created_at).toLocaleDateString('en-GB', { 
              day: '2-digit', 
              month: 'short' 
            });

            return (
              <Card key={returnItem.id} className="bg-card">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono font-semibold text-sm">{orderNumber}</span>
                    </div>
                    <Badge className={`text-xs ${getStatusColor(returnItem.return_status)}`}>
                      {returnItem.return_status || 'in_transit'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                    <span>{returnItem.orders?.customer_name || 'Unknown'}</span>
                    <span>{formatCurrency(returnItem.worth || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {returns.length > 50 && (
        <p className="text-center text-xs text-muted-foreground py-2">
          Showing 50 of {returns.length} returns
        </p>
      )}
    </div>
  );
};

export default ReturnsMobileView;
