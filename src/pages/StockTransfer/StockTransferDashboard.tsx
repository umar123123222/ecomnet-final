import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Clock, CheckCircle, XCircle, Plus, Loader2, PackageCheck, Truck } from "lucide-react";
import { format } from "date-fns";
import { StockTransferRequest, Product, Outlet } from "@/types/inventory";
import { StockTransferDialog } from "@/components/inventory/StockTransferDialog";
import { TransferReceiveDialog } from "@/components/inventory/TransferReceiveDialog";
import { OutletInventoryView } from "@/components/inventory/OutletInventoryView";
import { useToast } from "@/hooks/use-toast";
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAuth } from '@/contexts/AuthContext';
type TransferWithRelations = Omit<StockTransferRequest, 'from_outlet' | 'to_outlet'> & {
  from_outlet?: {
    name: string;
  };
  to_outlet?: {
    name: string;
  };
  requester?: {
    full_name: string;
  };
  items?: {
    id: string;
    product_id: string;
    quantity_requested: number;
    quantity_approved: number | null;
    product: {
      name: string;
      sku: string;
    };
  }[];
};
const StockTransferDashboard = () => {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const {
    permissions,
    primaryRole
  } = useUserRoles();
  const {
    profile
  } = useAuth();
  const isStoreManager = primaryRole === 'store_manager';
  const isWarehouseOrAdmin = ['super_admin', 'super_manager', 'warehouse_manager'].includes(primaryRole as string);

  // Fetch products and outlets for the dialog
  const {
    data: products
  } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: outlets
  } = useQuery<Outlet[]>({
    queryKey: ["outlets"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("outlets").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Outlet[];
    }
  });

  // Fetch transfer requests with items
  const {
    data: transfers,
    isLoading
  } = useQuery<TransferWithRelations[]>({
    queryKey: ["stock-transfers", filterStatus, profile?.id],
    queryFn: async () => {
      let query = supabase.from("stock_transfer_requests").select(`
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
        `).order("created_at", {
        ascending: false
      });

      // Filter for store managers - only show transfers TO their outlet
      if (isStoreManager) {
        const {
          data: userOutlet
        } = await supabase.from("outlets").select("id").eq("manager_id", profile?.id).single();
        if (userOutlet) {
          query = query.eq("to_outlet_id", userOutlet.id);
        }
      }
      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      const {
        data,
        error
      } = await query.limit(100);
      if (error) throw error;
      return data as TransferWithRelations[];
    }
  });
  const pendingCount = transfers?.filter(t => t.status === 'pending').length || 0;
  const approvedCount = transfers?.filter(t => t.status === 'approved').length || 0;
  const dispatchedCount = transfers?.filter(t => t.status as string === 'dispatched').length || 0;
  const completedCount = transfers?.filter(t => t.status === 'completed' || t.status as string === 'received').length || 0;
  const handleApprove = async (transferId: string) => {
    try {
      const {
        error
      } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "approve",
          transfer_id: transferId
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Transfer request approved"
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-transfers"]
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve transfer",
        variant: "destructive"
      });
    }
  };
  const handleReject = async (transferId: string) => {
    try {
      const {
        error
      } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "reject",
          transfer_id: transferId
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Transfer request rejected"
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-transfers"]
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject transfer",
        variant: "destructive"
      });
    }
  };
  const handleDispatch = async (transferId: string) => {
    try {
      const {
        error
      } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "dispatch",
          transfer_id: transferId
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Transfer dispatched - store manager can now receive inventory"
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-transfers"]
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to dispatch transfer",
        variant: "destructive"
      });
    }
  };
  const handleComplete = async (transferId: string) => {
    try {
      const {
        error
      } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "complete",
          transfer_id: transferId
        }
      });
      if (error) throw error;
      toast({
        title: "Success",
        description: "Transfer completed successfully"
      });
      queryClient.invalidateQueries({
        queryKey: ["stock-transfers"]
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to complete transfer",
        variant: "destructive"
      });
    }
  };
  const getStatusBadge = (status: string) => {
    const variants = {
      pending: {
        variant: "outline" as const,
        className: "border-yellow-500 text-yellow-500",
        icon: Clock
      },
      approved: {
        variant: "outline" as const,
        className: "border-blue-500 text-blue-500",
        icon: CheckCircle
      },
      dispatched: {
        variant: "outline" as const,
        className: "border-purple-500 text-purple-500",
        icon: Truck
      },
      completed: {
        variant: "outline" as const,
        className: "border-green-500 text-green-500",
        icon: CheckCircle
      },
      received: {
        variant: "outline" as const,
        className: "border-green-500 text-green-500",
        icon: CheckCircle
      },
      rejected: {
        variant: "outline" as const,
        className: "border-red-500 text-red-500",
        icon: XCircle
      },
      cancelled: {
        variant: "outline" as const,
        className: "border-gray-500 text-gray-500",
        icon: XCircle
      }
    };
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    return <Badge variant={config.variant} className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>;
  };
  return <div className="p-6 space-y-6">
      {/* Show outlet inventory for store managers */}
      {isStoreManager}
      
      {/* Transfer Requests Section - visible to all users */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            {isStoreManager ? 'Stock Transfer Requests' : 'Stock Transfer Requests'}
          </h1>
          <p className="text-muted-foreground">
            {isStoreManager ? 'Request inventory from warehouse and receive transfers' : 'Manage inventory transfers between outlets'}
          </p>
        </div>
        {/* Store managers can create transfer requests */}
        <Button onClick={() => setTransferDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Request Transfer
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
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
            <p className="text-xs text-muted-foreground">Ready to dispatch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatched</CardTitle>
            <Truck className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dispatchedCount}</div>
            <p className="text-xs text-muted-foreground">In transit</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground">Successfully received</p>
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
          <div className="flex gap-2 mb-4 flex-wrap">
            {['all', 'pending', 'approved', 'dispatched', 'completed', 'rejected'].map(status => <Button key={status} variant={filterStatus === status ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(status)}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>)}
          </div>

          {isLoading ? <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div> : <div className="rounded-md border">
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
                  {transfers && transfers.length > 0 ? transfers.map(transfer => <TableRow key={transfer.id}>
                        <TableCell className="text-sm">
                          {format(new Date(transfer.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            {transfer.items && transfer.items.length > 0 ? transfer.items.map((item, idx) => <div key={idx}>
                                  <div className="font-medium">{item.product?.name}</div>
                                  <div className="text-xs text-muted-foreground">{item.product?.sku} (Qty: {item.quantity_approved || item.quantity_requested})</div>
                                </div>) : <span className="text-muted-foreground">No items</span>}
                          </div>
                        </TableCell>
                        <TableCell>{transfer.from_outlet?.name}</TableCell>
                        <TableCell>{transfer.to_outlet?.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {transfer.items?.reduce((sum, item) => sum + (item.quantity_approved || item.quantity_requested), 0) || 0}
                        </TableCell>
                        <TableCell>{transfer.requester?.full_name}</TableCell>
                        <TableCell>{getStatusBadge(transfer.status)}</TableCell>
                        <TableCell className="text-right">
                          {/* Pending: Warehouse/Admin can approve/reject */}
                          {transfer.status === 'pending' && isWarehouseOrAdmin && <div className="flex gap-1 justify-end">
                              <Button variant="outline" size="sm" className="text-green-600 hover:bg-green-50" onClick={() => handleApprove(transfer.id)}>
                                Approve
                              </Button>
                              <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleReject(transfer.id)}>
                                Reject
                              </Button>
                            </div>}
                          {/* Approved: Warehouse/Admin can dispatch */}
                          {transfer.status === 'approved' && isWarehouseOrAdmin && <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDispatch(transfer.id)}>
                              <Truck className="h-4 w-4" />
                              Dispatch
                            </Button>}
                          {/* Dispatched: Store manager can receive */}
                          {transfer.status as string === 'dispatched' && isStoreManager && <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                    setSelectedTransfer(transfer);
                    setReceiveDialogOpen(true);
                  }}>
                              <PackageCheck className="h-4 w-4" />
                              Receive
                            </Button>}
                        </TableCell>
                      </TableRow>) : <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No transfer requests found
                      </TableCell>
                    </TableRow>}
                </TableBody>
              </Table>
            </div>}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <StockTransferDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen} products={products || []} outlets={outlets || []} />
      
      <TransferReceiveDialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen} transfer={selectedTransfer} />
    </div>;
};
export default StockTransferDashboard;