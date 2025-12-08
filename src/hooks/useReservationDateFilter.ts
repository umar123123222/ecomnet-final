import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DateRange } from "react-day-picker";
import { startOfDay, endOfDay } from "date-fns";

export interface ProductReservation {
  product_id: string;
  reserved_quantity: number;
}

export interface PackagingReservation {
  packaging_item_id: string;
  reserved_quantity: number;
}

export function useReservationDateFilter() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const isFiltered = dateRange?.from !== undefined;

  const startDate = dateRange?.from ? startOfDay(dateRange.from).toISOString() : null;
  const endDate = dateRange?.to ? endOfDay(dateRange.to).toISOString() : dateRange?.from ? endOfDay(dateRange.from).toISOString() : null;

  // Fetch product reservations filtered by date
  const { data: productReservations, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["product-reservations-by-date", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_product_reservations_by_date', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      
      // Convert to a map for easy lookup
      const map = new Map<string, number>();
      (data || []).forEach((item: ProductReservation) => {
        map.set(item.product_id, Number(item.reserved_quantity));
      });
      return map;
    },
    enabled: isFiltered,
  });

  // Fetch packaging reservations filtered by date
  const { data: packagingReservations, isLoading: isLoadingPackaging } = useQuery({
    queryKey: ["packaging-reservations-by-date", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_packaging_reservations_by_date', {
        p_start_date: startDate,
        p_end_date: endDate
      });
      if (error) throw error;
      
      // Convert to a map for easy lookup
      const map = new Map<string, number>();
      (data || []).forEach((item: PackagingReservation) => {
        map.set(item.packaging_item_id, Number(item.reserved_quantity));
      });
      return map;
    },
    enabled: isFiltered,
  });

  const clearDateFilter = () => setDateRange(undefined);

  return {
    dateRange,
    setDateRange,
    isFiltered,
    productReservations,
    packagingReservations,
    isLoadingProducts,
    isLoadingPackaging,
    clearDateFilter,
  };
}
