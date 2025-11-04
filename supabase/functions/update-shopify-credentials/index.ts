import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is super_admin
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .single();

    if (!userRoles) {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { store_url, api_token, api_version, webhook_secret, location_id } = await req.json();

    console.log('Updating Shopify credentials', { store_url, api_version, location_id });

    // Validate required fields
    if (!store_url || !api_token || !api_version) {
      return new Response(JSON.stringify({ error: 'Missing required fields: store_url, api_token, api_version' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate store URL format
    const storeUrlPattern = /^https:\/\/[a-zA-Z0-9-]+\.myshopify\.com$/;
    if (!storeUrlPattern.test(store_url)) {
      return new Response(JSON.stringify({ error: 'Invalid store URL format. Expected: https://your-store.myshopify.com' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Test connection to Shopify before saving
    try {
      const shopifyResponse = await fetch(`${store_url}/admin/api/${api_version}/shop.json`, {
        headers: {
          'X-Shopify-Access-Token': api_token,
          'Content-Type': 'application/json',
        },
      });

      if (!shopifyResponse.ok) {
        const errorText = await shopifyResponse.text();
        console.error('Shopify connection test failed:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Failed to connect to Shopify. Please verify your credentials.',
          details: errorText 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const shopData = await shopifyResponse.json();
      console.log('Shopify connection successful:', shopData.shop?.name);
    } catch (error) {
      console.error('Error testing Shopify connection:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to connect to Shopify. Please check your credentials.',
        details: error.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update api_settings table with non-secret values
    const settingsToUpdate = [
      { setting_key: 'SHOPIFY_STORE_URL', setting_value: store_url, description: 'Shopify store URL' },
      { setting_key: 'SHOPIFY_API_VERSION', setting_value: api_version, description: 'Shopify API version' },
    ];

    if (location_id) {
      settingsToUpdate.push({ 
        setting_key: 'SHOPIFY_LOCATION_ID', 
        setting_value: location_id, 
        description: 'Shopify location ID for inventory sync' 
      });
    }

    for (const setting of settingsToUpdate) {
      const { error: settingError } = await supabaseServiceClient
        .from('api_settings')
        .upsert({
          ...setting,
          updated_by: user.id,
        }, {
          onConflict: 'setting_key'
        });

      if (settingError) {
        console.error(`Error updating ${setting.setting_key}:`, settingError);
        return new Response(JSON.stringify({ 
          error: `Failed to update ${setting.setting_key}`,
          details: settingError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Note: Supabase secrets cannot be updated programmatically from edge functions
    // They must be set via the Supabase CLI or Dashboard
    // We'll provide instructions to the user in the response

    // Log the credential update
    await supabaseServiceClient
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'update',
        entity_type: 'shopify_credentials',
        details: {
          store_url,
          api_version,
          location_id,
          updated_at: new Date().toISOString(),
        },
      });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Shopify settings updated successfully',
      note: 'API Token and Webhook Secret must be updated via Supabase Secrets for security. Please update SHOPIFY_ADMIN_API_TOKEN and SHOPIFY_WEBHOOK_SECRET in your Supabase project settings.',
      secrets_url: `https://supabase.com/dashboard/project/${Deno.env.get('SUPABASE_URL')?.split('//')[1]?.split('.')[0]}/settings/functions`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in update-shopify-credentials:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      details: error.toString() 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
