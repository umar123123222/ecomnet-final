// Secret credentials that must come from Supabase Secrets (environment variables)
const SECRET_KEYS = ['SHOPIFY_ADMIN_API_TOKEN', 'SHOPIFY_WEBHOOK_SECRET'];

/**
 * Get an API setting from database or Supabase secrets
 * - Sensitive credentials (API tokens, secrets) are read from Supabase Secrets
 * - Non-sensitive settings (URLs, versions) are read from api_settings table
 */
export async function getAPISetting(
  settingKey: string,
  supabaseClient?: any
): Promise<string | null> {
  try {
    // Secret credentials - must come from Supabase Secrets
    if (SECRET_KEYS.includes(settingKey)) {
      const envValue = Deno.env.get(settingKey);
      if (envValue) {
        console.log(`Using secret for ${settingKey}`);
        return envValue;
      }
      console.warn(`No secret found for ${settingKey}`);
      return null;
    }

    // Non-secret settings - read from api_settings table with fallback to env
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('api_settings')
        .select('setting_value')
        .eq('setting_key', settingKey)
        .maybeSingle();

      if (!error && data?.setting_value) {
        console.log(`Using database setting for ${settingKey}`);
        return data.setting_value;
      }
    }

    // Fallback to environment variable
    const envValue = Deno.env.get(settingKey);
    if (envValue) {
      console.log(`Using environment fallback for ${settingKey}`);
      return envValue;
    }

    console.warn(`No value found for ${settingKey}`);
    return null;
  } catch (error) {
    console.error(`Error getting API setting ${settingKey}:`, error);
    return null;
  }
}

/**
 * Get multiple API settings at once
 */
export async function getAPISettings(
  settingKeys: string[],
  supabaseClient?: any
): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};

  for (const key of settingKeys) {
    const value = await getAPISetting(key, supabaseClient);
    if (value) {
      settings[key] = value;
    }
  }

  return settings;
}
