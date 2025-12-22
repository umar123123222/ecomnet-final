import React, { memo, useMemo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { User, Phone, Mail, MapPin, Package, Calendar, ShoppingBag, Truck, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { downloadCourierLabel } from '@/utils/courierLabelDownload';
import { useToast } from '@/hooks/use-toast';
import type { FormattedOrder } from '@/hooks/useOrdersData';

interface OrderExpandedRowProps {
  order: FormattedOrder;
}

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
  bundle_product_id?: string;
  is_bundle_component?: boolean;
  bundle_name?: string;
}

interface GroupedBundle {
  bundleName: string;
  bundleProductId: string;
  components: OrderItem[];
  totalPrice: number;
}

export const OrderExpandedRow = memo(({ order }: OrderExpandedRowProps) => {
  const { toast } = useToast();

  const handleCopyTracking = async () => {
    await navigator.clipboard.writeText(order.trackingId);
    toast({ description: "Tracking ID copied to clipboard" });
  };

  const handleDownloadLabel = async () => {
    toast({ description: "Downloading label..." });
    try {
      const { data: dispatch, error: dispatchError } = await supabase
        .from('dispatches')
        .select('label_url, label_data, label_format, courier, tracking_id, id')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (dispatchError || !dispatch) {
        toast({ description: "No dispatch record found", variant: "destructive" });
        return;
      }

      if (dispatch.label_url || dispatch.label_data) {
        await downloadCourierLabel(dispatch.label_data, dispatch.label_url, dispatch.label_format || 'pdf', order.trackingId);
        toast({ description: "Label downloaded successfully" });
      } else {
        toast({ description: "No label available for this order", variant: "destructive" });
      }
    } catch (error) {
      console.error('Error downloading label:', error);
      toast({ description: "Failed to download label", variant: "destructive" });
    }
  };

  // Group items by bundle
  const { bundles, standaloneItems } = useMemo(() => {
    const items = (order.items || []) as OrderItem[];
    const bundleMap = new Map<string, GroupedBundle>();
    const standalone: OrderItem[] = [];

    for (const item of items) {
      if (item.is_bundle_component && item.bundle_product_id) {
        const existing = bundleMap.get(item.bundle_product_id);
        if (existing) {
          existing.components.push(item);
        } else {
          bundleMap.set(item.bundle_product_id, {
            bundleName: item.bundle_name || 'Bundle',
            bundleProductId: item.bundle_product_id,
            components: [item],
            totalPrice: 0, // Bundle price is on the parent, components have 0 price
          });
        }
      } else {
        standalone.push(item);
      }
    }

    // Calculate bundle total price from original order items if available
    // For now, bundles show component list without price breakdown

    return {
      bundles: Array.from(bundleMap.values()),
      standaloneItems: standalone,
    };
  }, [order.items]);

  return (
    <TableRow>
      <TableCell colSpan={9} className="bg-muted/30 p-6">
        <Tabs defaultValue="customer-details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customer-details">Customer Details</TabsTrigger>
            <TabsTrigger value="order-details">Order Details</TabsTrigger>
          </TabsList>

          <TabsContent value="customer-details" className="mt-4">
            <Card className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h4 className="text-lg font-semibold">Customer Information</h4>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground mb-0.5">Full Name</div>
                      <div className="font-medium">{order.customer || <span className="text-muted-foreground italic">Not Provided</span>}</div>
                    </div>
                  </div>

                  {order.phone && order.phone !== 'N/A' && (
                    <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                      <Phone className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-0.5">Phone Number</div>
                        <div className="font-medium">{order.phone}</div>
                      </div>
                    </div>
                  )}

                  {order.email && order.email !== 'N/A' && (
                    <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                      <Mail className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-0.5">Email Address</div>
                        <div className="font-medium">{order.email}</div>
                      </div>
                    </div>
                  )}

                  {order.address && order.address !== 'N/A' && (
                    <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground mb-0.5">Delivery Address</div>
                        <div className="font-medium">{order.address}</div>
                        {order.city && order.city !== 'N/A' && (
                          <div className="text-sm text-muted-foreground mt-1">{order.city}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="order-details" className="mt-4">
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-primary" />
                    <h4 className="text-lg font-semibold">Order Summary</h4>
                  </div>

                  <div className="space-y-4">
                    {order.shopify_order_id && (
                      <div className="flex items-start gap-3">
                        <Package className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-0.5">Shopify Order ID</div>
                          <div className="font-medium">{order.shopify_order_id}</div>
                        </div>
                      </div>
                    )}

                    {order.createdAtISO && (
                      <div className={`flex items-start gap-3 ${order.shopify_order_id ? 'pt-3 border-t border-border/50' : ''}`}>
                        <Calendar className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-0.5">Order Date</div>
                          <div className="font-medium">{new Date(order.createdAtISO).toLocaleDateString()}</div>
                        </div>
                      </div>
                    )}

                    {order.orderType && order.orderType !== 'N/A' && (
                      <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                        <ShoppingBag className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-muted-foreground mb-0.5">Order Type</div>
                          <div className="font-medium">{order.orderType}</div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3 pt-3 border-t border-border/50">
                      <Truck className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Courier</div>
                          <div className="font-medium">
                            {order.courier && order.courier !== 'N/A' 
                              ? order.courier.toUpperCase() 
                              : <span className="text-muted-foreground">Not assigned</span>}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Tracking ID</div>
                          {order.trackingId && order.trackingId !== 'N/A' ? (
                            <div className="flex items-center gap-2">
                              <code className="font-mono text-sm font-medium bg-muted px-2 py-1 rounded">
                                {order.trackingId}
                              </code>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleCopyTracking}>
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleDownloadLabel}>
                                Download Label
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(bundles.length > 0 || standaloneItems.length > 0) && (
                <Card className="border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      <h4 className="text-lg font-semibold">Order Items</h4>
                    </div>
                    <div className="space-y-3">
                      {/* Render bundles with their components */}
                      {bundles.map((bundle, bundleIdx) => (
                        <div key={bundle.bundleProductId || bundleIdx} className="border border-primary/20 rounded-lg p-3 bg-primary/5">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="font-medium text-primary">{bundle.bundleName}</span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Bundle</span>
                          </div>
                          <div className="ml-6 space-y-1">
                            {bundle.components.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 text-sm text-muted-foreground">
                                <span className="flex items-center gap-2">
                                  <span className="text-muted-foreground/50">└</span>
                                  {item.item_name}
                                </span>
                                <span>x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {/* Render standalone items */}
                      {standaloneItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                          <span className="text-sm">{item.item_name}</span>
                          <span className="text-sm text-muted-foreground">x{item.quantity} @ PKR {item.price}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </TableCell>
    </TableRow>
  );
});

OrderExpandedRow.displayName = 'OrderExpandedRow';