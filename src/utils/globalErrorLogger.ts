import { logSystemError } from './activityLogger';

/**
 * Global error handler that captures and logs errors system-wide
 */
export const initGlobalErrorLogger = () => {
  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    logSystemError({
      errorType: 'system_error',
      errorMessage: event.message,
      errorStack: event.error?.stack,
      entityId: 'global',
      entityType: 'window',
      additionalDetails: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logSystemError({
      errorType: 'system_error',
      errorMessage: event.reason?.message || String(event.reason),
      errorStack: event.reason?.stack,
      entityId: 'global',
      entityType: 'promise',
      additionalDetails: {
        reason: event.reason,
      },
    });
  });
};

/**
 * Log API errors
 */
export const logApiError = async (
  endpoint: string,
  statusCode: number,
  errorMessage: string,
  additionalDetails?: Record<string, any>
) => {
  await logSystemError({
    errorType: 'api_error',
    errorMessage: `API Error: ${endpoint} - ${errorMessage}`,
    entityId: endpoint,
    entityType: 'api',
    additionalDetails: {
      statusCode,
      endpoint,
      ...additionalDetails,
    },
  });
};

/**
 * Log database errors
 */
export const logDatabaseError = async (
  operation: string,
  errorMessage: string,
  table?: string,
  additionalDetails?: Record<string, any>
) => {
  await logSystemError({
    errorType: 'database_error',
    errorMessage: `Database Error: ${operation} - ${errorMessage}`,
    entityId: table || 'unknown',
    entityType: 'database',
    additionalDetails: {
      operation,
      table,
      ...additionalDetails,
    },
  });
};

/**
 * Log courier errors
 */
export const logCourierError = async (
  courier: string,
  operation: string,
  errorMessage: string,
  orderId?: string,
  additionalDetails?: Record<string, any>
) => {
  await logSystemError({
    errorType: 'courier_error',
    errorMessage: `Courier Error (${courier}): ${operation} - ${errorMessage}`,
    entityId: orderId || 'unknown',
    entityType: 'courier',
    additionalDetails: {
      courier,
      operation,
      ...additionalDetails,
    },
  });
};

/**
 * Log Shopify sync errors
 */
export const logShopifySyncError = async (
  syncType: string,
  errorMessage: string,
  shopifyId?: string | number,
  additionalDetails?: Record<string, any>
) => {
  await logSystemError({
    errorType: 'shopify_sync_error',
    errorMessage: `Shopify Sync Error (${syncType}): ${errorMessage}`,
    entityId: shopifyId ? String(shopifyId) : 'unknown',
    entityType: 'shopify',
    additionalDetails: {
      syncType,
      ...additionalDetails,
    },
  });
};

/**
 * Log authentication errors
 */
export const logAuthError = async (
  errorMessage: string,
  userId?: string,
  additionalDetails?: Record<string, any>
) => {
  await logSystemError({
    errorType: 'authentication_error',
    errorMessage: `Auth Error: ${errorMessage}`,
    entityId: userId || 'anonymous',
    entityType: 'auth',
    additionalDetails,
  });
};