import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { Search, Download, Activity, Filter, Loader2, Eye, FileText, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const ActivityLogs = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Fetch all users for filter
  const { data: users } = useQuery({
    queryKey: ["users-for-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch activity logs with filters
  const { data: activityLogs, isLoading, refetch } = useQuery<ActivityLog[]>({
    queryKey: ["activity-logs", selectedAction, selectedUser, selectedEntityType, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("activity_logs")
        .select(`
          *,
          profiles!activity_logs_user_id_fkey (
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      if (selectedAction !== "all") {
        query = query.eq("action", selectedAction);
      }

      if (selectedUser !== "all") {
        query = query.eq("user_id", selectedUser);
      }

      if (selectedEntityType !== "all") {
        query = query.eq("entity_type", selectedEntityType);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as ActivityLog[];
    },
  });

  // Filter by search term
  const filteredLogs = activityLogs?.filter((log) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.entity_id.toLowerCase().includes(searchLower) ||
      log.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      log.profiles?.email?.toLowerCase().includes(searchLower)
    );
  });

  // Get unique actions and entity types for filters
  const uniqueActions = Array.from(new Set(activityLogs?.map((log) => log.action) || []));
  const uniqueEntityTypes = Array.from(new Set(activityLogs?.map((log) => log.entity_type) || []));

  const getActionBadge = (action: string) => {
    const actionConfig: Record<string, { variant: any; color: string }> = {
      order_created: { variant: "outline", color: "border-blue-500 text-blue-500" },
      order_updated: { variant: "outline", color: "border-purple-500 text-purple-500" },
      order_dispatched: { variant: "outline", color: "border-orange-500 text-orange-500" },
      order_delivered: { variant: "outline", color: "border-green-500 text-green-500" },
      order_assigned: { variant: "outline", color: "border-cyan-500 text-cyan-500" },
      return_created: { variant: "outline", color: "border-yellow-500 text-yellow-500" },
      return_received: { variant: "outline", color: "border-teal-500 text-teal-500" },
      address_verified: { variant: "outline", color: "border-emerald-500 text-emerald-500" },
      customer_flagged: { variant: "outline", color: "border-red-500 text-red-500" },
      user_created: { variant: "outline", color: "border-indigo-500 text-indigo-500" },
      user_updated: { variant: "outline", color: "border-pink-500 text-pink-500" },
      user_deleted: { variant: "outline", color: "border-gray-500 text-gray-500" },
      system_error: { variant: "destructive", color: "border-red-600 bg-red-50 text-red-700" },
      edge_function_error: { variant: "destructive", color: "border-red-600 bg-red-50 text-red-700" },
      api_error: { variant: "destructive", color: "border-orange-600 bg-orange-50 text-orange-700" },
      database_error: { variant: "destructive", color: "border-red-700 bg-red-100 text-red-800" },
      courier_error: { variant: "destructive", color: "border-amber-600 bg-amber-50 text-amber-700" },
      shopify_sync_error: { variant: "destructive", color: "border-yellow-600 bg-yellow-50 text-yellow-700" },
      authentication_error: { variant: "destructive", color: "border-rose-600 bg-rose-50 text-rose-700" },
    };

    const config = actionConfig[action] || { variant: "outline", color: "border-gray-500 text-gray-500" };
    return (
      <Badge variant={config.variant} className={config.color}>
        {action.replace(/_/g, " ")}
      </Badge>
    );
  };

  const handleExport = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({
        title: "No Data",
        description: "No activity logs to export",
        variant: "destructive",
      });
      return;
    }

    const csvData = [
      ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Details"],
      ...filteredLogs.map((log) => [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm:ss"),
        log.profiles?.full_name || log.profiles?.email || "Unknown",
        log.action,
        log.entity_type,
        log.entity_id,
        JSON.stringify(log.details || {}),
      ]),
    ];

    const csvContent = csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-logs-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: `Exported ${filteredLogs.length} activity logs`,
    });
  };

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAction("all");
    setSelectedUser("all");
    setSelectedEntityType("all");
    setDateRange(undefined);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Activity Logs
          </h1>
          <p className="text-muted-foreground">System audit trail and user activity tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={clearFilters}>
            <Filter className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activityLogs?.filter(
                (log) =>
                  new Date(log.created_at).toDateString() === new Date().toDateString()
              ).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-700">System Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {activityLogs?.filter(
                (log) => log.action.includes('error')
              ).length || 0}
            </div>
            <p className="text-xs text-red-600">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(activityLogs?.map((log) => log.user_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLogs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Matching criteria</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Refine activity logs by multiple criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
              <SelectTrigger>
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {uniqueEntityTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
        </CardContent>
      </Card>

      {/* Activity Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
          <CardDescription>
            Showing {filteredLogs?.length || 0} of {activityLogs?.length || 0} total activities
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs && filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {log.profiles?.full_name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {log.profiles?.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.entity_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.entity_id.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this activity
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Timestamp</p>
                  <p className="text-sm">
                    {format(new Date(selectedLog.created_at), "MMM dd, yyyy HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">User</p>
                  <p className="text-sm">
                    {selectedLog.profiles?.full_name || selectedLog.profiles?.email || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Action</p>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Entity Type</p>
                  <p className="text-sm">{selectedLog.entity_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Entity ID</p>
                  <p className="text-sm font-mono">{selectedLog.entity_id}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Additional Details</p>
                <div className="bg-muted rounded-md p-4">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(selectedLog.details || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivityLogs;
