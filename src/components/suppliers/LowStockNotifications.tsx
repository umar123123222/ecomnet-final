import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { AlertTriangle, Check, X, Send, MessageSquare, Calendar, Package } from "lucide-react";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface LowStockNotificationsProps {
  supplierId: string;
}

export function LowStockNotifications({ supplierId }: LowStockNotificationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
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

  // Mobile Card for Notification
  const NotificationCard = ({ notification }: { notification: any }) => {
    const item = notification.product || notification.packaging_item;
    const isPending = !notification.response_received;
    
    return (
      <Card className={`p-4 rounded-xl space-y-3 ${isPending ? 'border-amber-200 bg-amber-50/30 dark:bg-amber-950/10' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{item?.name}</p>
            <p className="text-xs text-muted-foreground">{item?.sku}</p>
          </div>
          {notification.response_received ? (
            notification.supplier_can_supply ? (
              <Badge variant="default" className="shrink-0">Can Supply</Badge>
            ) : (
              <Badge variant="destructive" className="shrink-0">Cannot Supply</Badge>
            )
          ) : notification.po_created ? (
            <Badge variant="default" className="shrink-0">PO Created</Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              Awaiting
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-2 text-center">
            <p className="text-muted-foreground">Current</p>
            <p className="font-bold text-red-600">{notification.current_stock}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-muted-foreground">Reorder</p>
            <p className="font-semibold">{notification.reorder_level}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 text-center">
            <p className="text-muted-foreground">Suggested</p>
            <p className="font-semibold text-blue-600">{notification.suggested_quantity}</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(notification.sent_at).toLocaleDateString()}
          </div>
        </div>

        {notification.response_received && notification.supplier_can_supply && (
          <div className="pt-2 border-t text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Available Qty:</span>
              <span className="font-medium">{notification.supplier_available_qty || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ETA:</span>
              <span className="font-medium">{notification.supplier_estimated_date || "-"}</span>
            </div>
          </div>
        )}

        {!notification.response_received && (
          <Button
            size="sm"
            className="w-full rounded-lg"
            onClick={() => setRespondingTo(notification)}
          >
            <Send className="mr-1 h-3 w-3" />
            Respond
          </Button>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <ScrollArea className="w-full">
          <div className="flex gap-3 sm:grid sm:grid-cols-2 sm:gap-4 pb-2 sm:pb-0">
            <Card className="shrink-0 w-[160px] sm:w-auto p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Responses</p>
                  <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
                </div>
              </div>
            </Card>
            <Card className="shrink-0 w-[160px] sm:w-auto p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Alerts</p>
                  <p className="text-2xl font-bold">{notifications?.length || 0}</p>
                </div>
              </div>
            </Card>
          </div>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>
      </div>

      <Card className="rounded-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg sm:text-xl font-semibold">Low Stock Alerts</h2>
          </div>
        </div>

        {isMobile ? (
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : notifications?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No notifications found</div>
            ) : (
              notifications?.map((notification: any) => (
                <NotificationCard key={notification.id} notification={notification} />
              ))
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Current Stock</TableHead>
                  <TableHead className="text-center">Reorder Level</TableHead>
                  <TableHead className="text-center">Suggested Qty</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Your Response</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : notifications?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">No notifications found</TableCell>
                  </TableRow>
                ) : (
                  notifications?.map((notification: any) => {
                    const item = notification.product || notification.packaging_item;
                    return (
                      <TableRow key={notification.id} className={!notification.response_received ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-medium">{item?.name}</TableCell>
                        <TableCell className="text-muted-foreground">{item?.sku}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{notification.current_stock}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{notification.reorder_level}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{notification.suggested_quantity}</Badge>
                        </TableCell>
                        <TableCell>{new Date(notification.sent_at).toLocaleDateString()}</TableCell>
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
                              className="rounded-lg"
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
          </div>
        )}
      </Card>

      {/* Response Sheet */}
      <Sheet open={!!respondingTo} onOpenChange={(open) => !open && resetForm()}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Package className="h-5 w-5 text-amber-600" />
              </div>
              Respond to Alert
            </SheetTitle>
            <SheetDescription>
              {respondingTo?.product?.name || respondingTo?.packaging_item?.name} - 
              Suggested: {respondingTo?.suggested_quantity} units
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Can you supply this item?</Label>
              <div className="flex gap-2">
                <Button
                  variant={canSupply === true ? "default" : "outline"}
                  onClick={() => setCanSupply(true)}
                  className={`flex-1 rounded-lg ${canSupply === true ? 'bg-green-600 hover:bg-green-700' : ''}`}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Yes
                </Button>
                <Button
                  variant={canSupply === false ? "destructive" : "outline"}
                  onClick={() => setCanSupply(false)}
                  className="flex-1 rounded-lg"
                >
                  <X className="mr-2 h-4 w-4" />
                  No
                </Button>
              </div>
            </div>

            {canSupply === true && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="qty">Available Quantity</Label>
                  <Input
                    id="qty"
                    type="number"
                    placeholder="How many can you supply?"
                    value={availableQty}
                    onChange={(e) => setAvailableQty(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Estimated Delivery Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={estimatedDate}
                    onChange={(e) => setEstimatedDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="rounded-lg"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>
          </div>

          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={resetForm} className="rounded-lg w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={handleSubmitResponse}
              disabled={canSupply === null || respondMutation.isPending}
              className="rounded-lg w-full sm:w-auto"
            >
              {respondMutation.isPending ? "Submitting..." : "Submit Response"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
