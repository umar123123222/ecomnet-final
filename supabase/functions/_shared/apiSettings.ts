/**
 * Get an API setting from database
 * All credentials are stored in api_settings table for easy client management
 */
export async function getAPISetting(
  settingKey: string,
  supabaseClient?: any
): Promise<string | null> {
  try {
    // Read from api_settings table
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

    // Fallback to environment variable (for backward compatibility)
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
