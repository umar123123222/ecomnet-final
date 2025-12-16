import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Clock, CheckCircle, XCircle, Plus, Loader2, PackageCheck, Truck, Eye, Package } from "lucide-react";
import { format } from "date-fns";
import { StockTransferRequest, Product, Outlet } from "@/types/inventory";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";
import { TransferReceiveDialog } from "@/components/inventory/TransferReceiveDialog";
import { TransferDetailsDialog } from "@/components/inventory/TransferDetailsDialog";
import { RejectTransferDialog } from "@/components/inventory/RejectTransferDialog";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
import { EmptyTransfers } from "@/components/ui/empty-state";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";

type TransferWithRelations = Omit<StockTransferRequest, 'from_outlet' | 'to_outlet'> & {
  from_outlet?: { name: string };
  to_outlet?: { name: string };
  requester?: { full_name: string };
  rejection_reason?: string;
  items?: {
    id: string;
    product_id: string;
    quantity_requested: number;
    quantity_approved: number | null;
    product: { name: string; sku: string };
  }[];
};

const StockTransferDashboard = () => {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferWithRelations | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, 'approve' | 'dispatch' | null>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { primaryRole } = useUserRoles();
  const { profile } = useAuth();

  const isStoreManager = primaryRole === 'store_manager';
  const isWarehouseOrAdmin = ['super_admin', 'super_manager', 'warehouse_manager'].includes(primaryRole as string);

  const { data: products } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    }
  });

  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ["outlets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outlets").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Outlet[];
    }
  });

  const { data: transfers, isLoading } = useQuery<TransferWithRelations[]>({
    queryKey: ["stock-transfers", filterStatus, profile?.id],
    queryFn: async () => {
      let query = supabase
        .from("stock_transfer_requests")
        .select(`
          *,
          from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(name),
          to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(name),
          requester:profiles!stock_transfer_requests_requested_by_fkey(full_name),
          items:stock_transfer_items(
            id,
            product_id,
            quantity_requested,
            quantity_approved,
            product:products(name, sku)
          )
        `)
        .order("created_at", { ascending: false });

      if (isStoreManager) {
        const { data: userOutlet } = await supabase
          .from("outlets")
          .select("id")
          .eq("manager_id", profile?.id)
          .single();
        if (userOutlet) {
          query = query.eq("to_outlet_id", userOutlet.id);
        }
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as TransferWithRelations[];
    }
  });

  const pendingCount = transfers?.filter(t => t.status === 'pending').length || 0;
  const approvedCount = transfers?.filter(t => t.status === 'approved').length || 0;
  const inTransitCount = transfers?.filter(t => t.status === 'in_transit').length || 0;
  const completedCount = transfers?.filter(t => t.status === 'completed').length || 0;

  const handleApprove = async (transferId: string) => {
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "approve", transfer_id: transferId }
      });
      if (error) throw error;
      toast({ title: "Success", description: "Transfer request approved" });
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve transfer", variant: "destructive" });
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedTransfer) return;
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "reject", transfer_id: selectedTransfer.id, rejection_reason: reason }
      });
      if (error) throw error;
      toast({ title: "Success", description: "Transfer request rejected" });
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject transfer", variant: "destructive" });
    }
  };

  const handleDispatch = async (transferId: string) => {
    setLoadingActions(prev => ({ ...prev, [transferId]: 'dispatch' }));
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "dispatch", transfer_id: transferId }
      });
      if (error) throw error;
      toast({ title: "Success", description: "Transfer dispatched - store manager can now receive inventory" });
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to dispatch transfer", variant: "destructive" });
    } finally {
      setLoadingActions(prev => ({ ...prev, [transferId]: null }));
    }
  };

  const openViewDetails = (transfer: TransferWithRelations) => {
    setSelectedTransfer(transfer);
    setDetailsDialogOpen(true);
  };

  const openRejectDialog = (transfer: TransferWithRelations) => {
    setSelectedTransfer(transfer);
    setRejectDialogOpen(true);
  };

  const openReceiveDialog = (transfer: TransferWithRelations) => {
    setSelectedTransfer(transfer);
    setReceiveDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; icon: typeof Clock; label: string }> = {
      pending: { className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock, label: "Pending" },
      approved: { className: "bg-blue-100 text-blue-800 border-blue-300", icon: CheckCircle, label: "Approved" },
      in_transit: { className: "bg-purple-100 text-purple-800 border-purple-300", icon: Truck, label: "Dispatched" },
      completed: { className: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle, label: "Completed" },
      rejected: { className: "bg-red-100 text-red-800 border-red-300", icon: XCircle, label: "Rejected" },
      cancelled: { className: "bg-gray-100 text-gray-800 border-gray-300", icon: XCircle, label: "Cancelled" },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.className} border gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getItemsSummary = (transfer: TransferWithRelations) => {
    const productCount = transfer.items?.length || 0;
    const totalUnits = transfer.items?.reduce((sum, item) => sum + (item.quantity_approved || item.quantity_requested), 0) || 0;
    
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs gap-1">
          <Package className="h-3 w-3" />
          {productCount} products
        </Badge>
        <span className="text-xs text-muted-foreground">({totalUnits} units)</span>
      </div>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stock Transfer Requests"
        description={isStoreManager ? 'Request inventory from warehouse and receive transfers' : 'Manage inventory transfers between outlets'}
        icon={ArrowRightLeft}
        actions={
          <Button onClick={() => setTransferDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Request Transfer
          </Button>
        }
      />

      {/* Summary Cards */}
      <StatsGrid columns={5}>
        <StatsCard
          title="Pending"
          value={pendingCount}
          description="Awaiting approval"
          icon={Clock}
          variant="warning"
        />
        <StatsCard
          title="Approved"
          value={approvedCount}
          description="Ready to dispatch"
          icon={CheckCircle}
          variant="info"
        />
        <StatsCard
          title="In Transit"
          value={inTransitCount}
          description="Awaiting receipt"
          icon={Truck}
        />
        <StatsCard
          title="Completed"
          value={completedCount}
          description="Successfully received"
          icon={CheckCircle}
          variant="success"
        />
        <StatsCard
          title="Total"
          value={transfers?.length || 0}
          description="All requests"
          icon={ArrowRightLeft}
        />
      </StatsGrid>

      {/* Transfers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>View and manage stock transfer requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'in_transit', label: 'Dispatched' },
              { value: 'completed', label: 'Completed' },
              { value: 'rejected', label: 'Rejected' }
            ].map(status => (
              <Button
                key={status.value}
                variant={filterStatus === status.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(status.value)}
              >
                {status.label}
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
                    <TableHead>From → To</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers && transfers.length > 0 ? (
                    transfers.map(transfer => (
                      <TableRow key={transfer.id}>
                        <TableCell className="text-sm">
                          {format(new Date(transfer.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{transfer.from_outlet?.name}</span>
                            <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{transfer.to_outlet?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getItemsSummary(transfer)}</TableCell>
                        <TableCell>{transfer.requester?.full_name}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {/* View Details - Always visible */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => openViewDetails(transfer)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>

                            {/* Pending: Warehouse/Admin can approve/reject */}
                            {transfer.status === 'pending' && isWarehouseOrAdmin && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                  onClick={() => handleApprove(transfer.id)}
                                  disabled={loadingActions[transfer.id] === 'approve'}
                                >
                                  {loadingActions[transfer.id] === 'approve' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => openRejectDialog(transfer)}
                                  disabled={!!loadingActions[transfer.id]}
                                >
                                  Reject
                                </Button>
                              </>
                            )}

                            {/* Approved: Warehouse/Admin can dispatch */}
                            {transfer.status === 'approved' && isWarehouseOrAdmin && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => handleDispatch(transfer.id)}
                                disabled={loadingActions[transfer.id] === 'dispatch'}
                              >
                                {loadingActions[transfer.id] === 'dispatch' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                                Dispatch
                              </Button>
                            )}

                            {/* In Transit: Store manager can receive */}
                            {transfer.status === 'in_transit' && isStoreManager && (
                              <Button
                                variant="default"
                                size="sm"
                                className="gap-1"
                                onClick={() => openReceiveDialog(transfer)}
                              >
                                <PackageCheck className="h-4 w-4" />
                                Receive
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
      
      <TransferReceiveDialog
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        transfer={selectedTransfer}
      />

      <TransferDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        transfer={selectedTransfer}
      />

      <RejectTransferDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        onConfirm={handleReject}
        transferId={selectedTransfer?.id || ""}
      />
    </PageContainer>
  );
};

export default StockTransferDashboard;