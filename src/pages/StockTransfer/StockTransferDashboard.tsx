import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Clock, CheckCircle, XCircle, Plus, Loader2, PackageCheck, Truck, Eye, Package, ArrowRight, Calendar, User, Building2 } from "lucide-react";
import { format } from "date-fns";
import { StockTransferRequest, Product, Outlet } from "@/types/inventory";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";
import { TransferReceiveDialog } from "@/components/inventory/TransferReceiveDialog";
import { TransferDetailsDialog } from "@/components/inventory/TransferDetailsDialog";
import { RejectTransferDialog } from "@/components/inventory/RejectTransferDialog";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer, PageHeader } from "@/components/layout";
import { cn } from "@/lib/utils";

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

const statusConfig = {
  pending: { 
    label: 'Pending', 
    icon: Clock, 
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    dotColor: 'bg-amber-500'
  },
  approved: { 
    label: 'Approved', 
    icon: CheckCircle, 
    className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    dotColor: 'bg-blue-500'
  },
  in_transit: { 
    label: 'In Transit', 
    icon: Truck, 
    className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    dotColor: 'bg-purple-500'
  },
  completed: { 
    label: 'Completed', 
    icon: CheckCircle, 
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    dotColor: 'bg-emerald-500'
  },
  rejected: { 
    label: 'Rejected', 
    icon: XCircle, 
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    dotColor: 'bg-red-500'
  },
  cancelled: { 
    label: 'Cancelled', 
    icon: XCircle, 
    className: 'bg-muted text-muted-foreground border-border',
    dotColor: 'bg-muted-foreground'
  },
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

  const getStatusCounts = () => {
    if (!transfers) return { pending: 0, approved: 0, in_transit: 0, completed: 0, rejected: 0, all: 0 };
    return {
      pending: transfers.filter(t => t.status === 'pending').length,
      approved: transfers.filter(t => t.status === 'approved').length,
      in_transit: transfers.filter(t => t.status === 'in_transit').length,
      completed: transfers.filter(t => t.status === 'completed').length,
      rejected: transfers.filter(t => t.status === 'rejected').length,
      all: transfers.length,
    };
  };

  const counts = getStatusCounts();

  const handleApprove = async (transferId: string) => {
    setLoadingActions(prev => ({ ...prev, [transferId]: 'approve' }));
    try {
      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: { action: "approve", transfer_id: transferId }
      });
      if (error) throw error;
      toast({ title: "Success", description: "Transfer request approved" });
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve transfer", variant: "destructive" });
    } finally {
      setLoadingActions(prev => ({ ...prev, [transferId]: null }));
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
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn("gap-1.5 font-medium", config.className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
        {config.label}
      </Badge>
    );
  };

  const filterTabs = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'pending', label: 'Pending', count: counts.pending },
    { value: 'approved', label: 'Approved', count: counts.approved },
    { value: 'in_transit', label: 'In Transit', count: counts.in_transit },
    { value: 'completed', label: 'Completed', count: counts.completed },
    { value: 'rejected', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Stock Transfers"
        description={isStoreManager ? 'Request inventory from warehouse and track incoming transfers' : 'Manage inventory transfers between outlets'}
        icon={ArrowRightLeft}
        actions={
          <Button onClick={() => setTransferDialogOpen(true)} size="lg" className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            New Transfer Request
          </Button>
        }
      />

      {/* Status Filter Tabs */}
      <Card className="p-1.5 bg-muted/50">
        <div className="flex gap-1 overflow-x-auto">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                filterStatus === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
            >
              {tab.label}
              <Badge 
                variant={filterStatus === tab.value ? "default" : "secondary"} 
                className={cn(
                  "h-5 min-w-[20px] px-1.5 text-xs",
                  filterStatus === tab.value ? "" : "bg-muted-foreground/10"
                )}
              >
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>
      </Card>

      {/* Transfers Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading transfers...</p>
            </div>
          </div>
        ) : transfers && transfers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Transfer Route</TableHead>
                  <TableHead className="font-semibold">Items</TableHead>
                  <TableHead className="font-semibold">Requested By</TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const productCount = transfer.items?.length || 0;
                  const totalUnits = transfer.items?.reduce((sum, item) => sum + (item.quantity_approved || item.quantity_requested), 0) || 0;
                  
                  return (
                    <TableRow 
                      key={transfer.id} 
                      className="group cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openViewDetails(transfer)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ArrowRightLeft className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium truncate">{transfer.from_outlet?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{transfer.to_outlet?.name || 'Unknown'}</span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{productCount} products</p>
                            <p className="text-xs text-muted-foreground">{totalUnits} units total</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-sm">{transfer.requester?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(transfer.created_at), "MMM dd, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5"
                            onClick={() => openViewDetails(transfer)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>

                          {transfer.status === 'pending' && isWarehouseOrAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => handleApprove(transfer.id)}
                                disabled={loadingActions[transfer.id] === 'approve'}
                              >
                                {loadingActions[transfer.id] === 'approve' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                )}
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => openRejectDialog(transfer)}
                                disabled={!!loadingActions[transfer.id]}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}

                          {transfer.status === 'approved' && isWarehouseOrAdmin && (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => handleDispatch(transfer.id)}
                              disabled={loadingActions[transfer.id] === 'dispatch'}
                            >
                              {loadingActions[transfer.id] === 'dispatch' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Truck className="h-3.5 w-3.5" />
                              )}
                              Dispatch
                            </Button>
                          )}

                          {transfer.status === 'in_transit' && isStoreManager && (
                            <Button
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => openReceiveDialog(transfer)}
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Receive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ArrowRightLeft className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No transfers found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              {filterStatus === 'all' 
                ? "Create your first stock transfer request to move inventory between outlets."
                : `No transfers with "${filterStatus.replace('_', ' ')}" status.`}
            </p>
            {filterStatus === 'all' && (
              <Button onClick={() => setTransferDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Transfer Request
              </Button>
            )}
          </div>
        )}
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