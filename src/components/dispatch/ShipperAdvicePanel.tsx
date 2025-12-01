import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ShipperAdvicePanel() {
  const [trackingId, setTrackingId] = useState("");
  const [courierCode, setCourierCode] = useState("");
  const [adviceType, setAdviceType] = useState<'reattempt' | 'return' | 'reschedule'>('reattempt');
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCouriers();
    fetchLogs();
  }, []);

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true)
      .not('shipper_advice_save_endpoint', 'is', null)
      .order('name');
    
    if (data) setCouriers(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('shipper_advice_logs')
      .select(`
        *,
        orders (order_number, customer_name),
        couriers (name, code),
        profiles (full_name)
      `)
      .order('requested_at', { ascending: false })
      .limit(20);
    
    if (data) setLogs(data);
  };

  const handleSubmit = async () => {
    if (!trackingId || !courierCode) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('shipper-advice', {
        body: {
          trackingId,
          courierCode,
          adviceType,
          remarks
        }
      });

      if (error) throw error;

      toast({
        title: "Shipper Advice Saved",
        description: data.message
      });

      // Reset form
      setTrackingId("");
      setRemarks("");
      
      // Refresh logs
      fetchLogs();

    } catch (error: any) {
      console.error('Shipper advice error:', error);
      toast({
        title: "Failed to Save Advice",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Shipper Advice
        </CardTitle>
        <CardDescription>
          Manage reattempt and return instructions for failed deliveries
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="create">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Submit Advice</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Courier</label>
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Tracking ID</label>
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="Enter tracking ID"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={adviceType} onValueChange={(val: any) => setAdviceType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reattempt">Reattempt Delivery</SelectItem>
                  <SelectItem value="return">Return to Sender</SelectItem>
                  <SelectItem value="reschedule">Reschedule Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Remarks (Optional)</label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add any special instructions or notes..."
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={loading} className="w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Shipper Advice
            </Button>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Recent Advice ({logs.length})</h3>
                <Button size="sm" variant="outline" onClick={fetchLogs}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{log.tracking_id}</p>
                        <Badge variant="outline">{log.advice_type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {log.orders?.order_number} - {log.orders?.customer_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.couriers?.name} • {new Date(log.requested_at).toLocaleString('en-US', { hour12: true })}
                      </p>
                      {log.remarks && (
                        <p className="text-sm text-muted-foreground mt-1">{log.remarks}</p>
                      )}
                    </div>
                    <Badge variant={log.status === 'processed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                      {log.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
