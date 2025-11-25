import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Download } from "lucide-react";

interface TrackingResult {
  trackingId: string;
  status: 'success' | 'failed';
  data?: any;
  error?: string;
}

export function BulkTrackingWidget() {
  const [trackingIds, setTrackingIds] = useState("");
  const [courierCode, setCourierCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TrackingResult[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const { toast } = useToast();

  // Fetch couriers on mount
  useState(() => {
    fetchCouriers();
  });

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true)
      .order('name');
    
    if (data) setCouriers(data);
  };

  const handleBulkTrack = async () => {
    if (!trackingIds.trim()) {
      toast({ title: "Error", description: "Please enter tracking IDs", variant: "destructive" });
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const ids = trackingIds
        .split(/[\n,]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);

      if (ids.length === 0) {
        throw new Error("No valid tracking IDs found");
      }

      const { data, error } = await supabase.functions.invoke('bulk-courier-tracking', {
        body: { trackingIds: ids, courierCode: courierCode || undefined }
      });

      if (error) throw error;

      setResults(data.results || []);

      toast({
        title: "Tracking Complete",
        description: `${data.successful} successful, ${data.failed} failed out of ${data.total} shipments`
      });

    } catch (error: any) {
      console.error('Bulk tracking error:', error);
      toast({
        title: "Tracking Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const exportResults = () => {
    const csv = [
      ['Tracking ID', 'Status', 'Current Location', 'Latest Status'],
      ...results.map(r => [
        r.trackingId,
        r.status,
        r.data?.currentLocation || '-',
        r.data?.status || r.error || '-'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-tracking-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Bulk Order Tracking
        </CardTitle>
        <CardDescription>
          Track multiple shipments at once. Enter tracking IDs separated by commas or new lines.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={courierCode} onValueChange={setCourierCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select Courier (Optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Auto-detect from tracking IDs</SelectItem>
              {couriers.map(courier => (
                <SelectItem key={courier.id} value={courier.code}>
                  {courier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Textarea
          placeholder="Enter tracking IDs (one per line or comma-separated)&#10;Example:&#10;TRK123456789&#10;TRK987654321&#10;TRK456789123"
          value={trackingIds}
          onChange={(e) => setTrackingIds(e.target.value)}
          rows={6}
        />

        <div className="flex gap-2">
          <Button onClick={handleBulkTrack} disabled={loading} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Track Shipments
          </Button>
          {results.length > 0 && (
            <Button onClick={exportResults} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {results.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <h3 className="font-semibold">Results ({results.length})</h3>
            {results.map((result, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium">{result.trackingId}</p>
                  {result.status === 'success' && result.data && (
                    <div className="text-sm text-muted-foreground">
                      <p>{result.data.status}</p>
                      {result.data.currentLocation && (
                        <p>Location: {result.data.currentLocation}</p>
                      )}
                    </div>
                  )}
                  {result.status === 'failed' && (
                    <p className="text-sm text-destructive">{result.error}</p>
                  )}
                </div>
                <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                  {result.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
