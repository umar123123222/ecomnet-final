import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TIMEZONE, DEFAULT_LOCALE, TIMEZONE_OFFSETS } from "@/constants/locale";

export interface LocaleSettings {
  timezone: string;
  locale: string;
  timezoneOffset: number; // in hours
}

export const useLocaleSettings = () => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['locale-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['company_timezone', 'company_locale']);
      
      if (error) {
        console.log('Locale settings not found, using defaults');
        return {
          timezone: DEFAULT_TIMEZONE,
          locale: DEFAULT_LOCALE,
          timezoneOffset: TIMEZONE_OFFSETS[DEFAULT_TIMEZONE] || 5,
        };
      }
      
      const settingsMap = new Map(data?.map(s => [s.setting_key, s.setting_value]));
      const timezone = settingsMap.get('company_timezone') || DEFAULT_TIMEZONE;
      const locale = settingsMap.get('company_locale') || DEFAULT_LOCALE;
      
      return {
        timezone,
        locale,
        timezoneOffset: TIMEZONE_OFFSETS[timezone] || 5,
      };
    },
  });

  return { 
    settings: settings || { timezone: DEFAULT_TIMEZONE, locale: DEFAULT_LOCALE, timezoneOffset: 5 },
    isLoading 
  };
};

/**
 * Get current date/time in company timezone
 */
export const getCompanyLocalTime = (timezoneOffset: number = 5): Date => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (timezoneOffset * 60 * 60 * 1000));
};

/**
 * Format date for display using locale settings
 */
export const formatLocalDate = (
  date: Date | string,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeCode = locale === 'en-PK' ? 'en-GB' : locale;
  
  return d.toLocaleDateString(localeCode, options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Format date-time for display using locale settings
 */
export const formatLocalDateTime = (
  date: Date | string,
  locale: string = DEFAULT_LOCALE,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeCode = locale === 'en-PK' ? 'en-GB' : locale;
  
  return d.toLocaleString(localeCode, options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
