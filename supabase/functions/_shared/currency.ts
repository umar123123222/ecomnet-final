/**
 * Shared currency formatting for edge functions
 * Fetches company currency from database or uses default
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  PKR: 'Rs',
  INR: '₹',
  AED: 'د.إ',
  SAR: '﷼',
};

const DEFAULT_CURRENCY = 'PKR';

export async function getCompanyCurrency(supabaseClient: any): Promise<string> {
  try {
    const { data, error } = await supabaseClient
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', 'company_currency')
      .maybeSingle();

    if (!error && data?.setting_value) {
      return data.setting_value;
    }
  } catch (err) {
    console.error('Error fetching company currency:', err);
  }
  
  return DEFAULT_CURRENCY;
}

export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

export function formatCurrencyAmount(
  amount: number, 
  currencyCode: string = DEFAULT_CURRENCY
): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formattedAmount = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${symbol} ${formattedAmount}`;
}
