import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle, X, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Alert {
  id: string;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata: any;
  created_at: string;
}

export function AlertsWidget() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    
    // Real-time subscription
    const channel = supabase
      .channel('alerts-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'automated_alerts' }, 
        () => fetchAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAlerts = async () => {
    try {
      const { data, error } = await supabase
        .from('automated_alerts')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setAlerts((data || []) as Alert[]);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('automated_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user?.id
        })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(alerts.filter(a => a.id !== alertId));
      
      toast({
        title: "Alert Acknowledged",
        description: "Alert has been marked as acknowledged",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to acknowledge alert",
        variant: "destructive"
      });
    }
  };

  const handleViewDetails = (alert: Alert) => {
    if (alert.alert_type === 'overdue_return') {
      navigate('/returns-not-received');
    } else if (alert.alert_type === 'stuck_order') {
      navigate('/orders');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical' || severity === 'high') {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading alerts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </span>
          <Badge variant="secondary">{alerts.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-2" />
            <div className="text-sm font-medium">No Active Alerts</div>
            <div className="text-xs text-muted-foreground mt-1">
              All systems operating normally
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {getSeverityIcon(alert.severity)}
                      <Badge className={getSeverityColor(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(alert)}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAcknowledge(alert.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm font-medium mb-1">{alert.title}</div>
                  <div className="text-xs text-muted-foreground">{alert.message}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {new Date(alert.created_at).toLocaleString('en-US', { hour12: true })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
