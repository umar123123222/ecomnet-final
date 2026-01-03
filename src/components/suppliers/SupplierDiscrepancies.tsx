import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  Package, 
  Calendar,
  CheckCircle2,
  MessageSquare,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { SupplierDiscrepancyMobileCard } from "./SupplierDiscrepancyMobileCard";

interface SupplierDiscrepanciesProps {
  supplierId: string;
}

export function SupplierDiscrepancies({ supplierId }: SupplierDiscrepanciesProps) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [expandedGRN, setExpandedGRN] = useState<string | null>(null);
  const [respondDialog, setRespondDialog] = useState<{
    grn_id: string;
    grn_number: string;
    po_number: string;
    po_id: string;
  } | null>(null);
  const [responseText, setResponseText] = useState("");

  // Fetch GRNs with discrepancies for this supplier
  const { data: discrepancies, isLoading } = useQuery({
    queryKey: ["supplier-discrepancies", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_received_notes")
        .select(`
          id,
          grn_number,
          po_id,
          total_items_expected,
          total_items_received,
          status,
          received_date,
          notes,
          created_at,
          purchase_orders(po_number, order_date),
          grn_items(
            id,
            quantity_expected,
            quantity_received,
            quantity_accepted,
            quantity_rejected,
            defect_type,
            quality_status,
            notes,
            products(name, sku),
            packaging_items(name, sku)
          )
        `)
        .eq("supplier_id", supplierId)
        .eq("discrepancy_flag", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  // Fetch supplier acknowledgments from goods_received_notes (using notes field for response)
  const { data: acknowledgments } = useQuery({
    queryKey: ["supplier-acknowledgments", supplierId],
    queryFn: async () => {
      // We'll track acknowledgments via a separate approach - check if there's supplier_notes in GRN
      const { data, error } = await supabase
        .from("goods_received_notes")
        .select("id, notes")
        .eq("supplier_id", supplierId)
        .eq("discrepancy_flag", true);

      if (error) throw error;
      
      // For now, we'll track acknowledgments in activity_logs or po_messages
      // Return empty map - we'll enhance this later
      return {} as Record<string, { notified: boolean; response?: string; response_at?: string }>;
    },
    enabled: !!supplierId,
  });

  // Submit response mutation - using po_messages table for supplier responses
  const submitResponseMutation = useMutation({
    mutationFn: async ({ grnId, poId, response }: { grnId: string; poId: string; response: string }) => {
      // Store response in po_messages table
      const { error } = await supabase
        .from("po_messages")
        .insert({
          po_id: poId,
          sender_type: 'supplier',
          message: `[Discrepancy Response for GRN] ${response}`,
          sender_id: supplierId,
        });

      if (error) throw error;
      
      // Mark discrepancy items as notified
      await supabase
        .from("receiving_discrepancies")
        .update({ 
          supplier_notified: true,
          supplier_response: response 
        })
        .eq("grn_id", grnId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-discrepancies"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-acknowledgments"] });
      toast.success("Response submitted successfully");
      setRespondDialog(null);
      setResponseText("");
    },
    onError: (error: any) => {
      toast.error(`Failed to submit response: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-100 text-green-800">Accepted</Badge>;
      case "partial_accept":
        return <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "pending_inspection":
        return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDefectBadge = (defectType: string | null) => {
    if (!defectType) return null;
    const colors: Record<string, string> = {
      damaged: "bg-red-100 text-red-800",
      missing: "bg-orange-100 text-orange-800",
      wrong_item: "bg-purple-100 text-purple-800",
      defective: "bg-pink-100 text-pink-800",
      short_shipment: "bg-yellow-100 text-yellow-800",
    };
    return (
      <Badge className={colors[defectType.toLowerCase()] || "bg-gray-100 text-gray-800"}>
        {defectType.replace(/_/g, " ")}
      </Badge>
    );
  };

  const unacknowledgedCount = discrepancies?.filter(
    (grn: any) => !acknowledgments?.[grn.id]?.response
  ).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!discrepancies || discrepancies.length === 0) {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold">No Discrepancies</h3>
        <p className="text-muted-foreground">
          All your deliveries have been received without issues.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {unacknowledgedCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-800">
              {unacknowledgedCount} discrepanc{unacknowledgedCount > 1 ? "ies" : "y"} require your response
            </p>
            <p className="text-sm text-yellow-700">
              Please review and acknowledge the receiving issues below.
            </p>
          </div>
        </div>
      )}

      <ScrollArea className={isMobile ? "h-auto max-h-[calc(100vh-200px)]" : "h-[600px]"}>
        <div className="space-y-3">
          {discrepancies.map((grn: any) => {
            const isExpanded = expandedGRN === grn.id;
            const ack = acknowledgments?.[grn.id];
            const hasResponded = !!ack?.response;

            if (isMobile) {
              return (
                <SupplierDiscrepancyMobileCard
                  key={grn.id}
                  grn={grn}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedGRN(isExpanded ? null : grn.id)}
                  hasResponded={hasResponded}
                  acknowledgment={ack}
                  onRespond={() => setRespondDialog({
                    grn_id: grn.id,
                    grn_number: grn.grn_number,
                    po_number: grn.purchase_orders?.po_number || "",
                    po_id: grn.po_id,
                  })}
                  getStatusBadge={getStatusBadge}
                  getDefectBadge={getDefectBadge}
                />
              );
            }

            return (
              <Card key={grn.id} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => setExpandedGRN(isExpanded ? null : grn.id)}>
                  <CollapsibleTrigger className="w-full">
                    <div className="p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{grn.grn_number}</span>
                            {getStatusBadge(grn.status)}
                            {!hasResponded && (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                                Needs Response
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              PO: {grn.purchase_orders?.po_number}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(grn.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="text-sm font-medium">
                            Expected: {grn.total_items_expected}
                          </div>
                          <div className={`text-sm ${grn.total_items_received < grn.total_items_expected ? 'text-destructive' : 'text-green-600'}`}>
                            Received: {grn.total_items_received}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t px-4 pb-4">
                      {/* Items with Issues */}
                      <div className="mt-4">
                        <h4 className="font-medium mb-3">Items with Issues</h4>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-center">Expected</TableHead>
                                <TableHead className="text-center">Received</TableHead>
                                <TableHead className="text-center">Variance</TableHead>
                                <TableHead>Issue Type</TableHead>
                                <TableHead>Notes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {grn.grn_items
                                ?.filter((item: any) => item.quantity_received !== item.quantity_expected || item.defect_type)
                                .map((item: any) => {
                                  const name = item.products?.name || item.packaging_items?.name || "Unknown";
                                  const variance = item.quantity_expected - item.quantity_received;
                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-medium">{name}</TableCell>
                                      <TableCell className="text-center">{item.quantity_expected}</TableCell>
                                      <TableCell className="text-center">{item.quantity_received}</TableCell>
                                      <TableCell className="text-center">
                                        {variance !== 0 && (
                                          <span className={variance > 0 ? "text-destructive" : "text-green-600"}>
                                            {variance > 0 ? `-${variance}` : `+${Math.abs(variance)}`}
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell>{getDefectBadge(item.defect_type)}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                        {item.notes || "-"}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      {/* Warehouse Notes */}
                      {grn.notes && (
                        <div className="mt-4 p-3 bg-muted rounded-lg">
                          <p className="text-sm font-medium mb-1">Warehouse Notes:</p>
                          <p className="text-sm text-muted-foreground">{grn.notes}</p>
                        </div>
                      )}

                      {/* Supplier Response Section */}
                      <div className="mt-4 flex items-center justify-between">
                        {hasResponded ? (
                          <div className="flex-1 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 text-green-700 mb-1">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="font-medium text-sm">Your Response</span>
                              <span className="text-xs text-green-600">
                                ({new Date(ack.response_at).toLocaleDateString()})
                              </span>
                            </div>
                            <p className="text-sm text-green-800">{ack.response}</p>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setRespondDialog({
                              grn_id: grn.id,
                              grn_number: grn.grn_number,
                              po_number: grn.purchase_orders?.po_number || "",
                              po_id: grn.po_id,
                            })}
                            className="gap-2"
                          >
                            <MessageSquare className="h-4 w-4" />
                            Respond to Discrepancy
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Response Dialog */}
      <Dialog open={!!respondDialog} onOpenChange={() => setRespondDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Respond to Discrepancy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">
                <strong>GRN:</strong> {respondDialog?.grn_number}
              </p>
              <p className="text-sm">
                <strong>PO:</strong> {respondDialog?.po_number}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Your Response
              </label>
              <Textarea
                placeholder="Explain the discrepancy, provide context, or acknowledge the issue..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialog(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (respondDialog && responseText.trim()) {
                  submitResponseMutation.mutate({
                    grnId: respondDialog.grn_id,
                    poId: respondDialog.po_id,
                    response: responseText.trim(),
                  });
                }
              }}
              disabled={!responseText.trim() || submitResponseMutation.isPending}
            >
              {submitResponseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Submit Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
