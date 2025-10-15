import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown, Zap, Scale } from 'lucide-react';
import { getCourierRates, bookCourier, CourierRate, BookingParams } from '@/utils/courierHelpers';
import { toast } from 'sonner';

interface CourierRateComparisonProps {
  orderId: string;
  originCity: string;
  destinationCity: string;
  weight: number;
  pieces: number;
  codAmount?: number;
  pickupAddress: BookingParams['pickupAddress'];
  deliveryAddress: BookingParams['deliveryAddress'];
  onBookingComplete?: (trackingId: string) => void;
}

export function CourierRateComparison({
  orderId,
  originCity,
  destinationCity,
  weight,
  pieces,
  codAmount,
  pickupAddress,
  deliveryAddress,
  onBookingComplete
}: CourierRateComparisonProps) {
  const [rates, setRates] = useState<CourierRate[]>([]);
  const [cheapest, setCheapest] = useState<CourierRate | null>(null);
  const [fastest, setFastest] = useState<CourierRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<string | null>(null);

  useEffect(() => {
    loadRates();
  }, [originCity, destinationCity, weight, codAmount]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const result = await getCourierRates(originCity, destinationCity, weight, codAmount);
      setRates(result.rates);
      setCheapest(result.cheapest);
      setFastest(result.fastest);
    } catch (error) {
      console.error('Error loading rates:', error);
      toast.error('Failed to load courier rates');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (courierId: string, courierName: string) => {
    setBooking(courierId);
    try {
      const result = await bookCourier({
        orderId,
        courierId,
        pickupAddress,
        deliveryAddress,
        weight,
        pieces,
        codAmount
      });

      if (result.success && result.trackingId) {
        toast.success(`Booked with ${courierName}`, {
          description: `Tracking ID: ${result.trackingId}`
        });
        onBookingComplete?.(result.trackingId);
      } else {
        toast.error('Booking failed', {
          description: result.error || 'Unknown error'
        });
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error('Booking failed');
    } finally {
      setBooking(null);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading courier rates...</span>
        </div>
      </Card>
    );
  }

  if (rates.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>No courier rates available for this route.</p>
          <Button onClick={loadRates} variant="outline" className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cheapest && (
          <Card className="p-4 border-green-200 bg-green-50/50">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-green-600" />
              <span className="font-semibold text-sm">Cheapest</span>
            </div>
            <div className="text-2xl font-bold text-green-700">
              Rs. {cheapest.rate.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {cheapest.courierName}
            </div>
          </Card>
        )}

        {fastest && (
          <Card className="p-4 border-blue-200 bg-blue-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">Fastest</span>
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {fastest.estimatedDays} days
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {fastest.courierName} - Rs. {fastest.rate.toLocaleString()}
            </div>
          </Card>
        )}

        <Card className="p-4 border-purple-200 bg-purple-50/50">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-4 w-4 text-purple-600" />
            <span className="font-semibold text-sm">Options</span>
          </div>
          <div className="text-2xl font-bold text-purple-700">
            {rates.length}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Available couriers
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold">Compare Rates</h3>
        {rates.map((rate) => (
          <Card key={rate.courierId} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{rate.courierName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {rate.courierCode}
                  </Badge>
                  {cheapest?.courierId === rate.courierId && (
                    <Badge variant="default" className="text-xs bg-green-500">
                      Cheapest
                    </Badge>
                  )}
                  {fastest?.courierId === rate.courierId && (
                    <Badge variant="default" className="text-xs bg-blue-500">
                      Fastest
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Rate: Rs. {rate.rate.toLocaleString()}</span>
                  {rate.estimatedDays && (
                    <span>ETA: {rate.estimatedDays} days</span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {rate.source === 'rate_card' ? 'Fixed Rate' : 'Live Rate'}
                  </Badge>
                </div>
              </div>
              <Button
                onClick={() => handleBooking(rate.courierId, rate.courierName)}
                disabled={booking !== null}
                size="sm"
              >
                {booking === rate.courierId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Booking...
                  </>
                ) : (
                  'Book Now'
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
