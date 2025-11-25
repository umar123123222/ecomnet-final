import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Download } from "lucide-react";

export function AWBManager() {
  const [trackingIds, setTrackingIds] = useState("");
  const [courierCode, setCourierCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [recentAWBs, setRecentAWBs] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCouriers();
    fetchRecentAWBs();
  }, []);

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true)
      .not('awb_endpoint', 'is', null)
      .order('name');
    
    if (data) setCouriers(data);
  };

  const fetchRecentAWBs = async () => {
    const { data } = await supabase
      .from('courier_awbs')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(10);
    
    if (data) setRecentAWBs(data);
  };

  const handleFetchAWBs = async () => {
    if (!trackingIds.trim() || !courierCode) {
      toast({ title: "Error", description: "Please enter tracking IDs and select a courier", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const ids = trackingIds
        .split(/[\n,]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (ids.length === 0) {
        throw new Error("No valid tracking IDs found");
      }

      const { data, error } = await supabase.functions.invoke('fetch-awb', {
        body: { trackingIds: ids, courierCode }
      });

      if (error) throw error;

      toast({
        title: "AWBs Fetched",
        description: `Successfully fetched AWBs for ${data.trackingCount} shipments`
      });

      // Download if available
      if (data.awbUrl) {
        window.open(data.awbUrl, '_blank');
      } else if (data.awbData) {
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.awbData}`;
        link.download = `awb-${courierCode}-${new Date().toISOString()}.pdf`;
        link.click();
      }

      fetchRecentAWBs();
      setTrackingIds("");

    } catch (error: any) {
      console.error('Fetch AWB error:', error);
      toast({
        title: "Failed to Fetch AWBs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadAWB = (awb: any) => {
    if (awb.pdf_url) {
      window.open(awb.pdf_url, '_blank');
    } else if (awb.pdf_data) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${awb.pdf_data}`;
      link.download = `awb-${awb.courier_code}-${awb.generated_at}.pdf`;
      link.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          AWB Manager
        </CardTitle>
        <CardDescription>
          Fetch and manage Airway Bills (AWBs) for shipments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={courierCode} onValueChange={setCourierCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select Courier" />
            </SelectTrigger>
            <SelectContent>
              {couriers.map(courier => (
                <SelectItem key={courier.id} value={courier.code}>
                  {courier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          placeholder="Enter tracking IDs (one per line or comma-separated)&#10;Example:&#10;TRK123456789&#10;TRK987654321"
          value={trackingIds}
          onChange={(e) => setTrackingIds(e.target.value)}
          rows={5}
        />

        <Button onClick={handleFetchAWBs} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Fetch AWBs
        </Button>

        {recentAWBs.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-semibold">Recent AWBs</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentAWBs.map((awb) => (
                <div
                  key={awb.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{awb.courier_code.toUpperCase()}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(awb.generated_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {awb.total_orders} shipments
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadAWB(awb)}
                    disabled={!awb.pdf_url && !awb.pdf_data}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
