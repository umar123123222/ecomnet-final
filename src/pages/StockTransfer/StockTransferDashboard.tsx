import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Clock, CheckCircle, XCircle, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { StockTransferRequest, Product, Outlet } from "@/types/inventory";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from '@/hooks/useUserRoles';

type TransferWithRelations = StockTransferRequest & {
  product?: { name: string; sku: string };
  from_outlet?: { name: string };
  to_outlet?: { name: string };
  requester?: { full_name: string };
};

const StockTransferDashboard = () => {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useUserRoles();

  // Fetch products and outlets for the dialog
  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ["outlets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Outlet[];
    },
  });

  // Fetch transfer requests with items
  const { data: transfers, isLoading } = useQuery<TransferWithRelations[]>({
    queryKey: ["stock-transfers", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("stock_transfer_requests")
        .select(`
          *,
          from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(name),
          to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(name),
          requester:profiles!stock_transfer_requests_requested_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as TransferWithRelations[];
    },
  });

  const pendingCount = transfers?.filter(t => t.status === 'pending').length || 0;
  const approvedCount = transfers?.filter(t => t.status === 'approved').length || 0;
  const completedCount = transfers?.filter(t => t.status === 'completed').length || 0;

  const handleApprove = async (transferId: string) => {
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "approve", transfer_id: transferId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transfer request approved",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve transfer",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (transferId: string) => {
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "reject", transfer_id: transferId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transfer request rejected",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject transfer",
        variant: "destructive",
      });
    }
  };

  const handleComplete = async (transferId: string) => {
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "complete", transfer_id: transferId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transfer completed successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete transfer",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "outline" as const, className: "border-yellow-500 text-yellow-500", icon: Clock },
      approved: { variant: "outline" as const, className: "border-blue-500 text-blue-500", icon: CheckCircle },
      completed: { variant: "outline" as const, className: "border-green-500 text-green-500", icon: CheckCircle },
      rejected: { variant: "outline" as const, className: "border-red-500 text-red-500", icon: XCircle },
      cancelled: { variant: "outline" as const, className: "border-gray-500 text-gray-500", icon: XCircle },
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Stock Transfer Requests
          </h1>
          <p className="text-muted-foreground">Manage inventory transfers between outlets</p>
        </div>
        {permissions.canCreateStockTransfer && (
          <Button onClick={() => setTransferDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Transfer Request
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Ready to transfer</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully transferred</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transfers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">All requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>View all stock transfer requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {['all', 'pending', 'approved', 'completed', 'rejected'].map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers && transfers.length > 0 ? (
                    transfers.map((transfer) => (
                      <TableRow key={transfer.id}>
                        <TableCell className="text-sm">
                          {format(new Date(transfer.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{transfer.product?.name}</div>
                            <div className="text-xs text-muted-foreground">{transfer.product?.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{transfer.from_outlet?.name}</TableCell>
                        <TableCell>{transfer.to_outlet?.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {(transfer as any).quantity_approved || (transfer as any).quantity_requested || 0}
                        </TableCell>
                        <TableCell>{transfer.requester?.full_name}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell className="text-right">
                          {transfer.status === 'pending' && (
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => handleApprove(transfer.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => handleReject(transfer.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {transfer.status === 'approved' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleComplete(transfer.id)}
                            >
                              Complete
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No transfer requests found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <StockTransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        products={products || []}
        outlets={outlets || []}
      />
    </div>
  );
};

export default StockTransferDashboard;
