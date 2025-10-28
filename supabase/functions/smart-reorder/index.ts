import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SmartReorderRequest {
  action: 'calculate' | 'generate_po' | 'update_velocity' | 'get_recommendations';
  product_id?: string;
  packaging_item_id?: string;
  outlet_id?: string;
  days_to_analyze?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Check if this is a service role call (automated)
    const isServiceRole = token === supabaseServiceKey;
    
    let user: any = null;
    
    if (!isServiceRole) {
      const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authenticatedUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      user = authenticatedUser;
    }

    const body: SmartReorderRequest = await req.json();
    const { action, product_id, packaging_item_id, outlet_id, days_to_analyze = 30 } = body;

    console.log(`Smart Reorder - Action: ${action}, Product: ${product_id}, Packaging: ${packaging_item_id}`);

    // ACTION: Update sales velocity for products
    if (action === 'update_velocity') {
      // Calculate sales velocity from POS sales and orders
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days_to_analyze);

      if (product_id) {
        // Get POS sales data
        const { data: posSales } = await supabase
          .from('pos_sale_items')
          .select('quantity, sale:pos_sales(sale_date, outlet_id)')
          .eq('product_id', product_id)
          .gte('created_at', startDate.toISOString());

        // Calculate daily average
        const totalSold = posSales?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        const avgDailySales = totalSold / days_to_analyze;

        // Update product
        await supabase
          .from('products')
          .update({
            avg_daily_sales: avgDailySales,
            sales_velocity_updated_at: new Date().toISOString()
          })
          .eq('id', product_id);

        console.log(`Updated product ${product_id} velocity: ${avgDailySales.toFixed(2)} units/day`);
      }

      if (packaging_item_id) {
        // Get production batch usage data
        const { data: bomUsage } = await supabase
          .from('bill_of_materials')
          .select('quantity_required, finished_product:finished_product_id(production_batches(quantity_produced, created_at))')
          .eq('packaging_item_id', packaging_item_id)
          .gte('created_at', startDate.toISOString());

        // Calculate daily average usage
        const totalUsed = bomUsage?.reduce((sum, item) => {
          return sum + (item.quantity_required || 0);
        }, 0) || 0;
        const avgDailyUsage = totalUsed / days_to_analyze;

        // Update packaging item
        await supabase
          .from('packaging_items')
          .update({
            avg_daily_usage: avgDailyUsage,
            usage_velocity_updated_at: new Date().toISOString()
          })
          .eq('id', packaging_item_id);

        console.log(`Updated packaging ${packaging_item_id} velocity: ${avgDailyUsage.toFixed(2)} units/day`);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Velocity updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Get smart reorder recommendations
    if (action === 'get_recommendations') {
      const recommendations: any[] = [];

      // Get products with auto-reorder enabled
      const { data: products } = await supabase
        .from('products')
        .select(`
          id, name, sku,
          avg_daily_sales,
          lead_time_days,
          safety_stock_level,
          reorder_level,
          preferred_supplier_id,
          auto_reorder_enabled,
          suppliers:preferred_supplier_id(id, name),
          inventory!inner(outlet_id, quantity, available_quantity)
        `)
        .eq('auto_reorder_enabled', true)
        .eq('is_active', true);

      for (const product of products || []) {
        for (const inv of product.inventory) {
          const currentStock = inv.available_quantity || inv.quantity || 0;
          
          // Calculate reorder point and quantity using the DB function
          const { data: reorderQty } = await supabase.rpc('calculate_reorder_quantity', {
            p_avg_daily_sales: product.avg_daily_sales || 0,
            p_lead_time_days: product.lead_time_days || 7,
            p_safety_stock: product.safety_stock_level || 0,
            p_current_stock: currentStock
          });

          if (reorderQty && reorderQty > 0) {
            const reorderPoint = Math.ceil(
              (product.avg_daily_sales || 0) * (product.lead_time_days || 7) + (product.safety_stock_level || 0)
            );

            recommendations.push({
              type: 'product',
              item_id: product.id,
              item_name: product.name,
              item_sku: product.sku,
              outlet_id: inv.outlet_id,
              current_stock: currentStock,
              reorder_point: reorderPoint,
              recommended_quantity: reorderQty,
              avg_daily_consumption: product.avg_daily_sales || 0,
              lead_time_days: product.lead_time_days || 7,
              safety_stock: product.safety_stock_level || 0,
              supplier_id: product.preferred_supplier_id,
              supplier_name: product.suppliers?.name
            });
          }
        }
      }

      // Get packaging items with auto-reorder enabled
      const { data: packagingItems } = await supabase
        .from('packaging_items')
        .select(`
          id, name, sku, current_stock,
          avg_daily_usage,
          lead_time_days,
          safety_stock_level,
          reorder_level,
          preferred_supplier_id,
          auto_reorder_enabled,
          suppliers:preferred_supplier_id(id, name)
        `)
        .eq('auto_reorder_enabled', true)
        .eq('is_active', true);

      for (const item of packagingItems || []) {
        const currentStock = item.current_stock || 0;
        
        const { data: reorderQty } = await supabase.rpc('calculate_reorder_quantity', {
          p_avg_daily_sales: item.avg_daily_usage || 0,
          p_lead_time_days: item.lead_time_days || 7,
          p_safety_stock: item.safety_stock_level || 0,
          p_current_stock: currentStock
        });

        if (reorderQty && reorderQty > 0) {
          const reorderPoint = Math.ceil(
            (item.avg_daily_usage || 0) * (item.lead_time_days || 7) + (item.safety_stock_level || 0)
          );

          recommendations.push({
            type: 'packaging',
            item_id: item.id,
            item_name: item.name,
            item_sku: item.sku,
            current_stock: currentStock,
            reorder_point: reorderPoint,
            recommended_quantity: reorderQty,
            avg_daily_consumption: item.avg_daily_usage || 0,
            lead_time_days: item.lead_time_days || 7,
            safety_stock: item.safety_stock_level || 0,
            supplier_id: item.preferred_supplier_id,
            supplier_name: item.suppliers?.name
          });
        }
      }

      console.log(`Found ${recommendations.length} smart reorder recommendations`);

      return new Response(
        JSON.stringify({ success: true, recommendations }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Generate automatic purchase order
    if (action === 'generate_po') {
      if (!product_id && !packaging_item_id) {
        return new Response(
          JSON.stringify({ error: 'product_id or packaging_item_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let itemData: any;
      let currentStock: number;
      let supplierId: string;
      let itemType: 'product' | 'packaging';

      if (product_id) {
        const { data: product } = await supabase
          .from('products')
          .select('*, inventory!inner(quantity, available_quantity, outlet_id)')
          .eq('id', product_id)
          .single();

        if (!product) {
          return new Response(
            JSON.stringify({ error: 'Product not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        itemData = product;
        currentStock = product.inventory?.[0]?.available_quantity || product.inventory?.[0]?.quantity || 0;
        supplierId = product.preferred_supplier_id;
        itemType = 'product';
      } else {
        const { data: packaging } = await supabase
          .from('packaging_items')
          .select('*')
          .eq('id', packaging_item_id)
          .single();

        if (!packaging) {
          return new Response(
            JSON.stringify({ error: 'Packaging item not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        itemData = packaging;
        currentStock = packaging.current_stock || 0;
        supplierId = packaging.preferred_supplier_id;
        itemType = 'packaging';
      }

      if (!supplierId) {
        return new Response(
          JSON.stringify({ error: 'No preferred supplier configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate reorder quantity
      const avgConsumption = itemType === 'product' ? itemData.avg_daily_sales : itemData.avg_daily_usage;
      const { data: reorderQty } = await supabase.rpc('calculate_reorder_quantity', {
        p_avg_daily_sales: avgConsumption || 0,
        p_lead_time_days: itemData.lead_time_days || 7,
        p_safety_stock: itemData.safety_stock_level || 0,
        p_current_stock: currentStock
      });

      if (!reorderQty || reorderQty <= 0) {
        return new Response(
          JSON.stringify({ error: 'No reorder needed - stock levels are adequate' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const reorderPoint = Math.ceil(
        (avgConsumption || 0) * (itemData.lead_time_days || 7) + (itemData.safety_stock_level || 0)
      );

      // Generate PO number
      const poNumber = `AUTO-PO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      // Create purchase order
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: supplierId,
          status: 'draft',
          total_items: 1,
          notes: `Auto-generated PO based on smart reordering - Reorder point: ${reorderPoint}, Current stock: ${currentStock}`
        })
        .select()
        .single();

      if (poError || !po) {
        console.error('Error creating PO:', poError);
        return new Response(
          JSON.stringify({ error: 'Failed to create purchase order', details: poError?.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create PO item
      const poItemData: any = {
        po_id: po.id,
        quantity_ordered: reorderQty,
        unit_cost: itemData.cost || 0
      };

      if (itemType === 'product') {
        poItemData.product_id = product_id;
      } else {
        poItemData.packaging_item_id = packaging_item_id;
      }

      const { error: poItemError } = await supabase
        .from('purchase_order_items')
        .insert(poItemData);

      if (poItemError) {
        console.error('Error creating PO item:', poItemError);
        // Rollback PO
        await supabase.from('purchase_orders').delete().eq('id', po.id);
        return new Response(
          JSON.stringify({ error: 'Failed to create purchase order item', details: poItemError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log auto PO
      const autoPOData: any = {
        po_id: po.id,
        trigger_reason: `Stock below reorder point (${currentStock} < ${reorderPoint})`,
        recommended_quantity: reorderQty,
        calculated_reorder_point: reorderPoint,
        current_stock: currentStock,
        avg_daily_consumption: avgConsumption || 0,
        lead_time_days: itemData.lead_time_days || 7,
        auto_approved: false,
        metadata: {
          item_type: itemType,
          item_id: itemType === 'product' ? product_id : packaging_item_id,
          item_name: itemData.name,
          item_sku: itemData.sku
        }
      };
      
      // Only add created_by if we have a user (not service role)
      if (user) {
        autoPOData.created_by = user.id;
      }
      
      await supabase
        .from('auto_purchase_orders')
        .insert(autoPOData);

      console.log(`Generated automatic PO ${poNumber} for ${itemData.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          po_id: po.id,
          po_number: poNumber,
          recommended_quantity: reorderQty,
          reorder_point: reorderPoint,
          current_stock: currentStock
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in smart-reorder:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
