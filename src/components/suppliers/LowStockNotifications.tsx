import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Check, X, Send, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LowStockNotificationsProps {
  supplierId: string;
}

export function LowStockNotifications({ supplierId }: LowStockNotificationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [respondingTo, setRespondingTo] = useState<any>(null);
  const [canSupply, setCanSupply] = useState<boolean | null>(null);
  const [availableQty, setAvailableQty] = useState("");
  const [estimatedDate, setEstimatedDate] = useState("");
  const [notes, setNotes] = useState("");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["supplier-notifications", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("low_stock_notifications")
        .select(`
          *,
          product:products(name, sku),
          packaging_item:packaging_items(name, sku)
        `)
        .eq("supplier_id", supplierId)
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      can_supply: boolean;
      available_qty?: number;
      estimated_date?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("low_stock_notifications")
        .update({
          response_received: true,
          response_at: new Date().toISOString(),
          supplier_can_supply: data.can_supply,
          supplier_available_qty: data.available_qty,
          supplier_estimated_date: data.estimated_date,
          supplier_notes: data.notes,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      toast({ title: "Response submitted successfully" });
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting response",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setRespondingTo(null);
    setCanSupply(null);
    setAvailableQty("");
    setEstimatedDate("");
    setNotes("");
  };

  const handleSubmitResponse = () => {
    if (canSupply === null || !respondingTo) return;

    respondMutation.mutate({
      id: respondingTo.id,
      can_supply: canSupply,
      available_qty: canSupply ? parseInt(availableQty) || undefined : undefined,
      estimated_date: canSupply && estimatedDate ? estimatedDate : undefined,
      notes: notes || undefined,
    });
  };

  const pendingCount = notifications?.filter((n: any) => !n.response_received).length || 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Responses</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Alerts</p>
              <p className="text-2xl font-bold">{notifications?.length || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <h2 className="text-xl font-semibold">Low Stock Alerts</h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Reorder Level</TableHead>
              <TableHead>Suggested Qty</TableHead>
              <TableHead>Sent Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Your Response</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : notifications?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center">
                  No notifications found
                </TableCell>
              </TableRow>
            ) : (
              notifications?.map((notification: any) => {
                const item = notification.product || notification.packaging_item;
                return (
                  <TableRow key={notification.id}>
                    <TableCell className="font-medium">{item?.name}</TableCell>
                    <TableCell>{item?.sku}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{notification.current_stock}</Badge>
                    </TableCell>
                    <TableCell>{notification.reorder_level}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{notification.suggested_quantity}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(notification.sent_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {notification.response_received ? (
                        notification.supplier_can_supply ? (
                          <Badge variant="default">Can Supply</Badge>
                        ) : (
                          <Badge variant="destructive">Cannot Supply</Badge>
                        )
                      ) : notification.po_created ? (
                        <Badge variant="default">PO Created</Badge>
                      ) : (
                        <Badge variant="secondary">Awaiting Response</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {notification.response_received && (
                        <div className="text-sm text-muted-foreground">
                          {notification.supplier_can_supply ? (
                            <>
                              <p>Qty: {notification.supplier_available_qty || "-"}</p>
                              <p>ETA: {notification.supplier_estimated_date || "-"}</p>
                            </>
                          ) : (
                            <p className="text-destructive">Not available</p>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {!notification.response_received && (
                        <Button
                          size="sm"
                          onClick={() => setRespondingTo(notification)}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Respond
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Response Dialog */}
      <Dialog open={!!respondingTo} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Respond to Stock Alert</DialogTitle>
            <DialogDescription>
              {respondingTo?.product?.name || respondingTo?.packaging_item?.name} - 
              Suggested quantity: {respondingTo?.suggested_quantity}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Can you supply this item?</Label>
              <div className="flex gap-2">
                <Button
                  variant={canSupply === true ? "default" : "outline"}
                  onClick={() => setCanSupply(true)}
                  className="flex-1"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Yes
                </Button>
                <Button
                  variant={canSupply === false ? "destructive" : "outline"}
                  onClick={() => setCanSupply(false)}
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  No
                </Button>
              </div>
            </div>

            {canSupply === true && (
              <>
                <div>
                  <Label htmlFor="qty">Available Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    placeholder="How many can you supply?"
                    value={availableQty}
                    onChange={(e) => setAvailableQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="date">Estimated Delivery Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
              </>
            )}

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResponse}
              disabled={canSupply === null || respondMutation.isPending}
            >
              {respondMutation.isPending ? "Submitting..." : "Submit Response"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}