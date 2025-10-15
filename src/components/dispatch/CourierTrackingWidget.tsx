import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, MapPin, Clock } from 'lucide-react';
import { trackShipment } from '@/utils/courierHelpers';
import { toast } from 'sonner';

interface TrackingInfo {
  status: string;
  currentLocation?: string;
  statusHistory?: Array<{
    status: string;
    location: string;
    timestamp: string;
    remarks?: string;
  }>;
  estimatedDelivery?: string;
}

export function CourierTrackingWidget() {
  const [trackingId, setTrackingId] = useState('');
  const [courierCode, setCourierCode] = useState('TCS');
  const [tracking, setTracking] = useState<TrackingInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    if (!trackingId) {
      toast.error('Please enter a tracking ID');
      return;
    }

    setLoading(true);
    try {
      const result = await trackShipment(trackingId, courierCode);
      if (result) {
        setTracking(result);
      } else {
        toast.error('Tracking information not available');
      }
    } catch (error) {
      console.error('Tracking error:', error);
      toast.error('Failed to track shipment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'booked': 'bg-blue-500',
      'in_transit': 'bg-yellow-500',
      'out_for_delivery': 'bg-orange-500',
      'delivered': 'bg-green-500',
      'returned': 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'booked': 'Booked',
      'in_transit': 'In Transit',
      'out_for_delivery': 'Out for Delivery',
      'delivered': 'Delivered',
      'returned': 'Returned'
    };
    return labels[status] || status;
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Track Shipment</h3>

      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter tracking ID"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTrack()}
          />
          <select
            className="px-3 border rounded-md"
            value={courierCode}
            onChange={(e) => setCourierCode(e.target.value)}
          >
            <option value="TCS">TCS</option>
            <option value="LEOPARD">Leopard</option>
            <option value="POSTEX">PostEx</option>
          </select>
          <Button onClick={handleTrack} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Tracking...
              </>
            ) : (
              'Track'
            )}
          </Button>
        </div>

        {tracking && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                <span className="font-semibold">Status</span>
              </div>
              <Badge className={getStatusColor(tracking.status)}>
                {getStatusLabel(tracking.status)}
              </Badge>
            </div>

            {tracking.currentLocation && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>Current Location: {tracking.currentLocation}</span>
              </div>
            )}

            {tracking.estimatedDelivery && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Est. Delivery: {new Date(tracking.estimatedDelivery).toLocaleDateString()}</span>
              </div>
            )}

            {tracking.statusHistory && tracking.statusHistory.length > 0 && (
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Tracking History</h4>
                <div className="space-y-3">
                  {tracking.statusHistory.map((event, index) => (
                    <div
                      key={index}
                      className="flex gap-3 pb-3 border-b last:border-b-0"
                    >
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          index === 0 ? 'bg-primary' : 'bg-muted'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {event.status}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {event.location}
                        </div>
                        {event.remarks && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {event.remarks}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
