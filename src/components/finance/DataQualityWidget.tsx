import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Database, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DataQualityMetrics {
  missingDispatchCount: number;
  deliveredWithoutDate: number;
  bookedWithoutDate: number;
  dispatchedWithoutDate: number;
  unverifiedTracking: number;
}

interface DataQualityWidgetProps {
  dateRange?: { from?: Date; to?: Date };
  selectedCourier?: string;
}

const DataQualityWidget = ({ dateRange, selectedCourier }: DataQualityWidgetProps) => {
  // Fetch data quality metrics
  const { data: metrics, isLoading } = useQuery<DataQualityMetrics>({
    queryKey: ['data-quality-metrics', dateRange, selectedCourier],
    queryFn: async () => {
      // 1. Count orders with tracking but no dispatch record
      const { data: ordersWithTracking } = await supabase
        .from('orders')
        .select('id')
        .not('tracking_id', 'is', null)
        .not('courier', 'is', null);

      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('order_id');

      const dispatchOrderIds = new Set(dispatches?.map(d => d.order_id) || []);
      const missingDispatchCount = (ordersWithTracking || []).filter(o => !dispatchOrderIds.has(o.id)).length;

      // 2. Delivered orders without delivered_at timestamp
      const { count: deliveredWithoutDate } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'delivered')
        .is('delivered_at', null);

      // 3. Booked orders without booked_at timestamp
      const { count: bookedWithoutDate } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['booked', 'dispatched', 'delivered', 'returned'])
        .not('courier', 'is', null)
        .is('booked_at', null);

      // 4. Dispatched orders without dispatched_at timestamp
      const { count: dispatchedWithoutDate } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['dispatched', 'delivered', 'returned'])
        .is('dispatched_at', null);

      // 5. Orders with dispatch record but no tracking history (not verified with courier)
      const { count: unverifiedTracking } = await supabase
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .is('last_tracking_update', null);

      return {
        missingDispatchCount: missingDispatchCount || 0,
        deliveredWithoutDate: deliveredWithoutDate || 0,
        bookedWithoutDate: bookedWithoutDate || 0,
        dispatchedWithoutDate: dispatchedWithoutDate || 0,
        unverifiedTracking: unverifiedTracking || 0
      };
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  const defaultMetrics: DataQualityMetrics = {
    missingDispatchCount: 0,
    deliveredWithoutDate: 0,
    bookedWithoutDate: 0,
    dispatchedWithoutDate: 0,
    unverifiedTracking: 0
  };

  const m = metrics || defaultMetrics;

  const totalIssues = 
    m.missingDispatchCount + 
    m.deliveredWithoutDate + 
    m.bookedWithoutDate + 
    m.dispatchedWithoutDate;

  const hasIssues = totalIssues > 0;
  const hasUnverified = m.unverifiedTracking > 0;

  if (isLoading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Quality
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={`border-border/50 ${hasIssues ? 'border-amber-500/50' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Quality
            {hasIssues ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-xs">
                {totalIssues} issues
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" />
                Healthy
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Missing Dispatch Records */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Missing dispatch records</span>
                <span className={m.missingDispatchCount > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                  {m.missingDispatchCount}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Orders with tracking ID but no dispatch record in system</p>
            </TooltipContent>
          </Tooltip>

          {/* Missing booked_at */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Missing booked_at</span>
                <span className={m.bookedWithoutDate > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                  {m.bookedWithoutDate}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Orders assigned to courier but missing booking timestamp</p>
            </TooltipContent>
          </Tooltip>

          {/* Missing dispatched_at */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Missing dispatched_at</span>
                <span className={m.dispatchedWithoutDate > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                  {m.dispatchedWithoutDate}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Dispatched/delivered orders missing dispatch timestamp</p>
            </TooltipContent>
          </Tooltip>

          {/* Missing delivered_at */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Missing delivered_at</span>
                <span className={m.deliveredWithoutDate > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}>
                  {m.deliveredWithoutDate}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delivered orders missing delivery timestamp</p>
            </TooltipContent>
          </Tooltip>

          {/* Unverified Tracking */}
          {hasUnverified && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Unverified with courier
                  </span>
                  <span className="text-muted-foreground">
                    {m.unverifiedTracking}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Dispatches that haven't been verified with courier API yet</p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Health Summary */}
          {!hasIssues && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 pt-1">
              <CheckCircle className="h-3 w-3" />
              All order data is complete
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default DataQualityWidget;
