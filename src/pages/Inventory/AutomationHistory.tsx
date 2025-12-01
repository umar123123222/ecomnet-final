import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  History, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Package,
  AlertTriangle,
  Search,
  Download,
  RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/utils/currency";

interface AutoPurchaseOrder {
  id: string;
  po_id: string | null;
  trigger_reason: string;
  trigger_type: string;
  recommended_quantity: number;
  current_stock: number;
  calculated_reorder_point: number;
  avg_daily_consumption: number;
  lead_time_days: number;
  auto_approved: boolean;
  created_at: string;
  created_by: string | null;
  metadata: any;
  processing_duration_ms: number | null;
  error_message: string | null;
  purchase_orders?: {
    po_number: string;
    status: string;
    total_amount: number;
  };
}

export default function AutomationHistory() {
  const { currency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [triggerTypeFilter, setTriggerTypeFilter] = useState<string>("all");

  // Fetch automation history
  const { data: automationHistory, isLoading, refetch } = useQuery({
    queryKey: ["automation-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auto_purchase_orders")
        .select(`
          *,
          purchase_orders:po_id (
            po_number,
            status,
            total_amount
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AutoPurchaseOrder[];
    },
  });

  // Calculate metrics
  const metrics = {
    totalRuns: automationHistory?.length || 0,
    successfulPOs: automationHistory?.filter(h => h.po_id && !h.error_message).length || 0,
    failedRuns: automationHistory?.filter(h => h.error_message).length || 0,
    totalValue: automationHistory?.reduce((sum, h) => {
      return sum + (h.purchase_orders?.total_amount || 0);
    }, 0) || 0,
    avgProcessingTime: automationHistory?.filter(h => h.processing_duration_ms).length 
      ? Math.round(
          automationHistory
            .filter(h => h.processing_duration_ms)
            .reduce((sum, h) => sum + (h.processing_duration_ms || 0), 0) / 
          automationHistory.filter(h => h.processing_duration_ms).length
        )
      : 0,
  };

  // Filter data
  const filteredHistory = automationHistory?.filter(item => {
    const matchesSearch = 
      !searchTerm ||
      item.trigger_reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.purchase_orders?.po_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === "all" ||
      (statusFilter === "success" && item.po_id && !item.error_message) ||
      (statusFilter === "failed" && item.error_message) ||
      (statusFilter === "pending" && !item.po_id && !item.error_message);
    
    const matchesTriggerType = 
      triggerTypeFilter === "all" ||
      item.trigger_type === triggerTypeFilter;

    return matchesSearch && matchesStatus && matchesTriggerType;
  });

  const getStatusBadge = (item: AutoPurchaseOrder) => {
    if (item.error_message) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
    }
    if (item.po_id) {
      return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="h-3 w-3" /> Success</Badge>;
    }
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
  };

  const getTriggerTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      scheduled: "bg-blue-500",
      manual: "bg-purple-500",
      low_stock: "bg-orange-500",
      emergency: "bg-red-500",
    };
    return (
      <Badge variant="secondary" className={colors[type] || ""}>
        {type}
      </Badge>
    );
  };

  const exportToCSV = () => {
    if (!filteredHistory?.length) {
      toast.error("No data to export");
      return;
    }

    const csvContent = [
      ["Date", "PO Number", "Trigger", "Type", "Qty", "Current Stock", "Status", "Processing Time"],
      ...filteredHistory.map(item => [
        format(new Date(item.created_at), "yyyy-MM-dd hh:mm a"),
        item.purchase_orders?.po_number || "N/A",
        item.trigger_reason,
        item.trigger_type,
        item.recommended_quantity,
        item.current_stock,
        item.error_message ? "Failed" : item.po_id ? "Success" : "Pending",
        item.processing_duration_ms ? `${item.processing_duration_ms}ms` : "N/A",
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automation-history-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("History exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <History className="h-8 w-8 text-primary" />
            Automation History
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor smart reordering automation performance and history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRuns}</div>
            <p className="text-xs text-muted-foreground">Automation executions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful POs</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.successfulPOs}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalRuns > 0 
                ? `${((metrics.successfulPOs / metrics.totalRuns) * 100).toFixed(1)}% success rate` 
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Runs</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{metrics.failedRuns}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalRuns > 0 
                ? `${((metrics.failedRuns / metrics.totalRuns) * 100).toFixed(1)}% failure rate` 
                : "No data"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalValue, currency)}</div>
            <p className="text-xs text-muted-foreground">Generated PO value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgProcessingTime}ms</div>
            <p className="text-xs text-muted-foreground">Per automation run</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter History</CardTitle>
          <CardDescription>Search and filter automation execution history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reason or PO number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={triggerTypeFilter} onValueChange={setTriggerTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by trigger type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Triggers</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>
            Showing {filteredHistory?.length || 0} of {automationHistory?.length || 0} automation runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredHistory?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No automation history found</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Processing</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {format(new Date(item.created_at), "MMM dd, yyyy hh:mm a")}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate" title={item.trigger_reason}>
                          {item.trigger_reason}
                        </div>
                      </TableCell>
                      <TableCell>{getTriggerTypeBadge(item.trigger_type)}</TableCell>
                      <TableCell>
                        {item.purchase_orders?.po_number ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-sm">
                              {item.purchase_orders.po_number}
                            </span>
                            <Badge variant="outline" className="w-fit text-xs mt-1">
                              {item.purchase_orders.status}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.recommended_quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={item.current_stock < item.calculated_reorder_point ? "destructive" : "secondary"}
                        >
                          {item.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.calculated_reorder_point}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.processing_duration_ms ? `${item.processing_duration_ms}ms` : "—"}
                      </TableCell>
                      <TableCell>
                        {item.error_message && (
                          <div className="flex items-start gap-1 text-destructive">
                            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span className="text-xs max-w-[150px] truncate" title={item.error_message}>
                              {item.error_message}
                            </span>
                          </div>
                        )}
                        {item.auto_approved && (
                          <Badge variant="outline" className="text-xs">
                            Auto-approved
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
