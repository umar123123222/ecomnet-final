import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Download, TrendingUp, TrendingDown, ArrowLeftRight, Package, Calendar, ChevronDown, ChevronRight, Image as ImageIcon, Box, Truck, Building2 } from "lucide-react";
import { format } from "date-fns";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";

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
  from_outlet?: string;
  to_outlet?: string;
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
  productItems: Record<string, { name: string; sku: string; total_qty: number; orders?: OrderBreakdown[] }>;
  packagingItems: Record<string, { name: string; sku: string; total_qty: number; orders?: OrderBreakdown[] }>;
  totalProductUnits: number;
  totalPackagingUnits: number;
  uniqueProducts: number;
  uniquePackaging: number;
  orderCount: number;
}

type DisplayItem = UnifiedMovement | DispatchSummary;

export default function StockMovementHistory() {
  const { permissions } = useUserRoles();
  const [searchTerm, setSearchTerm] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [outletFilter, setOutletFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());
  const [expandedItemOrders, setExpandedItemOrders] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch outlets for filter
  const { data: outlets } = useQuery({
    queryKey: ["outlets-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("id, name, outlet_type")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: permissions.canViewStockMovements,
  });

  // Fetch daily dispatch summaries (pre-aggregated data)
  const { data: dispatchSummaries, isLoading: loadingSummaries } = useQuery({
    queryKey: ["dispatch-summaries", dateRange],
    queryFn: async () => {
      let query = supabase
        .from("daily_dispatch_summaries")
        .select("*")
        .order("summary_date", { ascending: false })
        .limit(100);

      if (dateRange?.from) {
        query = query.gte("summary_date", format(dateRange.from, 'yyyy-MM-dd'));
      }
      if (dateRange?.to) {
        query = query.lte("summary_date", format(dateRange.to, 'yyyy-MM-dd'));
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: permissions.canViewStockMovements && (movementTypeFilter === "all" || movementTypeFilter === "sale" || movementTypeFilter === "dispatch"),
  });

  // Fetch non-dispatch product movements (adjustments, returns, transfers, purchases)
  const { data: productMovements, isLoading: loadingProducts } = useQuery({
    queryKey: ["product-movements-nondispatch", movementTypeFilter, dateRange, outletFilter],
    queryFn: async () => {
      const baseSelect = `
        id,
        quantity,
        movement_type,
        notes,
        created_at,
        created_by,
        outlet_id,
        product:products(name, sku),
        outlet:outlets(name)
      `;

      // If filtering for dispatch/sale only, don't fetch individual movements
      if (movementTypeFilter === "sale" || movementTypeFilter === "dispatch") {
        return [];
      }

      let query = supabase
        .from("stock_movements")
        .select(baseSelect)
        .neq("movement_type", "sale") // Exclude sales - handled by summaries
        .order("created_at", { ascending: false })
        .limit(300);

      if (movementTypeFilter !== "all") {
        query = query.eq("movement_type", movementTypeFilter);
      }

      if (outletFilter !== "all") {
        query = query.eq("outlet_id", outletFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        // Set to end of day (23:59:59.999) to include all records from the selected end date
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return await enrichWithProfiles(data || [], 'performed_by_profile');
    },
    enabled: permissions.canViewStockMovements && movementTypeFilter !== "sale" && movementTypeFilter !== "dispatch",
  });

  // Helper function to enrich data with profile info
  const enrichWithProfiles = async (data: any[], profileKey: string) => {
    if (!data || data.length === 0) return data;
    
    const userIds = [...new Set(data.map((m: any) => m.created_by).filter(Boolean))];
    if (userIds.length === 0) return data;
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
    return data.map((m: any) => ({
      ...m,
      [profileKey]: profileMap.get(m.created_by) || null
    }));
  };

  // Fetch non-dispatch packaging movements
  // Note: packaging_movements table doesn't have outlet_id column
  const { data: packagingMovements, isLoading: loadingPackaging } = useQuery({
    queryKey: ["packaging-movements-nondispatch", movementTypeFilter, dateRange],
    queryFn: async () => {
      // If filtering for dispatch only, don't fetch individual movements
      if (movementTypeFilter === "dispatch") {
        return [];
      }

      // Note: packaging_movements doesn't have outlet_id - packaging is tracked centrally
      let query = supabase
        .from("packaging_movements")
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          created_by,
          packaging_item:packaging_items(name, sku)
        `)
        .neq("movement_type", "dispatch")
        .order("created_at", { ascending: false })
        .limit(500);

      if (movementTypeFilter !== "all") {
        query = query.eq("movement_type", movementTypeFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endOfDay.toISOString());
      }

      const { data: rawData, error } = await query;
      
      if (error) throw error;
      
      // Add placeholder outlet (packaging is tracked at warehouse level)
      const enrichedData = (rawData || []).map((m: any) => ({
        ...m,
        outlet: { name: 'Main Warehouse' } // Packaging is centrally tracked
      }));
      
      return await enrichPackagingWithProfiles(enrichedData);
    },
    enabled: permissions.canViewStockMovements && movementTypeFilter !== "dispatch",
  });

  // Helper for packaging profiles
  const enrichPackagingWithProfiles = async (data: any[]) => {
    if (!data || data.length === 0) return data;
    
    const userIds = [...new Set(data.map((m: any) => m.created_by).filter(Boolean))];
    if (userIds.length === 0) return data;
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    
    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
    return data.map((m: any) => ({
      ...m,
      profile: profileMap.get(m.created_by) || null
    }));
  };

  // Parse notes to extract reason and image URL
  const parseNotes = (notes: string | null): { reason: string; imageUrl?: string; details: string } => {
    if (!notes) return { reason: 'Not specified', details: '' };
    
    // Check for "Reason | Image: URL" format
    const imageMatch = notes.match(/\|\s*Image:\s*(https?:\/\/[^\s]+)/i);
    const imageUrl = imageMatch?.[1];
    
    // Extract reason (text before "|" or the whole note)
    let reason = notes;
    let details = notes;
    
    if (notes.includes('|')) {
      const parts = notes.split('|');
      reason = parts[0].trim();
      details = parts.slice(0, -1).join('|').trim(); // Exclude image part
    }
    
    // Common reason keywords
    if (reason.toLowerCase().includes('damaged')) {
      reason = 'Damaged';
    } else if (reason.toLowerCase().includes('inventory made')) {
      reason = 'Inventory Made';
    } else if (reason.toLowerCase().includes('return')) {
      reason = 'Return';
    } else if (reason.toLowerCase().includes('dispatch')) {
      reason = 'Dispatch';
    } else if (reason.toLowerCase().includes('sale')) {
      reason = 'Sale';
    } else if (reason.toLowerCase().includes('transfer')) {
      reason = 'Transfer';
    } else if (reason.toLowerCase().includes('adjustment')) {
      reason = 'Adjustment';
    }
    
    return { reason, imageUrl, details };
  };

  // Combine and unify individual movements (non-dispatch only)
  const unifiedMovements: UnifiedMovement[] = useMemo(() => [
    ...(productMovements || []).map((m: any) => {
      const parsed = parseNotes(m.notes);
      return {
        id: `product-${m.id}`,
        name: m.product?.name || 'Unknown Product',
        sku: m.product?.sku || '',
        category: 'product' as const,
        quantity: m.quantity,
        movement_type: m.movement_type,
        reason: parsed.reason,
        notes: parsed.details,
        image_url: parsed.imageUrl,
        created_at: m.created_at,
        performed_by: m.performed_by_profile?.full_name || m.performed_by_profile?.email || 'System',
        outlet_name: m.outlet?.name || '-',
        from_outlet: undefined,
        to_outlet: undefined,
      };
    }),
    ...(packagingMovements || []).map((m: any) => {
      const parsed = parseNotes(m.notes);
      return {
        id: `packaging-${m.id}`,
        name: m.packaging_item?.name || 'Unknown Packaging',
        sku: m.packaging_item?.sku || '',
        category: 'packaging' as const,
        quantity: m.quantity,
        movement_type: m.movement_type,
        reason: parsed.reason,
        notes: parsed.details,
        image_url: parsed.imageUrl,
        created_at: m.created_at,
        performed_by: m.profile?.full_name || m.profile?.email || 'System',
        outlet_name: m.outlet?.name || '-',
        from_outlet: undefined,
        to_outlet: undefined,
      };
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [productMovements, packagingMovements]);

  // Filter individual movements
  const filteredMovements = unifiedMovements.filter((movement) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      movement.name.toLowerCase().includes(searchLower) ||
      movement.sku.toLowerCase().includes(searchLower) ||
      movement.notes.toLowerCase().includes(searchLower) ||
      movement.reason.toLowerCase().includes(searchLower);
    
    const matchesCategory = categoryFilter === 'all' || movement.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Convert dispatch summaries to display format
  const summaryItems: DispatchSummary[] = useMemo(() => {
    if (!dispatchSummaries || movementTypeFilter === "adjustment" || movementTypeFilter === "transfer" || movementTypeFilter === "return" || movementTypeFilter === "purchase") {
      return [];
    }

    return dispatchSummaries
      .filter(s => {
        // Apply category filter
        if (categoryFilter === 'product' && s.unique_packaging > 0 && s.unique_products === 0) return false;
        if (categoryFilter === 'packaging' && s.unique_products > 0 && s.unique_packaging === 0) return false;
        
        // Apply search filter
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          const productItems = s.product_items as Record<string, { name: string; sku: string; total_qty: number }> || {};
          const packagingItems = s.packaging_items as Record<string, { name: string; sku: string; total_qty: number }> || {};
          
          const matchesProduct = Object.values(productItems).some(
            item => item.name?.toLowerCase().includes(searchLower) || item.sku?.toLowerCase().includes(searchLower)
          );
          const matchesPackaging = Object.values(packagingItems).some(
            item => item.name?.toLowerCase().includes(searchLower) || item.sku?.toLowerCase().includes(searchLower)
          );
          
          if (!matchesProduct && !matchesPackaging) return false;
        }
        
        return true;
      })
      .map(s => ({
        id: `summary-${s.id}`,
        type: 'summary' as const,
        date: s.summary_date,
        productItems: (s.product_items as unknown as Record<string, { name: string; sku: string; total_qty: number; orders?: OrderBreakdown[] }>) || {},
        packagingItems: (s.packaging_items as unknown as Record<string, { name: string; sku: string; total_qty: number; orders?: OrderBreakdown[] }>) || {},
        totalProductUnits: s.total_product_units || 0,
        totalPackagingUnits: s.total_packaging_units || 0,
        uniqueProducts: s.unique_products || 0,
        uniquePackaging: s.unique_packaging || 0,
        orderCount: s.order_count || 0,
      }));
  }, [dispatchSummaries, categoryFilter, searchTerm, movementTypeFilter]);

  // Combine summaries and individual movements
  const displayItems = useMemo((): DisplayItem[] => {
    const combined: DisplayItem[] = [...summaryItems, ...filteredMovements];
    combined.sort((a, b) => {
      const dateA = 'date' in a ? new Date(a.date) : new Date(a.created_at);
      const dateB = 'date' in b ? new Date(b.date) : new Date(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
    return combined;
  }, [summaryItems, filteredMovements]);

  const handleExportToCSV = () => {
    if (displayItems.length === 0) {
      toast.error("No data to export");
      return;
    }

    const rows: string[] = [];
    rows.push(["Date", "Stock Name", "SKU", "Category", "Type", "Outlet", "Change", "Reason", "Performed By"].join(","));
    
    // Get the main warehouse name for dispatch consolidation
    const mainWarehouse = outlets?.find(o => o.outlet_type === 'warehouse')?.name || 'Main Warehouse';
    
    // Initialize all outlets with zero values (products and packaging)
    const outletTotals: Record<string, {
      products: Record<string, { name: string; addition: number; deduction: number }>;
      packaging: Record<string, { name: string; addition: number; deduction: number }>;
    }> = {};

    // Pre-initialize all outlets from the outlets list
    outlets?.forEach(outlet => {
      outletTotals[outlet.name] = { products: {}, packaging: {} };
    });
    // Also add Main Warehouse if not in list
    if (!outletTotals[mainWarehouse]) {
      outletTotals[mainWarehouse] = { products: {}, packaging: {} };
    }

    const updateOutletTotals = (outletName: string, category: 'product' | 'packaging', itemName: string, sku: string, qty: number) => {
      // Consolidate dispatch warehouse entries to main warehouse
      let outlet = outletName || 'Unspecified';
      if (outlet === 'Warehouse (Dispatch)' || outlet === '-' || outlet.toLowerCase().includes('dispatch')) {
        outlet = mainWarehouse;
      }
      
      if (!outletTotals[outlet]) {
        outletTotals[outlet] = { products: {}, packaging: {} };
      }
      const key = `${itemName}__${sku}`;
      const items = category === 'product' ? outletTotals[outlet].products : outletTotals[outlet].packaging;
      if (!items[key]) {
        items[key] = { name: itemName, addition: 0, deduction: 0 };
      }
      if (qty > 0) {
        items[key].addition += qty;
      } else {
        items[key].deduction += Math.abs(qty);
      }
    };
    
    displayItems.forEach((item) => {
      if ('type' in item && item.type === 'summary') {
        // Export summary as multiple rows - use main warehouse name
        Object.entries(item.productItems).forEach(([_, product]) => {
          rows.push([
            item.date,
            `"${product.name}"`,
            product.sku || '',
            'product',
            'dispatch',
            `"${mainWarehouse}"`,
            `-${product.total_qty}`,
            'Daily Dispatch',
            'System (Aggregated)',
          ].join(","));
          updateOutletTotals(mainWarehouse, 'product', product.name, product.sku || '', -product.total_qty);
        });
        Object.entries(item.packagingItems).forEach(([_, packaging]) => {
          rows.push([
            item.date,
            `"${packaging.name}"`,
            packaging.sku || '',
            'packaging',
            'dispatch',
            `"${mainWarehouse}"`,
            `-${packaging.total_qty}`,
            'Daily Dispatch',
            'System (Aggregated)',
          ].join(","));
          updateOutletTotals(mainWarehouse, 'packaging', packaging.name, packaging.sku || '', -packaging.total_qty);
        });
      } else {
        const m = item as UnifiedMovement;
        const outletForExport = m.outlet_name === '-' ? mainWarehouse : m.outlet_name;
        rows.push([
          format(new Date(m.created_at), "yyyy-MM-dd hh:mm:ss a"),
          `"${m.name}"`,
          m.sku,
          m.category,
          m.movement_type,
          `"${outletForExport}"`,
          m.quantity > 0 ? `+${m.quantity}` : String(m.quantity),
          `"${m.reason}"`,
          m.performed_by,
        ].join(","));
        updateOutletTotals(outletForExport, m.category, m.name, m.sku, m.quantity);
      }
    });

    // Add outlet-wise totals at the end
    rows.push(""); // Empty row separator
    rows.push("=== OUTLET/WAREHOUSE WISE TOTALS ===");
    rows.push("");

    // Sort outlets alphabetically
    Object.entries(outletTotals).sort((a, b) => a[0].localeCompare(b[0])).forEach(([outletName, data]) => {
      rows.push(`"${outletName}"`);
      
      // Products section - always show header even if empty
      rows.push(",PRODUCTS:");
      rows.push(",Item Name,SKU,Total Addition,Total Deduction,Net Change");
      const productEntries = Object.entries(data.products);
      if (productEntries.length > 0) {
        productEntries.forEach(([key, item]) => {
          const net = item.addition - item.deduction;
          rows.push([
            '',
            `"${item.name}"`,
            key.split('__')[1] || '',
            `+${item.addition}`,
            `-${item.deduction}`,
            net >= 0 ? `+${net}` : String(net),
          ].join(","));
        });
      } else {
        rows.push(",No product movements");
      }
      
      // Packaging section - always show header even if empty
      rows.push(",PACKAGING:");
      rows.push(",Item Name,SKU,Total Addition,Total Deduction,Net Change");
      const packagingEntries = Object.entries(data.packaging);
      if (packagingEntries.length > 0) {
        packagingEntries.forEach(([key, item]) => {
          const net = item.addition - item.deduction;
          rows.push([
            '',
            `"${item.name}"`,
            key.split('__')[1] || '',
            `+${item.addition}`,
            `-${item.deduction}`,
            net >= 0 ? `+${net}` : String(net),
          ].join(","));
        });
      } else {
        rows.push(",No packaging movements");
      }
      
      rows.push(""); // Empty row between outlets
    });

    const csvContent = rows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const filterSuffix = movementTypeFilter !== 'all' ? `-${movementTypeFilter}` : '';
    a.download = `stock-movements${filterSuffix}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Stock movements exported successfully");
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSummary = (id: string) => {
    const newExpanded = new Set(expandedSummaries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSummaries(newExpanded);
  };

  const toggleItemOrders = (itemKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedItemOrders);
    if (newExpanded.has(itemKey)) {
      newExpanded.delete(itemKey);
    } else {
      newExpanded.add(itemKey);
    }
    setExpandedItemOrders(newExpanded);
  };

  const isSummary = (item: DisplayItem): item is DispatchSummary => {
    return 'type' in item && item.type === 'summary';
  };

  const isLoading = loadingProducts || loadingPackaging || loadingSummaries;

  if (!permissions.canViewStockMovements) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">You don't have permission to view stock movement history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderMovementRow = (movement: UnifiedMovement, isNested: boolean = false) => {
    const isExpanded = expandedRows.has(movement.id);
    const hasDetails = movement.notes || movement.image_url;
    
    return (
      <>
        <TableRow 
          key={movement.id} 
          className={`${hasDetails ? "cursor-pointer hover:bg-muted/50" : ""} ${isNested ? "bg-muted/20" : ""}`}
          onClick={() => hasDetails && toggleRow(movement.id)}
        >
          <TableCell className={isNested ? "pl-8" : ""}>
            {hasDetails && (
              isExpanded ? 
                <ChevronDown className="h-4 w-4 text-muted-foreground" /> : 
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              {format(new Date(movement.created_at), "MMM dd, yyyy hh:mm a")}
            </div>
          </TableCell>
          <TableCell>
            <div>
              <p className="font-medium">{movement.name}</p>
              <p className="text-xs text-muted-foreground">{movement.sku}</p>
            </div>
          </TableCell>
          <TableCell>
            <Badge 
              variant={movement.category === 'product' ? 'default' : 'secondary'}
              className="gap-1"
            >
              {movement.category === 'product' ? (
                <Package className="h-3 w-3" />
              ) : (
                <Box className="h-3 w-3" />
              )}
              {movement.category === 'product' ? 'Product' : 'Packaging'}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="capitalize">
              {movement.movement_type}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1 text-sm">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span>{movement.outlet_name || '-'}</span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-1">
              {movement.quantity > 0 ? (
                <TrendingUp className="h-4 w-4 text-success" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
              <span className={movement.quantity > 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                {movement.quantity > 0 ? "+" : ""}{movement.quantity}
              </span>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <span>{movement.reason}</span>
              {movement.image_url && (
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </TableCell>
          <TableCell>{movement.performed_by}</TableCell>
        </TableRow>
        {isExpanded && hasDetails && (
          <TableRow key={`${movement.id}-details`}>
            <TableCell colSpan={9} className="bg-muted/30 p-4">
              <div className="space-y-3">
                {movement.notes && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Details</p>
                    <p className="text-sm">{movement.notes}</p>
                  </div>
                )}
                {movement.from_outlet && (
                  <div className="flex items-center gap-2 text-sm">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <span>From: <strong>{movement.from_outlet}</strong></span>
                    {movement.to_outlet && (
                      <span>→ To: <strong>{movement.to_outlet}</strong></span>
                    )}
                  </div>
                )}
                {movement.image_url && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Proof Image</p>
                    <img 
                      src={movement.image_url} 
                      alt="Proof" 
                      className="h-24 w-24 object-cover rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(movement.image_url!);
                      }}
                    />
                  </div>
                )}
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  const renderSummaryRow = (summary: DispatchSummary) => {
    const isExpanded = expandedSummaries.has(summary.id);
    const productEntries = Object.entries(summary.productItems);
    const packagingEntries = Object.entries(summary.packagingItems);
    
    return (
      <>
        <TableRow 
          key={summary.id}
          className="cursor-pointer hover:bg-primary/5 bg-primary/10 border-l-4 border-l-primary"
          onClick={() => toggleSummary(summary.id)}
        >
          <TableCell>
            {isExpanded ? 
              <ChevronDown className="h-4 w-4 text-primary" /> : 
              <ChevronRight className="h-4 w-4 text-primary" />
            }
          </TableCell>
          <TableCell colSpan={2}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/20">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-primary">Daily Dispatch Summary</p>
                <p className="text-sm text-muted-foreground">{format(new Date(summary.date), "MMMM dd, yyyy")}</p>
              </div>
            </div>
          </TableCell>
          <TableCell colSpan={3}>
            <div className="flex gap-4">
              {summary.uniqueProducts > 0 && (
                <div className="flex items-center gap-1.5">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{summary.uniqueProducts}</strong> products
                    <span className="text-destructive ml-1">(-{summary.totalProductUnits} units)</span>
                  </span>
                </div>
              )}
              {summary.uniquePackaging > 0 && (
                <div className="flex items-center gap-1.5">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    <strong>{summary.uniquePackaging}</strong> packaging
                    <span className="text-destructive ml-1">(-{summary.totalPackagingUnits} units)</span>
                  </span>
                </div>
              )}
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="default" className="bg-primary/80">
              {summary.orderCount} orders
            </Badge>
          </TableCell>
          <TableCell colSpan={2}>
            <span className="text-sm text-muted-foreground">
              Click to {isExpanded ? 'collapse' : 'expand'} details
            </span>
          </TableCell>
        </TableRow>
        {isExpanded && (
          <>
            {/* Product items */}
            {productEntries.map(([productId, product]) => {
              const itemKey = `${summary.id}-product-${productId}`;
              const isOrdersExpanded = expandedItemOrders.has(itemKey);
              const orders = product.orders || [];
              
              return (
                <React.Fragment key={itemKey}>
                  <TableRow className="bg-muted/20">
                    <TableCell className="pl-8">
                      {orders.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => toggleItemOrders(itemKey, e)}
                        >
                          {isOrdersExpanded ? 
                            <ChevronDown className="h-3 w-3" /> : 
                            <ChevronRight className="h-3 w-3" />
                          }
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(summary.date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1">
                        <Package className="h-3 w-3" />
                        Product
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">dispatch</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-destructive font-medium">-{product.total_qty}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {orders.length > 0 ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={(e) => toggleItemOrders(itemKey, e)}
                        >
                          {orders.length} orders
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Dispatch</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">Aggregated</TableCell>
                  </TableRow>
                  {/* Order breakdown rows */}
                  {isOrdersExpanded && orders.map((order, idx) => (
                    <TableRow key={`${itemKey}-order-${idx}`} className="bg-muted/40">
                      <TableCell className="pl-12"></TableCell>
                      <TableCell colSpan={2}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Order:</span>
                          <span className="font-medium">{order.order_number}</span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                      <TableCell>
                        <span className="text-destructive text-sm">-{order.qty}</span>
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
            {/* Packaging items */}
            {packagingEntries.map(([packagingId, packaging]) => {
              const itemKey = `${summary.id}-packaging-${packagingId}`;
              const isOrdersExpanded = expandedItemOrders.has(itemKey);
              const orders = packaging.orders || [];
              
              return (
                <React.Fragment key={itemKey}>
                  <TableRow className="bg-muted/20">
                    <TableCell className="pl-8">
                      {orders.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={(e) => toggleItemOrders(itemKey, e)}
                        >
                          {isOrdersExpanded ? 
                            <ChevronDown className="h-3 w-3" /> : 
                            <ChevronRight className="h-3 w-3" />
                          }
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(summary.date), "MMM dd, yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{packaging.name}</p>
                        <p className="text-xs text-muted-foreground">{packaging.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1">
                        <Box className="h-3 w-3" />
                        Packaging
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">dispatch</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-destructive font-medium">-{packaging.total_qty}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {orders.length > 0 ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={(e) => toggleItemOrders(itemKey, e)}
                        >
                          {orders.length} orders
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Dispatch</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">Aggregated</TableCell>
                  </TableRow>
                  {/* Order breakdown rows */}
                  {isOrdersExpanded && orders.map((order, idx) => (
                    <TableRow key={`${itemKey}-order-${idx}`} className="bg-muted/40">
                      <TableCell className="pl-12"></TableCell>
                      <TableCell colSpan={2}>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Order:</span>
                          <span className="font-medium">{order.order_number}</span>
                        </div>
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                      <TableCell>
                        <span className="text-destructive text-sm">-{order.qty}</span>
                      </TableCell>
                      <TableCell colSpan={2}></TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              );
            })}
          </>
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">
            Complete audit trail of all product and packaging stock changes
          </p>
        </div>
        <Button onClick={handleExportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, SKU, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="product">Products Only</SelectItem>
                <SelectItem value="packaging">Packaging Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Movement Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
                <SelectItem value="sale">Sales/Dispatch</SelectItem>
                <SelectItem value="transfer_in">Transfer In</SelectItem>
                <SelectItem value="transfer_out">Transfer Out</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
                <SelectItem value="purchase">Purchases</SelectItem>
              </SelectContent>
            </Select>

            <Select value={outletFilter} onValueChange={setOutletFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Outlets" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets?.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3 w-3" />
                      {outlet.name}
                      <span className="text-xs text-muted-foreground capitalize">({outlet.outlet_type})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Stock Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    Loading movements...
                  </TableCell>
                </TableRow>
              ) : displayItems.length > 0 ? (
                displayItems.map((item) => {
                  if (isSummary(item)) {
                    return renderSummaryRow(item);
                  } else {
                    return renderMovementRow(item);
                  }
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">No stock movements found</h3>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        {searchTerm || categoryFilter !== 'all' || movementTypeFilter !== 'all' || dateRange?.from || outletFilter !== 'all'
                          ? 'Try adjusting your filters to see more results.'
                          : 'Stock movements will appear here when inventory changes occur.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Image Preview Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Proof Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <img 
              src={selectedImage} 
              alt="Proof" 
              className="w-full h-auto rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
