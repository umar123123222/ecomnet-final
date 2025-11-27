import { supabase } from '@/integrations/supabase/client';

export interface CourierRate {
  courierId: string;
  courierName: string;
  courierCode: string;
  rate: number;
  estimatedDays?: number;
  source: 'rate_card' | 'api';
}

export interface BookingParams {
  orderId: string;
  courierId: string;
  pickupAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  deliveryAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
  };
  weight: number;
  pieces: number;
  codAmount?: number;
  specialInstructions?: string;
}

/**
 * Get courier rates for a shipment
 */
export async function getCourierRates(
  originCity: string,
  destinationCity: string,
  weight: number,
  codAmount?: number
): Promise<{ rates: CourierRate[], cheapest: CourierRate | null, fastest: CourierRate | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('courier-rates', {
      body: {
        originCity,
        destinationCity,
        weight,
        codAmount
      }
    });

    if (error) {
      console.error('Error getting courier rates:', error);
      return { rates: [], cheapest: null, fastest: null };
    }

    return data;
  } catch (error) {
    console.error('Exception getting courier rates:', error);
    return { rates: [], cheapest: null, fastest: null };
  }
}

/**
 * Book a courier for an order
 */
export async function bookCourier(params: BookingParams): Promise<{
  success: boolean;
  trackingId?: string;
  error?: string;
  errorCode?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('courier-booking', {
      body: params
    });

    if (error) {
      console.error('Error booking courier:', error);
      return { 
        success: false, 
        error: error.message,
        errorCode: 'FUNCTION_ERROR'
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Booking failed',
        errorCode: data.errorCode || 'BOOKING_ERROR'
      };
    }

    return {
      success: data.success,
      trackingId: data.trackingId
    };
  } catch (error: any) {
    console.error('Exception booking courier:', error);
    return { 
      success: false, 
      error: error.message || 'Network error occurred',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

/**
 * Track a shipment
 */
export async function trackShipment(trackingId: string, courierCode: string) {
  try {
    const { data, error } = await supabase.functions.invoke('courier-tracking', {
      body: {
        trackingId,
        courierCode
      }
    });

    if (error) {
      console.error('Error tracking shipment:', error);
      return null;
    }

    return data.tracking;
  } catch (error) {
    console.error('Exception tracking shipment:', error);
    return null;
  }
}

/**
 * Get all active couriers
 */
export async function getActiveCouriers() {
  try {
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching couriers:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching couriers:', error);
    return [];
  }
}

/**
 * Courier selection helper - chooses best courier based on criteria
 */
export function selectBestCourier(
  rates: CourierRate[],
  preference: 'cheapest' | 'fastest' | 'balanced' = 'balanced'
): CourierRate | null {
  if (rates.length === 0) return null;

  switch (preference) {
    case 'cheapest':
      return rates.sort((a, b) => a.rate - b.rate)[0];
    
    case 'fastest':
      return rates.sort((a, b) => (a.estimatedDays || 999) - (b.estimatedDays || 999))[0];
    
    case 'balanced':
      // Score based on both price and speed
      const scored = rates.map(rate => ({
        ...rate,
        score: (rate.rate / 100) + (rate.estimatedDays || 5) * 10
      }));
      return scored.sort((a, b) => a.score - b.score)[0];
    
    default:
      return rates[0];
  }
}

/**
 * Get courier-specific color class names
 */
export const getCourierColor = (courierName: string | null | undefined): {
  bg: string;
  text: string;
  border: string;
} => {
  if (!courierName) {
    return {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border'
    };
  }

  const courier = courierName.toLowerCase();
  
  if (courier.includes('postex')) {
    return {
      bg: 'bg-courier-postex',
      text: 'text-courier-postex-foreground',
      border: 'border-courier-postex'
    };
  }
  
  if (courier.includes('tcs')) {
    return {
      bg: 'bg-courier-tcs',
      text: 'text-courier-tcs-foreground',
      border: 'border-courier-tcs'
    };
  }
  
  if (courier.includes('leopard')) {
    return {
      bg: 'bg-courier-leopard',
      text: 'text-courier-leopard-foreground',
      border: 'border-courier-leopard'
    };
  }

  // Default for unknown couriers
  return {
    bg: 'bg-primary',
    text: 'text-primary-foreground',
    border: 'border-primary'
  };
};

/**
 * Get courier display badge with color
 */
export const getCourierBadge = (courierName: string | null | undefined): {
  label: string;
  colorClasses: string;
} => {
  const colors = getCourierColor(courierName);
  const label = courierName ? courierName.toUpperCase() : 'NO COURIER';
  
  return {
    label,
    colorClasses: `${colors.bg} ${colors.text} ${colors.border}`
  };
};
