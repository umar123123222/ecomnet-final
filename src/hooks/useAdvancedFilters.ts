import { useState, useEffect, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { isWithinInterval, parseISO } from 'date-fns';

export interface FilterConfig {
  searchFields: string[];
  statusField?: string;
  dateField?: string;
  categoryField?: string;
  amountField?: string;
  customFilters?: Record<string, (item: any, value: any) => boolean>;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

export interface FilterState {
  search: string;
  status: string;
  category: string;
  dateRange?: DateRange;
  amountMin?: number;
  amountMax?: number;
  customValues?: Record<string, any>;
}

export const useAdvancedFilters = <T extends Record<string, any>>(
  data: T[],
  config: FilterConfig
) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: 'all',
  });

  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(() => {
    const saved = localStorage.getItem('filterPresets');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('filterPresets', JSON.stringify(savedPresets));
  }, [savedPresets]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = config.searchFields.some(field => {
          const value = field.split('.').reduce((obj, key) => obj?.[key], item);
          return String(value || '').toLowerCase().includes(searchLower);
        });
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all' && config.statusField) {
        const statusValue = config.statusField.split('.').reduce((obj, key) => obj?.[key], item);
        if (statusValue !== filters.status) return false;
      }

      // Category filter
      if (filters.category !== 'all' && config.categoryField) {
        const categoryValue = config.categoryField.split('.').reduce((obj, key) => obj?.[key], item);
        if (categoryValue !== filters.category) return false;
      }

      // Date range filter
      if (filters.dateRange?.from && config.dateField) {
        const dateValue = config.dateField.split('.').reduce((obj, key) => obj?.[key], item);
        if (dateValue) {
          const itemDate = typeof dateValue === 'string' ? parseISO(dateValue) : dateValue;
          if (filters.dateRange.to) {
            if (!isWithinInterval(itemDate, { start: filters.dateRange.from, end: filters.dateRange.to })) {
              return false;
            }
          } else if (itemDate < filters.dateRange.from) {
            return false;
          }
        }
      }

      // Amount range filter
      if (config.amountField && (filters.amountMin !== undefined || filters.amountMax !== undefined)) {
        const amountValue = config.amountField.split('.').reduce((obj, key) => obj?.[key], item);
        const amount = typeof amountValue === 'string' ? parseFloat(amountValue) : amountValue;
        if (filters.amountMin !== undefined && amount < filters.amountMin) return false;
        if (filters.amountMax !== undefined && amount > filters.amountMax) return false;
      }

      // Custom filters
      if (config.customFilters && filters.customValues) {
        for (const [key, filterFn] of Object.entries(config.customFilters)) {
          const value = filters.customValues[key];
          if (value !== undefined && value !== 'all' && !filterFn(item, value)) {
            return false;
          }
        }
      }

      return true;
    });
  }, [data, filters, config]);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateCustomFilter = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      customValues: { ...prev.customValues, [key]: value }
    }));
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      category: 'all',
    });
  };

  const savePreset = (name: string) => {
    const preset: FilterPreset = {
      id: `preset_${Date.now()}`,
      name,
      filters: { ...filters }
    };
    setSavedPresets(prev => [...prev, preset]);
  };

  const loadPreset = (presetId: string) => {
    const preset = savedPresets.find(p => p.id === presetId);
    if (preset) {
      setFilters(preset.filters);
    }
  };

  const deletePreset = (presetId: string) => {
    setSavedPresets(prev => prev.filter(p => p.id !== presetId));
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.dateRange?.from) count++;
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) count++;
    if (filters.customValues) {
      count += Object.values(filters.customValues).filter(v => v && v !== 'all').length;
    }
    return count;
  };

  return {
    filters,
    filteredData,
    updateFilter,
    updateCustomFilter,
    resetFilters,
    savedPresets,
    savePreset,
    loadPreset,
    deletePreset,
    activeFiltersCount: getActiveFiltersCount(),
  };
};
