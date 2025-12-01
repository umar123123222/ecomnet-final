import { format } from 'date-fns';

/**
 * System-wide date and time formatting utilities
 * All time displays use 12-hour format with AM/PM
 */

export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'hh:mm a');
};

export const formatTimeWithSeconds = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'hh:mm:ss a');
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM dd, yyyy hh:mm a');
};

export const formatDateTimeWithSeconds = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM dd, yyyy hh:mm:ss a');
};

export const formatDateTimeShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMM dd, hh:mm a');
};

export const formatDateTimeFull = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'MMMM dd, yyyy hh:mm:ss a');
};

export const formatDateTimeExport = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd hh:mm:ss a');
};

export const formatDateTimeFilename = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'yyyy-MM-dd-hhmmss-a');
};
