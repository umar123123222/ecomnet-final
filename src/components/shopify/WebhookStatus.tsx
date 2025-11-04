import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Webhook } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WebhookRegistry {
  id: string;
  webhook_id: number;
  topic: string;
  address: string;
  status: string;
  created_at: string;
  last_triggered: string | null;
}

export const WebhookStatus = () => {
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['shopify-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_webhook_registry')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WebhookRegistry[];
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4 text-muted-foreground">
            Loading webhook status...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Webhook Status
        </CardTitle>
        <CardDescription>
          Registered Shopify webhooks for real-time synchronization
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!webhooks || webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="mb-2">No webhooks registered</p>
            <p className="text-sm">Click "Register Webhooks" above to set up real-time sync</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Triggered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div className="font-medium">{webhook.topic}</div>
                    <div className="text-xs text-muted-foreground">
                      ID: {webhook.webhook_id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={webhook.status === 'active' ? 'default' : 'destructive'}
                      className="flex items-center gap-1 w-fit"
                    >
                      {webhook.status === 'active' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {webhook.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {webhook.last_triggered
                        ? formatDistanceToNow(new Date(webhook.last_triggered), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};