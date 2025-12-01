import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BundleAvailabilityWidgetProps {
  bundleProductId: string;
  outletId: string;
}

interface ComponentStatus {
  component_id: string;
  component_name: string;
  component_sku: string;
  required_per_bundle: number;
  available: number;
  bundles_possible: number;
  is_limiting: boolean;
}

export const BundleAvailabilityWidget = ({ bundleProductId, outletId }: BundleAvailabilityWidgetProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ["bundle-availability", bundleProductId, outletId],
    queryFn: async () => {
      // Fetch bundle product info
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("name, is_bundle")
        .eq("id", bundleProductId)
        .single();

      if (productError) throw productError;
      if (!product?.is_bundle) return null;

      // Fetch bundle components with their product details
      const { data: bundleItems, error: bundleError } = await supabase
        .from("product_bundle_items")
        .select("component_product_id, quantity")
        .eq("bundle_product_id", bundleProductId);

      if (bundleError) throw bundleError;
      if (!bundleItems || bundleItems.length === 0) return null;

      // Calculate availability for each component
      const componentStatus: ComponentStatus[] = [];
      let minBundlesAvailable = Infinity;

      for (const item of bundleItems) {
        // Fetch component product details
        const { data: componentProduct } = await supabase
          .from("products")
          .select("name, sku")
          .eq("id", item.component_product_id)
          .single();

        // Fetch component inventory
        const { data: inventory } = await supabase
          .from("inventory")
          .select("available_quantity")
          .eq("product_id", item.component_product_id)
          .eq("outlet_id", outletId)
          .single();

        const availableQty = inventory?.available_quantity || 0;
        const bundlesPossible = Math.floor(availableQty / item.quantity);
        minBundlesAvailable = Math.min(minBundlesAvailable, bundlesPossible);

        componentStatus.push({
          component_id: item.component_product_id,
          component_name: componentProduct?.name || "Unknown",
          component_sku: componentProduct?.sku || "",
          required_per_bundle: item.quantity,
          available: availableQty,
          bundles_possible: bundlesPossible,
          is_limiting: false,
        });
      }

      // Mark limiting components
      componentStatus.forEach((comp) => {
        comp.is_limiting = comp.bundles_possible === minBundlesAvailable;
      });

      return {
        bundleName: product.name,
        bundleAvailability: minBundlesAvailable === Infinity ? 0 : minBundlesAvailable,
        components: componentStatus,
      };
    },
    enabled: !!bundleProductId && !!outletId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const limitingComponent = data.components.find((c) => c.is_limiting);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Bundle Availability</CardTitle>
          </div>
          <Badge variant="outline">📦 Bundle</Badge>
        </div>
        <CardDescription className="text-xs">{data.bundleName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">Available Bundles</span>
          <span className="text-2xl font-bold">{data.bundleAvailability}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Package className="h-3 w-3" />
            <span>Component Breakdown</span>
          </div>
          {data.components.map((component) => (
            <TooltipProvider key={component.component_id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                      component.is_limiting
                        ? "bg-destructive/10 border-destructive/50"
                        : "bg-background border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {component.is_limiting && <AlertCircle className="h-3 w-3 text-destructive" />}
                      <span className="text-xs font-medium">{component.component_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {component.available} / {component.required_per_bundle} per bundle
                      </span>
                      <Badge variant={component.bundles_possible === 0 ? "destructive" : "secondary"} className="text-xs">
                        {component.bundles_possible} bundles
                      </Badge>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <div>SKU: {component.component_sku}</div>
                    <div>Required per bundle: {component.required_per_bundle}</div>
                    <div>Available stock: {component.available}</div>
                    {component.is_limiting && (
                      <div className="text-destructive font-semibold">⚠️ Limiting component</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {limitingComponent && (
          <div className="flex items-start gap-2 p-2 bg-destructive/5 border border-destructive/20 rounded-md">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="text-xs">
              <span className="font-medium">Limited by: </span>
              <span className="text-muted-foreground">{limitingComponent.component_name}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
