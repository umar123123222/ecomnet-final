import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CloseSessionRequest {
  session_id: string;
  closing_cash: number;
  notes?: string;
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

    const { session_id, closing_cash, notes }: CloseSessionRequest = await req.json();

    console.log('Closing POS session:', { user_id: user.id, session_id });

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('cashier_id', user.id)
      .eq('status', 'open')
      .single();

    if (sessionError || !session) {
      throw new Error('Session not found or already closed');
    }

    // Calculate expected cash from sales
    const { data: sales } = await supabase
      .from('pos_sales')
      .select('total_amount, payment_method')
      .eq('session_id', session_id)
      .eq('status', 'completed');

    let expected_cash = session.opening_cash;
    
    if (sales) {
      const cash_sales = sales.filter(s => s.payment_method === 'cash');
      const total_cash_sales = cash_sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
      expected_cash += total_cash_sales;
    }

    // Get cash in/out events
    const { data: cashEvents } = await supabase
      .from('cash_drawer_events')
      .select('event_type, amount')
      .eq('session_id', session_id)
      .in('event_type', ['cash_in', 'cash_out', 'refund']);

    if (cashEvents) {
      for (const event of cashEvents) {
        if (event.event_type === 'cash_in') {
          expected_cash += Number(event.amount);
        } else {
          expected_cash -= Number(event.amount);
        }
      }
    }

    const cash_difference = closing_cash - expected_cash;

    // Update session
    const { data: closedSession, error: updateError } = await supabase
      .from('pos_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closing_cash,
        expected_cash,
        cash_difference,
        notes,
      })
      .eq('id', session_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create cash drawer close event
    const { error: drawerError } = await supabase
      .from('cash_drawer_events')
      .insert({
        session_id,
        event_type: 'close',
        amount: closing_cash,
        created_by: user.id,
        notes: `Session closed. Difference: ${cash_difference}`,
      });

    if (drawerError) console.error('Drawer event error:', drawerError);

    // Log activity
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        action: 'pos_session_closed',
        entity_type: 'pos_session',
        entity_id: session_id,
        details: {
          session_number: session.session_number,
          opening_cash: session.opening_cash,
          closing_cash,
          expected_cash,
          cash_difference,
        },
        user_id: user.id,
      });

    if (logError) console.error('Activity log error:', logError);

    console.log('Session closed:', session.session_number, { cash_difference });

    return new Response(
      JSON.stringify({ 
        success: true, 
        session: closedSession,
        expected_cash,
        cash_difference 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error closing session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
