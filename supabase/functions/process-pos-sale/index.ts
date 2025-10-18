import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface POSSaleRequest {
  session_id: string;
  outlet_id: string;
  customer_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    discount_percent?: number;
  }>;
  payment_method: 'cash' | 'card' | 'mobile_wallet' | 'split';
  payments?: Array<{
    payment_method: string;
    amount: number;
    payment_reference?: string;
  }>;
  amount_paid: number;
  tax_rate?: number;
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

    const requestData: POSSaleRequest = await req.json();
    
    console.log('Processing POS sale:', { user_id: user.id, outlet_id: requestData.outlet_id });

    // Validate session is active
    const { data: session, error: sessionError } = await supabase
      .from('pos_sessions')
      .select('*')
      .eq('id', requestData.session_id)
      .eq('status', 'open')
      .single();

    if (sessionError || !session) {
      throw new Error('Invalid or closed session');
    }

    // Calculate totals
    let subtotal = 0;
    const saleItems = [];

    for (const item of requestData.items) {
      const discount_amount = (item.unit_price * item.quantity * (item.discount_percent || 0)) / 100;
      const line_total = (item.unit_price * item.quantity) - discount_amount;
      
      subtotal += line_total;
      
      saleItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
        discount_amount,
        line_total,
      });

      // Check inventory availability
      const { data: inventory, error: invError } = await supabase
        .from('inventory')
        .select('available_quantity')
        .eq('product_id', item.product_id)
        .eq('outlet_id', requestData.outlet_id)
        .single();

      if (invError || !inventory || inventory.available_quantity < item.quantity) {
        const { data: product } = await supabase
          .from('products')
          .select('name')
          .eq('id', item.product_id)
          .single();
        
        throw new Error(`Insufficient stock for ${product?.name || 'product'}`);
      }
    }

    const tax_amount = subtotal * (requestData.tax_rate || 0);
    const total_amount = subtotal + tax_amount;
    const change_amount = requestData.amount_paid - total_amount;

    if (change_amount < 0) {
      throw new Error('Insufficient payment amount');
    }

    // Generate sale number
    const { data: saleNumberData, error: saleNumError } = await supabase
      .rpc('generate_sale_number');

    if (saleNumError) throw saleNumError;

    // Create sale
    const { data: sale, error: saleError } = await supabase
      .from('pos_sales')
      .insert({
        sale_number: saleNumberData,
        session_id: requestData.session_id,
        outlet_id: requestData.outlet_id,
        cashier_id: user.id,
        customer_id: requestData.customer_id,
        subtotal,
        tax_amount,
        total_amount,
        amount_paid: requestData.amount_paid,
        change_amount,
        payment_method: requestData.payment_method,
        status: 'completed',
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Create sale items
    const saleItemsWithId = saleItems.map(item => ({
      ...item,
      sale_id: sale.id,
    }));

    const { error: itemsError } = await supabase
      .from('pos_sale_items')
      .insert(saleItemsWithId);

    if (itemsError) throw itemsError;

    // Handle split payments
    if (requestData.payment_method === 'split' && requestData.payments) {
      const transactions = requestData.payments.map(payment => ({
        sale_id: sale.id,
        payment_method: payment.payment_method,
        amount: payment.amount,
        payment_reference: payment.payment_reference,
      }));

      const { error: transError } = await supabase
        .from('pos_transactions')
        .insert(transactions);

      if (transError) throw transError;
    }

    // Deduct inventory and create stock movements
    for (const item of requestData.items) {
      // Update inventory
      const { error: invUpdateError } = await supabase.rpc('update', {
        table_name: 'inventory',
        filters: {
          product_id: item.product_id,
          outlet_id: requestData.outlet_id,
        },
        updates: {
          quantity: `quantity - ${item.quantity}`,
          available_quantity: `available_quantity - ${item.quantity}`,
        },
      });

      // Create stock movement
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: item.product_id,
          outlet_id: requestData.outlet_id,
          movement_type: 'sale',
          quantity: -item.quantity,
          reference_id: sale.id,
          notes: `POS Sale: ${sale.sale_number}`,
          created_by: user.id,
        });

      if (movementError) console.error('Stock movement error:', movementError);
    }

    // Create cash drawer event
    const { error: drawerError } = await supabase
      .from('cash_drawer_events')
      .insert({
        session_id: requestData.session_id,
        event_type: 'sale',
        amount: total_amount,
        reference_id: sale.id,
        created_by: user.id,
      });

    if (drawerError) console.error('Drawer event error:', drawerError);

    console.log('POS sale completed:', sale.sale_number);

    return new Response(
      JSON.stringify({ success: true, sale }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error processing POS sale:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
