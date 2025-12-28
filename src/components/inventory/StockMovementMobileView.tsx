import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Download,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  ChevronDown,
  ChevronRight,
  Box,
  Truck,
  Building2,
  Filter,
  X,
  RefreshCw,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface UnifiedMovement {
  id: string;
  name: string;
  sku: string;
  category: 'product' | 'packaging';
  quantity: number;
  movement_type: string;
  reason: string;
  notes: string;
  image_url?: string;
  created_at: string;
  performed_by: string;
  outlet_name: string;
}

interface OrderBreakdown {
  order_id: string;
  order_number: string;
  qty: number;
}

interface DispatchSummary {
  id: string;
  type: 'summary';
  date: string;
  productItems: Record<string, { name: string; sku: string; total_qty: number }>;
  packagingItems: Record<string, { name: string; sku: string; total_qty: number }>;
  totalProductUnits: number;
  totalPackagingUnits: number;
  uniqueProducts: number;
  uniquePackaging: number;
  orderCount: number;
}

type DisplayItem = UnifiedMovement | DispatchSummary;

interface StockMovementMobileViewProps {
  displayItems: DisplayItem[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  movementTypeFilter: string;
  onMovementTypeChange: (value: string) => void;
  outletFilter: string;
  onOutletChange: (value: string) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (value: DateRange | undefined) => void;
  outlets: Array<{ id: string; name: string; outlet_type: string }>;
  onExport: () => void;
  onRefresh: () => void;
  expandedSummaries: Set<string>;
  onToggleSummary: (id: string) => void;
  onImageClick: (url: string) => void;
  stats: {
    totalMovements: number;
    totalProductsDispatched: number;
    totalPackagingUsed: number;
    netChange: number;
  };
  expandedItemOrders: Set<string>;
  onToggleItemOrders: (itemKey: string, summaryDate: string, itemId: string, category: 'product' | 'packaging') => void;
  orderBreakdownCache: Record<string, OrderBreakdown[]>;
  loadingOrdersFor: string | null;
}

const QUICK_FILTERS = [
  { label: "All", value: "all" },
  { label: "Dispatch", value: "sale" },
  { label: "Adjustments", value: "adjustment" },
  { label: "Returns", value: "return" },
  { label: "Transfers", value: "transfer_in" },
];

export function StockMovementMobileView({
  displayItems,
  loading,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  movementTypeFilter,
  onMovementTypeChange,
  outletFilter,
  onOutletChange,
  dateRange,
  onDateRangeChange,
  outlets,
  onExport,
  onRefresh,
  expandedSummaries,
  onToggleSummary,
  onImageClick,
  stats,
  expandedItemOrders,
  onToggleItemOrders,
  orderBreakdownCache,
  loadingOrdersFor,
}: StockMovementMobileViewProps) {
  const [filterOpen, setFilterOpen] = React.useState(false);

  const hasActiveFilters = categoryFilter !== "all" || outletFilter !== "all" || dateRange?.from;

  const clearFilters = () => {
    onCategoryChange("all");
    onOutletChange("all");
    onDateRangeChange(undefined);
    setFilterOpen(false);
  };

  const isSummary = (item: DisplayItem): item is DispatchSummary => {
    return 'type' in item && item.type === 'summary';
  };

  const renderSummaryCard = (summary: DispatchSummary) => {
    const isExpanded = expandedSummaries.has(summary.id);
    const productEntries = Object.entries(summary.productItems);
    const packagingEntries = Object.entries(summary.packagingItems);

    return (
      <Card
        key={summary.id}
        className="border-l-4 border-l-primary bg-primary/5"
      >
        <CardContent className="p-4">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => onToggleSummary(summary.id)}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">Daily Dispatch</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(summary.date), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary">
                {summary.orderCount} orders
              </Badge>
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="flex gap-4 mt-3 text-sm">
            {summary.uniqueProducts > 0 && (
              <div className="flex items-center gap-1.5">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-destructive font-medium">
                  -{summary.totalProductUnits}
                </span>
                <span className="text-muted-foreground">units</span>
              </div>
            )}
            {summary.uniquePackaging > 0 && (
              <div className="flex items-center gap-1.5">
                <Box className="h-4 w-4 text-muted-foreground" />
                <span className="text-destructive font-medium">
                  -{summary.totalPackagingUnits}
                </span>
                <span className="text-muted-foreground">units</span>
              </div>
            )}
          </div>

          {isExpanded && (
            <div className="mt-4 space-y-1 border-t pt-3">
              {productEntries.map(([id, product]) => {
                const itemKey = `${summary.id}-product-${id}`;
                const isOrdersExpanded = expandedItemOrders.has(itemKey);
                const orders = orderBreakdownCache[itemKey] || [];
                const isLoadingOrders = loadingOrdersFor === itemKey;

                return (
                  <div key={id} className="space-y-1">
                    <div
                      className="flex items-center justify-between py-2 text-sm cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                      onClick={() => onToggleItemOrders(itemKey, summary.date, id, 'product')}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isLoadingOrders ? (
                          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                        ) : isOrdersExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{product.name}</span>
                      </div>
                      <span className="text-destructive font-medium shrink-0 ml-2">
                        -{product.total_qty}
                      </span>
                    </div>
                    {isOrdersExpanded && orders.length > 0 && (
                      <div className="ml-8 pl-2 border-l-2 border-muted space-y-1">
                        {orders.map((order, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1">
                            <span className="text-muted-foreground">Order: <span className="text-foreground font-medium">{order.order_number}</span></span>
                            <span className="text-destructive">-{order.qty}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isOrdersExpanded && orders.length === 0 && !isLoadingOrders && (
                      <div className="ml-8 pl-2 border-l-2 border-muted">
                        <span className="text-xs text-muted-foreground">No order details available</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {packagingEntries.map(([id, packaging]) => {
                const itemKey = `${summary.id}-packaging-${id}`;
                const isOrdersExpanded = expandedItemOrders.has(itemKey);
                const orders = orderBreakdownCache[itemKey] || [];
                const isLoadingOrders = loadingOrdersFor === itemKey;

                return (
                  <div key={id} className="space-y-1">
                    <div
                      className="flex items-center justify-between py-2 text-sm cursor-pointer hover:bg-muted/50 rounded-md px-2 -mx-2"
                      onClick={() => onToggleItemOrders(itemKey, summary.date, id, 'packaging')}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isLoadingOrders ? (
                          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0" />
                        ) : isOrdersExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{packaging.name}</span>
                      </div>
                      <span className="text-destructive font-medium shrink-0 ml-2">
                        -{packaging.total_qty}
                      </span>
                    </div>
                    {isOrdersExpanded && orders.length > 0 && (
                      <div className="ml-8 pl-2 border-l-2 border-muted space-y-1">
                        {orders.map((order, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1">
                            <span className="text-muted-foreground">Order: <span className="text-foreground font-medium">{order.order_number}</span></span>
                            <span className="text-destructive">-{order.qty}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isOrdersExpanded && orders.length === 0 && !isLoadingOrders && (
                      <div className="ml-8 pl-2 border-l-2 border-muted">
                        <span className="text-xs text-muted-foreground">No order details available</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderMovementCard = (movement: UnifiedMovement) => {
    return (
      <Card key={movement.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant={movement.category === 'product' ? 'default' : 'secondary'}
                  className="gap-1 text-xs"
                >
                  {movement.category === 'product' ? (
                    <Package className="h-3 w-3" />
                  ) : (
                    <Box className="h-3 w-3" />
                  )}
                  {movement.category === 'product' ? 'Product' : 'Packaging'}
                </Badge>
                <Badge variant="outline" className="text-xs capitalize">
                  {movement.movement_type}
                </Badge>
              </div>
              <p className="font-semibold truncate">{movement.name}</p>
              <p className="text-xs text-muted-foreground">{movement.sku}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {movement.quantity > 0 ? (
                <TrendingUp className="h-5 w-5 text-success" />
              ) : (
                <TrendingDown className="h-5 w-5 text-destructive" />
              )}
              <span
                className={`text-lg font-bold ${
                  movement.quantity > 0 ? "text-success" : "text-destructive"
                }`}
              >
                {movement.quantity > 0 ? "+" : ""}
                {movement.quantity}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(movement.created_at), "MMM dd, hh:mm a")}
            </div>
            <div className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {movement.outlet_name || "-"}
            </div>
            {movement.image_url && (
              <button
                onClick={() => onImageClick(movement.image_url!)}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ImageIcon className="h-3 w-3" />
                View Image
              </button>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{movement.reason}</span>
            <span className="text-muted-foreground">{movement.performed_by}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col h-full pb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div>
          <h1 className="text-xl font-bold">Stock Movements</h1>
          <p className="text-xs text-muted-foreground">
            {displayItems.length} movements found
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onExport}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Total Movements</p>
          <p className="text-lg font-bold">{stats.totalMovements}</p>
        </div>
        <div className="bg-destructive/10 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">Dispatched</p>
          <p className="text-lg font-bold text-destructive">
            -{stats.totalProductsDispatched}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="px-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative shrink-0">
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[70vh]">
              <SheetHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle>Filters</SheetTitle>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="h-4 w-4 mr-1" />
                      Clear All
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={categoryFilter} onValueChange={onCategoryChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="product">Products Only</SelectItem>
                      <SelectItem value="packaging">Packaging Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Outlet</label>
                  <Select value={outletFilter} onValueChange={onOutletChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outlets</SelectItem>
                      {outlets?.map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date Range</label>
                  <DatePickerWithRange date={dateRange} setDate={onDateRangeChange} />
                </div>
                <Button className="w-full mt-4" onClick={() => setFilterOpen(false)}>
                  Apply Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {QUICK_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={movementTypeFilter === filter.value ? "default" : "outline"}
              size="sm"
              className="shrink-0 h-8"
              onClick={() => onMovementTypeChange(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-3">
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-6 w-12" />
                  </div>
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No movements found</h3>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              Try adjusting your filters or search term.
            </p>
          </div>
        ) : (
          displayItems.map((item) =>
            isSummary(item) ? renderSummaryCard(item) : renderMovementCard(item)
          )
        )}
      </div>
    </div>
  );
}
