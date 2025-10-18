import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ConfirmationWithDetails } from '@/types/confirmation';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Send, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConfirmationTrackerProps {
  orderId: string;
}

const ConfirmationTracker = ({ orderId }: ConfirmationTrackerProps) => {
  const queryClient = useQueryClient();

  const { data: confirmations, isLoading } = useQuery({
    queryKey: ['order-confirmations', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_confirmations')
        .select(`
          *,
          order:orders(order_number, total_amount, customer_name, customer_phone, city),
          customer:customers(name, phone, whatsapp_opt_in)
        `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ConfirmationWithDetails[];
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (confirmationId: string) => {
      const { data, error } = await supabase.functions.invoke('send-order-confirmation', {
        body: { confirmation_id: confirmationId, force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Confirmation resent successfully');
      queryClient.invalidateQueries({ queryKey: ['order-confirmations', orderId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resend confirmation');
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case 'expired':
        return <Clock className="h-5 w-5 text-gray-600" />;
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      confirmed: 'default',
      cancelled: 'destructive',
      failed: 'destructive',
      expired: 'secondary',
      sent: 'default',
      delivered: 'default',
      pending: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'secondary'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="text-center py-4">Loading confirmations...</div>;
  }

  if (!confirmations || confirmations.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">No confirmations sent yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {confirmations.map((confirmation) => (
        <Card key={confirmation.id} className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {getStatusIcon(confirmation.status)}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium capitalize">
                      {confirmation.confirmation_type} Confirmation
                    </span>
                    {getStatusBadge(confirmation.status)}
                  </div>
                  {confirmation.sent_via && (
                    <p className="text-sm text-muted-foreground">
                      Sent via {confirmation.sent_via}
                    </p>
                  )}
                </div>

                {(confirmation.status === 'failed' || confirmation.status === 'pending') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendMutation.mutate(confirmation.id)}
                    disabled={resendMutation.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${resendMutation.isPending ? 'animate-spin' : ''}`} />
                    Resend
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                {confirmation.sent_at && (
                  <div>
                    <span className="text-muted-foreground">Sent: </span>
                    <span>{formatDistanceToNow(new Date(confirmation.sent_at))} ago</span>
                  </div>
                )}
                
                {confirmation.response_at && (
                  <div>
                    <span className="text-muted-foreground">Response: </span>
                    <span>{formatDistanceToNow(new Date(confirmation.response_at))} ago</span>
                  </div>
                )}
                
                {confirmation.customer_response && (
                  <div>
                    <span className="text-muted-foreground">Customer: </span>
                    <span className="capitalize">{confirmation.customer_response}</span>
                  </div>
                )}

                {confirmation.retry_count > 0 && (
                  <div>
                    <span className="text-muted-foreground">Retries: </span>
                    <span>{confirmation.retry_count}/3</span>
                  </div>
                )}
              </div>

              {confirmation.error_message && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  <p className="text-xs text-destructive">
                    Error: {confirmation.error_message}
                  </p>
                </div>
              )}

              {confirmation.message_content && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    View message
                  </summary>
                  <div className="mt-2 p-2 bg-muted rounded-md whitespace-pre-wrap">
                    {confirmation.message_content}
                  </div>
                </details>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ConfirmationTracker;
