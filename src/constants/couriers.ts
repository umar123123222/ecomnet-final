/**
 * Courier Constants
 */

// Supported Courier Codes
export const COURIER_CODES = {
  POSTEX: 'postex',
  LEOPARD: 'leopard',
  TCS: 'tcs',
  DEAWOO: 'deawoo',
  CALLCOURIER: 'callcourier',
  TRAX: 'trax',
  RIDER: 'rider',
  OTHER: 'other',
} as const;

export type CourierCode = typeof COURIER_CODES[keyof typeof COURIER_CODES];

// Couriers with API integration
export const API_ENABLED_COURIERS: CourierCode[] = [
  COURIER_CODES.POSTEX,
  COURIER_CODES.LEOPARD,
  COURIER_CODES.TCS,
];

// Courier display names
export const COURIER_LABELS: Record<CourierCode, string> = {
  [COURIER_CODES.POSTEX]: 'PostEx',
  [COURIER_CODES.LEOPARD]: 'Leopard',
  [COURIER_CODES.TCS]: 'TCS',
  [COURIER_CODES.DEAWOO]: 'Daewoo',
  [COURIER_CODES.CALLCOURIER]: 'Call Courier',
  [COURIER_CODES.TRAX]: 'Trax',
  [COURIER_CODES.RIDER]: 'Rider',
  [COURIER_CODES.OTHER]: 'Other',
};

// Courier colors for UI
export const COURIER_COLORS: Record<string, string> = {
  [COURIER_CODES.POSTEX]: 'hsl(var(--chart-1))',
  [COURIER_CODES.LEOPARD]: 'hsl(var(--chart-2))',
  [COURIER_CODES.TCS]: 'hsl(var(--chart-3))',
  [COURIER_CODES.DEAWOO]: 'hsl(var(--chart-4))',
  [COURIER_CODES.CALLCOURIER]: 'hsl(var(--chart-5))',
  [COURIER_CODES.TRAX]: 'hsl(var(--primary))',
  [COURIER_CODES.RIDER]: 'hsl(var(--secondary))',
  [COURIER_CODES.OTHER]: 'hsl(var(--muted-foreground))',
};
