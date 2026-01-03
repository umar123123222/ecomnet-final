/**
 * Locale and Timezone Configuration
 * Fetched from api_settings table with fallback defaults
 */

// Default Timezone
export const DEFAULT_TIMEZONE = 'Asia/Karachi';

// Default Locale
export const DEFAULT_LOCALE = 'en-PK';

// Locale options for date formatting
export const DATE_LOCALE_OPTIONS = {
  'en-PK': 'en-GB', // Pakistan uses British format
  'en-US': 'en-US',
  'en-GB': 'en-GB',
} as const;

// Timezone UTC offsets (in hours)
export const TIMEZONE_OFFSETS: Record<string, number> = {
  'Asia/Karachi': 5,
  'Asia/Dubai': 4,
  'Asia/Kolkata': 5.5,
  'Europe/London': 0,
  'America/New_York': -5,
  'America/Los_Angeles': -8,
};

// Common timezone options for settings
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Karachi', label: 'Pakistan Standard Time (PKT, UTC+5)' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST, UTC+4)' },
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST, UTC+5:30)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT, UTC+0)' },
  { value: 'America/New_York', label: 'Eastern Time (ET, UTC-5)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT, UTC-8)' },
];

// Locale options for settings
export const LOCALE_OPTIONS = [
  { value: 'en-PK', label: 'English (Pakistan)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
];
