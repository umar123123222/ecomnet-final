import React, { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, RefreshCw, X, ArrowUpDown } from 'lucide-react';

interface OrderFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  courierFilter: string;
  onCourierChange: (value: string) => void;
  couriers: Array<{ code: string; name: string }>;
  sortOrder: 'latest' | 'oldest';
  onSortOrderChange: (value: 'latest' | 'oldest') => void;
  onRefresh: () => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

export const OrderFiltersBar = memo(({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  courierFilter,
  onCourierChange,
  couriers,
  sortOrder,
  onSortOrderChange,
  onRefresh,
  onClearFilters,
  isLoading,
}: OrderFiltersProps) => {
  const hasActiveFilters = statusFilter !== 'all' || courierFilter !== 'all' || searchValue || sortOrder !== 'latest';

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search orders, customers, tracking..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="booked">Booked</SelectItem>
          <SelectItem value="dispatched">Dispatched</SelectItem>
          <SelectItem value="delivered">Delivered</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="returned">Returned</SelectItem>
        </SelectContent>
      </Select>

      {/* Courier Filter */}
      <Select value={courierFilter} onValueChange={onCourierChange}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Courier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Couriers</SelectItem>
          <SelectItem value="none">No Courier</SelectItem>
          {couriers.map((courier) => (
            <SelectItem key={courier.code} value={courier.code}>
              {courier.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sort Order Filter */}
      <Select value={sortOrder} onValueChange={(v) => onSortOrderChange(v as 'latest' | 'oldest')}>
        <SelectTrigger className="w-[120px] h-9">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="latest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
        </SelectContent>
      </Select>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 px-3"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-9 px-3"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
    </div>
  );
});

OrderFiltersBar.displayName = 'OrderFiltersBar';
