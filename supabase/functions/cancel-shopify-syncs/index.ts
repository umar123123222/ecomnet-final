import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelRequestBody {
  types?: string[] | string; // e.g. ['customers','orders'] or 'customers'
  statuses?: string[] | string; // e.g. ['in_progress','processing']
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;

    // 1) User-scoped client to validate the caller's session
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Admin client to bypass RLS for the update
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: CancelRequestBody = await req.json().catch(() => ({}));

    const statuses = Array.isArray(body.statuses)
      ? body.statuses
      : body.statuses
      ? [body.statuses]
      : ['in_progress', 'processing'];

    const types = Array.isArray(body.types)
      ? body.types
      : body.types
      ? [body.types]
      : undefined;

    let query = adminClient
      .from('shopify_sync_log')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_details: {
          cancelled: true,
          reason: 'Cancelled manually via UI',
          cancelled_by: user.id,
          cancelled_at: new Date().toISOString(),
        },
      })
      .in('status', statuses);

    if (types && types.length > 0) {
      query = query.in('sync_type', types);
    }

    const { data: updatedRows, error } = await query.select('id');

    if (error) {
      throw new Error(error.message);
    }

    return new Response(
      JSON.stringify({ success: true, cancelled: updatedRows?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[Cancel Syncs Error]', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
