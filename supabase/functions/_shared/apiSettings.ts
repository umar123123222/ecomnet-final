/**
 * Get an API setting from Supabase secrets (environment variables)
 * All API keys are managed as Supabase secrets for security
 */
export function getAPISetting(
  settingKey: string,
  fallbackEnvVar?: string
): string | null {
  try {
    const envValue = Deno.env.get(fallbackEnvVar || settingKey);
    
    if (envValue) {
      console.log(`Using secret for ${settingKey}`);
      return envValue;
    }

    console.warn(`No secret found for ${settingKey}`);
    return null;
  } catch (error) {
    console.error(`Error getting API setting ${settingKey}:`, error);
    return null;
  }
}

/**
 * Get multiple API settings at once
 */
export function getAPISettings(
  settingKeys: string[]
): Record<string, string> {
  const settings: Record<string, string> = {};

  for (const key of settingKeys) {
    const value = getAPISetting(key);
    if (value) {
      settings[key] = value;
    }
  }

  return settings;
}
