import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, 
  ChevronRight, 
  Package, 
  Calendar,
  CheckCircle2,
  MessageSquare,
  AlertTriangle
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SupplierDiscrepancyMobileCardProps {
  grn: any;
  isExpanded: boolean;
  onToggle: () => void;
  hasResponded: boolean;
  acknowledgment?: { response?: string; response_at?: string };
  onRespond: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  getDefectBadge: (defectType: string | null) => React.ReactNode;
}

export function SupplierDiscrepancyMobileCard({
  grn,
  isExpanded,
  onToggle,
  hasResponded,
  acknowledgment,
  onRespond,
  getStatusBadge,
  getDefectBadge,
}: SupplierDiscrepancyMobileCardProps) {
  const variance = grn.total_items_expected - grn.total_items_received;

  return (
    <Card className="overflow-hidden transition-all active:scale-[0.99]">
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <CollapsibleTrigger className="w-full">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground mt-0.5" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5" />
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{grn.grn_number}</span>
                    {getStatusBadge(grn.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Package className="h-3 w-3" />
                    <span>PO: {grn.purchase_orders?.po_number}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(grn.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {!hasResponded && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300 text-xs mb-2">
                    Needs Response
                  </Badge>
                )}
                <div className="text-xs">
                  <span className="text-muted-foreground">Expected: </span>
                  <span className="font-medium">{grn.total_items_expected}</span>
                </div>
                <div className={`text-xs ${variance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  <span className="text-muted-foreground">Received: </span>
                  <span className="font-medium">{grn.total_items_received}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-4 pb-4 space-y-3">
            {/* Items with Issues */}
            <div className="mt-3">
              <h4 className="font-medium text-sm mb-2">Items with Issues</h4>
              <div className="space-y-2">
                {grn.grn_items
                  ?.filter((item: any) => item.quantity_received !== item.quantity_expected || item.defect_type)
                  .map((item: any) => {
                    const name = item.products?.name || item.packaging_items?.name || "Unknown";
                    const itemVariance = item.quantity_expected - item.quantity_received;
                    return (
                      <Card key={item.id} className="bg-muted/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium text-sm">{name}</span>
                            {getDefectBadge(item.defect_type)}
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="text-muted-foreground">Expected</span>
                              <p className="font-semibold">{item.quantity_expected}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Received</span>
                              <p className="font-semibold">{item.quantity_received}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Variance</span>
                              <p className={`font-semibold ${itemVariance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {itemVariance > 0 ? `-${itemVariance}` : `+${Math.abs(itemVariance)}`}
                              </p>
                            </div>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            </div>

            {/* Warehouse Notes */}
            {grn.notes && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">Warehouse Notes:</p>
                <p className="text-xs text-muted-foreground">{grn.notes}</p>
              </div>
            )}

            {/* Supplier Response */}
            {hasResponded && acknowledgment?.response ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium text-xs">Your Response</span>
                  {acknowledgment.response_at && (
                    <span className="text-xs text-green-600">
                      ({new Date(acknowledgment.response_at).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <p className="text-xs text-green-800">{acknowledgment.response}</p>
              </div>
            ) : (
              <Button onClick={onRespond} className="w-full gap-2" size="sm">
                <MessageSquare className="h-4 w-4" />
                Respond to Discrepancy
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
