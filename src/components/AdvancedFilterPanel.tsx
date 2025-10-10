import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Filter, X, Save, Bookmark, ChevronDown, ChevronUp } from 'lucide-react';
import { FilterState, FilterPreset } from '@/hooks/useAdvancedFilters';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

interface AdvancedFilterPanelProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: any) => void;
  onCustomFilterChange?: (key: string, value: any) => void;
  onReset: () => void;
  activeFiltersCount: number;
  statusOptions?: Array<{ value: string; label: string }>;
  categoryOptions?: Array<{ value: string; label: string }>;
  showAmountFilter?: boolean;
  showDateFilter?: boolean;
  customFilters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  savedPresets?: FilterPreset[];
  onSavePreset?: (name: string) => void;
  onLoadPreset?: (presetId: string) => void;
  onDeletePreset?: (presetId: string) => void;
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  filters,
  onFilterChange,
  onCustomFilterChange,
  onReset,
  activeFiltersCount,
  statusOptions,
  categoryOptions,
  showAmountFilter = false,
  showDateFilter = false,
  customFilters = [],
  savedPresets = [],
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const { toast } = useToast();

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a preset name',
        variant: 'destructive',
      });
      return;
    }
    onSavePreset?.(presetName);
    setPresetName('');
    setIsSaveDialogOpen(false);
    toast({
      title: 'Success',
      description: 'Filter preset saved',
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Advanced Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} active</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onReset}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
            {onSavePreset && (
              <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-1" />
                    Save Preset
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Filter Preset</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="preset-name">Preset Name</Label>
                      <Input
                        id="preset-name"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="e.g., Pending Orders Last Week"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSavePreset}>Save</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saved Presets */}
        {savedPresets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium flex items-center gap-1">
              <Bookmark className="h-4 w-4" />
              Saved Presets:
            </span>
            {savedPresets.map(preset => (
              <div key={preset.id} className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onLoadPreset?.(preset.id)}
                >
                  {preset.name}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeletePreset?.(preset.id)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Basic Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => onFilterChange('search', e.target.value)}
            />
          </div>

          {statusOptions && (
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filters.status} onValueChange={(value) => onFilterChange('status', value)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {categoryOptions && (
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={filters.category} onValueChange={(value) => onFilterChange('category', value)}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categoryOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showDateFilter && (
            <div>
              <Label>Date Range</Label>
              <DatePickerWithRange
                date={filters.dateRange}
                setDate={(date) => onFilterChange('dateRange', date)}
              />
            </div>
          )}
        </div>

        {/* Advanced Filters - Collapsible */}
        {(showAmountFilter || customFilters.length > 0) && (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full">
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Advanced Filters
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Show Advanced Filters
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {showAmountFilter && (
                  <>
                    <div>
                      <Label htmlFor="amount-min">Min Amount</Label>
                      <Input
                        id="amount-min"
                        type="number"
                        placeholder="Min"
                        value={filters.amountMin || ''}
                        onChange={(e) => onFilterChange('amountMin', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount-max">Max Amount</Label>
                      <Input
                        id="amount-max"
                        type="number"
                        placeholder="Max"
                        value={filters.amountMax || ''}
                        onChange={(e) => onFilterChange('amountMax', e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </div>
                  </>
                )}

                {customFilters.map(filter => (
                  <div key={filter.key}>
                    <Label htmlFor={filter.key}>{filter.label}</Label>
                    <Select
                      value={filters.customValues?.[filter.key] || 'all'}
                      onValueChange={(value) => onCustomFilterChange?.(filter.key, value)}
                    >
                      <SelectTrigger id={filter.key}>
                        <SelectValue placeholder={`All ${filter.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All {filter.label}</SelectItem>
                        {filter.options.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
