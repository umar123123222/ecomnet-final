import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OpenSessionRequest {
  outlet_id: string;
  register_number?: string;
  opening_cash: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { outlet_id, register_number, opening_cash }: OpenSessionRequest = await req.json();

    console.log('Opening POS session:', { user_id: user.id, outlet_id });

    // Check if user already has an open session
    const { data: existingSession } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .single();

    if (existingSession) {
      throw new Error('You already have an open session. Please close it first.');
    }

    // Generate session number
    const { data: sessionNumber, error: sessionNumError } = await supabase
      .rpc('generate_session_number');

    if (sessionNumError) throw sessionNumError;

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('pos_sessions')
      .insert({
        session_number: sessionNumber,
        outlet_id,
        cashier_id: user.id,
        register_number,
        opening_cash,
        status: 'open',
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Create cash drawer open event
    const { error: drawerError } = await supabase
      .from('cash_drawer_events')
      .insert({
        session_id: session.id,
        event_type: 'open',
        amount: opening_cash,
        created_by: user.id,
        notes: 'Session opened',
      });

    if (drawerError) console.error('Drawer event error:', drawerError);

    // Log activity
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        action: 'pos_session_opened',
        entity_type: 'pos_session',
        entity_id: session.id,
        details: {
          session_number: session.session_number,
          outlet_id,
          register_number,
          opening_cash,
        },
        user_id: user.id,
      });

    if (logError) console.error('Activity log error:', logError);

    console.log('Session opened:', session.session_number);

    return new Response(
      JSON.stringify({ success: true, session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error opening session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
