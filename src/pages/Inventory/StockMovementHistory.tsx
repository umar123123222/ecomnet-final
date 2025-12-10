import { useState } from "react";
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
import { Search, Download, TrendingUp, TrendingDown, ArrowLeftRight, Package, Calendar, ChevronDown, ChevronRight, Image as ImageIcon, Box } from "lucide-react";
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

export default function StockMovementHistory() {
  const { permissions } = useUserRoles();
  const [searchTerm, setSearchTerm] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch product movements
  const { data: productMovements, isLoading: loadingProducts } = useQuery({
    queryKey: ["product-movements", movementTypeFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          created_by,
          outlet_id,
          product:products(name, sku),
          outlet:outlets(name)
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (movementTypeFilter !== "all") {
        query = query.eq("movement_type", movementTypeFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user names for created_by
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((m: any) => m.created_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
          return data.map((m: any) => ({
            ...m,
            performed_by_profile: profileMap.get(m.created_by) || null
          }));
        }
      }
      return data;
    },
    enabled: permissions.canViewStockMovements,
  });

  // Fetch packaging movements
  const { data: packagingMovements, isLoading: loadingPackaging } = useQuery({
    queryKey: ["packaging-movements", movementTypeFilter, dateRange],
    queryFn: async () => {
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
        .order("created_at", { ascending: false })
        .limit(200);

      if (movementTypeFilter !== "all") {
        query = query.eq("movement_type", movementTypeFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch user names for created_by
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((m: any) => m.created_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
          
          const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);
          return data.map((m: any) => ({
            ...m,
            profile: profileMap.get(m.created_by) || null
          }));
        }
      }
      return data;
    },
    enabled: permissions.canViewStockMovements,
  });

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

  // Combine and unify movements
  const unifiedMovements: UnifiedMovement[] = [
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
        outlet_name: '-',
        from_outlet: undefined,
        to_outlet: undefined,
      };
    }),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Filter movements
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

  const handleExportToCSV = () => {
    if (!filteredMovements || filteredMovements.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvContent = [
      ["Date", "Stock Name", "SKU", "Category", "Type", "Change", "Reason", "Details", "Performed By"].join(","),
      ...filteredMovements.map((m) =>
        [
          format(new Date(m.created_at), "yyyy-MM-dd hh:mm:ss a"),
          `"${m.name}"`,
          m.sku,
          m.category,
          m.movement_type,
          m.quantity > 0 ? `+${m.quantity}` : m.quantity,
          `"${m.reason}"`,
          `"${m.notes}"`,
          m.performed_by,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-movements-${format(new Date(), "yyyy-MM-dd")}.csv`;
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

  const isLoading = loadingProducts || loadingPackaging;

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
          <div className="grid gap-4 md:grid-cols-4">
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
                <SelectItem value="sale">Sales</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
                <SelectItem value="dispatch">Dispatch</SelectItem>
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
                <TableHead>Change</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Loading movements...
                  </TableCell>
                </TableRow>
              ) : filteredMovements.length > 0 ? (
                filteredMovements.map((movement) => {
                  const isExpanded = expandedRows.has(movement.id);
                  const hasDetails = movement.notes || movement.image_url;
                  
                  return (
                    <>
                      <TableRow 
                        key={movement.id} 
                        className={hasDetails ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => hasDetails && toggleRow(movement.id)}
                      >
                        <TableCell>
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
                          <TableCell colSpan={7} className="bg-muted/30 p-4">
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
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No stock movements found</p>
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
