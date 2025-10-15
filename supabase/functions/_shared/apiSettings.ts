import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

/**
 * Get an API setting from the database or environment variable
 * Priority: Database > Environment Variable
 */
export async function getAPISetting(
  settingKey: string,
  fallbackEnvVar?: string
): Promise<string | null> {
  try {
    // Try to get from database first
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('api_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (!error && data?.setting_value) {
      console.log(`Using database value for ${settingKey}`);
      return data.setting_value;
    }

    // Fallback to environment variable
    const envValue = Deno.env.get(fallbackEnvVar || settingKey);
    if (envValue) {
      console.log(`Using environment variable for ${settingKey}`);
      return envValue;
    }

    console.warn(`No value found for ${settingKey}`);
    return null;
  } catch (error) {
    console.error(`Error getting API setting ${settingKey}:`, error);
    
    // Final fallback to environment variable
    return Deno.env.get(fallbackEnvVar || settingKey) || null;
  }
}

/**
 * Get multiple API settings at once
 */
export async function getAPISettings(
  settingKeys: string[]
): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};

  for (const key of settingKeys) {
    const value = await getAPISetting(key);
    if (value) {
      settings[key] = value;
    }
  }

  return settings;
}
