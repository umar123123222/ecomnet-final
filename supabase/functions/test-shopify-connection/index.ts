import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const supabaseServiceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user authentication by decoding the verified JWT (Supabase already verified it due to verify_jwt=true)
    const token = authHeader.replace('Bearer ', '');
    let userId: string | null = null;
    try {
      const part = token.split('.')[1];
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(part.length + (4 - (part.length % 4 || 4)), '=');
      const payload = JSON.parse(atob(base64));
      userId = payload.sub as string;
    } catch (e) {
      console.error('Invalid JWT payload decode:', e);
      // Fallback to Supabase to validate token
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    }

    // Check if user has super_admin role
    const { data: roleData, error: roleError } = await supabaseServiceClient
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .eq('is_active', true)
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: super_admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { store_url, api_token, api_version } = body;

    // Validate required fields
    if (!store_url || !api_token || !api_version) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: store_url, api_token, api_version' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate store URL format
    const cleanUrl = store_url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleanUrl.includes('.myshopify.com')) {
      return new Response(
        JSON.stringify({ error: 'Invalid store URL format. Expected: your-store.myshopify.com' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API version format (e.g., 2024-10)
    const versionRegex = /^20\d{2}-(01|04|07|10)$/;
    if (!versionRegex.test(api_version)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid API version format. Expected format: YYYY-MM (e.g., 2024-10). Valid months: 01, 04, 07, 10' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing Shopify connection to: https://${cleanUrl}/admin/api/${api_version}/shop.json`);

    // Test connection to Shopify
    const shopifyResponse = await fetch(
      `https://${cleanUrl}/admin/api/${api_version}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': api_token,
          'Content-Type': 'application/json',
        },
      }
    );

    // Handle response
    if (!shopifyResponse.ok) {
      const errorText = await shopifyResponse.text();
      let errorMessage = 'Failed to connect to Shopify';
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.errors || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${shopifyResponse.status}`;
      }

      console.error('Shopify connection failed:', shopifyResponse.status, errorMessage);

      return new Response(
        JSON.stringify({ 
          ok: false,
          error: errorMessage,
          status: shopifyResponse.status,
          hint: shopifyResponse.status === 401 
            ? 'Invalid access token or insufficient permissions'
            : shopifyResponse.status === 404
            ? 'Invalid API version or store URL'
            : 'Please check your credentials and try again'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse successful response
    const shopData = await shopifyResponse.json();
    const { shop } = shopData;

    console.log('Shopify connection successful:', shop.name);

    return new Response(
      JSON.stringify({
        ok: true,
        shop_name: shop.name,
        domain: shop.domain,
        email: shop.email,
        country_code: shop.country_code,
        currency: shop.currency,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in test-shopify-connection:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
