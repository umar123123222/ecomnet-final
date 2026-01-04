/**
 * Shared locale/timezone utilities for edge functions
 * Fetches timezone settings from api_settings table
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

export const DEFAULT_TIMEZONE = 'Asia/Karachi';
export const DEFAULT_LOCALE = 'en-PK';

// Timezone offsets in hours from UTC
export const TIMEZONE_OFFSETS: Record<string, number> = {
  'Asia/Karachi': 5,
  'Asia/Dubai': 4,
  'Asia/Riyadh': 3,
  'Europe/London': 0,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
};

export interface LocaleSettings {
  timezone: string;
  locale: string;
  timezoneOffset: number;
}

/**
 * Get locale settings from the database
 */
export async function getLocaleSettings(supabaseClient: any): Promise<LocaleSettings> {
  try {
    const { data, error } = await supabaseClient
      .from('api_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['company_timezone', 'company_locale']);

    if (error) {
      console.log('Error fetching locale settings, using defaults:', error.message);
      return {
        timezone: DEFAULT_TIMEZONE,
        locale: DEFAULT_LOCALE,
        timezoneOffset: TIMEZONE_OFFSETS[DEFAULT_TIMEZONE],
      };
    }

    const settingsMap = new Map(data?.map((s: any) => [s.setting_key, s.setting_value]));
    const timezone = (settingsMap.get('company_timezone') as string) || DEFAULT_TIMEZONE;
    const locale = (settingsMap.get('company_locale') as string) || DEFAULT_LOCALE;

    return {
      timezone,
      locale,
      timezoneOffset: TIMEZONE_OFFSETS[timezone] || 5,
    };
  } catch (err) {
    console.log('Exception fetching locale settings, using defaults');
    return {
      timezone: DEFAULT_TIMEZONE,
      locale: DEFAULT_LOCALE,
      timezoneOffset: TIMEZONE_OFFSETS[DEFAULT_TIMEZONE],
    };
  }
}

/**
 * Get current date/time in company timezone
 */
export function getCompanyLocalTime(timezoneOffset: number = 5): Date {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (timezoneOffset * 60 * 60 * 1000));
}

/**
 * Get today's date string in ISO format (YYYY-MM-DD) in company timezone
 */
export function getTodayDateString(timezoneOffset: number = 5): string {
  return getCompanyLocalTime(timezoneOffset).toISOString().split('T')[0];
}

/**
 * Format date for display using locale settings
 */
export function formatLocalDate(
  date: Date | string,
  locale: string = DEFAULT_LOCALE
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeCode = locale === 'en-PK' ? 'en-GB' : locale;

  return d.toLocaleDateString(localeCode, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format date-time for display using locale settings
 */
export function formatLocalDateTime(
  date: Date | string,
  locale: string = DEFAULT_LOCALE
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const localeCode = locale === 'en-PK' ? 'en-GB' : locale;

  return d.toLocaleString(localeCode, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
