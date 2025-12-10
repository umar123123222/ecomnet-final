import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, CheckCircle, XCircle, Truck, Package, User, MapPin, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface TransferItem {
  id: string;
  product_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  product?: {
    name: string;
    sku: string;
  };
}

interface PackagingItem {
  id: string;
  packaging_item_id: string;
  quantity: number;
  packaging_item?: {
    name: string;
    sku: string;
  };
}

interface Transfer {
  id: string;
  status: string;
  created_at: string;
  notes?: string;
  rejection_reason?: string;
  from_outlet?: { name: string };
  to_outlet?: { name: string };
  requester?: { full_name: string };
  items?: TransferItem[];
  packaging_items?: PackagingItem[];
}

interface TransferDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: Transfer | null;
}

export function TransferDetailsDialog({ open, onOpenChange, transfer }: TransferDetailsDialogProps) {
  if (!transfer) return null;

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: typeof Clock; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock, label: "Pending Approval" },
      approved: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: CheckCircle, label: "Approved" },
      dispatched: { color: "bg-purple-100 text-purple-800 border-purple-300", icon: Truck, label: "Dispatched" },
      completed: { color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle, label: "Completed" },
      received: { color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle, label: "Received" },
      rejected: { color: "bg-red-100 text-red-800 border-red-300", icon: XCircle, label: "Rejected" },
    };
    return configs[status] || configs.pending;
  };

  const statusConfig = getStatusConfig(transfer.status);
  const StatusIcon = statusConfig.icon;

  const totalProducts = transfer.items?.reduce((sum, item) => sum + (item.quantity_approved || item.quantity_requested), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Transfer Details</DialogTitle>
            <Badge className={`${statusConfig.color} border gap-1.5 px-3 py-1`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Transfer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                From
              </div>
              <p className="font-medium">{transfer.from_outlet?.name || "Unknown"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                To
              </div>
              <p className="font-medium">{transfer.to_outlet?.name || "Unknown"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Requested By
              </div>
              <p className="font-medium">{transfer.requester?.full_name || "Unknown"}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Date
              </div>
              <p className="font-medium">{format(new Date(transfer.created_at), "MMM dd, yyyy 'at' h:mm a")}</p>
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Notes
              </div>
              <p className="text-sm bg-muted/50 p-3 rounded-lg">{transfer.notes}</p>
            </div>
          )}

          {/* Rejection Reason */}
          {transfer.status === 'rejected' && (transfer.rejection_reason || transfer.notes) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                Rejection Reason
              </div>
              <p className="text-sm bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20">
                {transfer.rejection_reason || transfer.notes}
              </p>
            </div>
          )}

          <Separator />

          {/* Products Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Products
              </h4>
              <Badge variant="secondary">{transfer.items?.length || 0} items • {totalProducts} units</Badge>
            </div>
            
            {transfer.items && transfer.items.length > 0 ? (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requested</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity_requested}</TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity_approved ?? item.quantity_requested}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No products in this transfer</p>
            )}
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold">Workflow Status</h4>
            <div className="flex items-center gap-2 text-sm">
              {['pending', 'approved', 'dispatched', 'completed'].map((step, index) => {
                const isActive = step === transfer.status || 
                  (transfer.status === 'received' && step === 'completed');
                const isPast = ['pending', 'approved', 'dispatched', 'completed'].indexOf(transfer.status) > index ||
                  (transfer.status === 'received' && index < 3);
                const isRejected = transfer.status === 'rejected' && step === 'pending';
                
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isRejected ? 'bg-destructive/10 text-destructive' :
                      isActive ? 'bg-primary text-primary-foreground' :
                      isPast ? 'bg-green-100 text-green-800' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {isPast && !isActive ? <CheckCircle className="h-3 w-3" /> : null}
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </div>
                    {index < 3 && (
                      <div className={`w-6 h-0.5 ${isPast ? 'bg-green-400' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}