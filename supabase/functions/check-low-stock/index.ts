import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  current_stock: number;
  reorder_level: number;
  type: 'product' | 'packaging';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting low stock check...');

    const lowStockItems: LowStockItem[] = [];

    // Check products with low inventory
    const { data: inventory, error: invError } = await supabase
      .from('inventory')
      .select('*, product:products(*)')
      .lte('available_quantity', supabase.rpc('products', { select: 'reorder_level' }));

    if (invError) {
      console.error('Error fetching inventory:', invError);
    } else {
      inventory?.forEach((inv: any) => {
        if (inv.available_quantity <= inv.product.reorder_level) {
          lowStockItems.push({
            id: inv.product_id,
            name: inv.product.name,
            sku: inv.product.sku,
            current_stock: inv.available_quantity,
            reorder_level: inv.product.reorder_level,
            type: 'product',
          });
        }
      });
    }

    // Check packaging items with low stock
    const { data: packaging, error: pkgError } = await supabase
      .from('packaging_items')
      .select('*')
      .lte('current_stock', supabase.rpc('packaging_items', { select: 'reorder_level' }));

    if (pkgError) {
      console.error('Error fetching packaging:', pkgError);
    } else {
      packaging?.forEach((pkg: any) => {
        if (pkg.current_stock <= pkg.reorder_level) {
          lowStockItems.push({
            id: pkg.id,
            name: pkg.name,
            sku: pkg.sku,
            current_stock: pkg.current_stock,
            reorder_level: pkg.reorder_level,
            type: 'packaging',
          });
        }
      });
    }

    console.log(`Found ${lowStockItems.length} low stock items`);

    let notificationsSent = 0;

    // Process each low stock item
    for (const item of lowStockItems) {
      // Check if notification already sent in last 24 hours
      const { data: recentNotif } = await supabase
        .from('low_stock_notifications')
        .select('id')
        .eq(item.type === 'product' ? 'product_id' : 'packaging_item_id', item.id)
        .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (recentNotif) {
        console.log(`Notification already sent for ${item.name} in last 24h`);
        continue;
      }

      // Find primary supplier
      const { data: suppliers } = await supabase
        .from('supplier_products')
        .select('supplier_id, is_primary_supplier, supplier:suppliers(name, email, whatsapp_number, notification_preferences)')
        .eq(item.type === 'product' ? 'product_id' : 'packaging_item_id', item.id)
        .order('is_primary_supplier', { ascending: false })
        .limit(1);

      if (!suppliers || suppliers.length === 0) {
        console.log(`No supplier assigned for ${item.name}`);
        continue;
      }

      const supplierData = suppliers[0];
      const supplier = supplierData.supplier;
      const suggestedQty = item.reorder_level * 2;

      // Create notification record
      const { error: notifError } = await supabase
        .from('low_stock_notifications')
        .insert({
          [item.type === 'product' ? 'product_id' : 'packaging_item_id']: item.id,
          supplier_id: supplierData.supplier_id,
          notification_type: 'both',
          current_stock: item.current_stock,
          reorder_level: item.reorder_level,
          suggested_quantity: suggestedQty,
        });

      if (notifError) {
        console.error(`Error creating notification for ${item.name}:`, notifError);
        continue;
      }

      // Send email notification (if email configured and enabled)
      if (supplier.email && supplier.notification_preferences?.email) {
        console.log(`Would send email to ${supplier.email} for ${item.name}`);
        // Email sending logic would go here
      }

      // Send WhatsApp notification (if WhatsApp configured and enabled)
      if (supplier.whatsapp_number && supplier.notification_preferences?.whatsapp) {
        const message = `🚨 *Low Stock Alert*\n\nItem: ${item.name}\nSKU: ${item.sku}\nCurrent: ${item.current_stock} units\nNeeded: ${suggestedQty} units\n\nPlease prepare the stock for restocking.`;
        
        try {
          await supabase.functions.invoke('send-whatsapp', {
            body: {
              to: supplier.whatsapp_number,
              message: message,
            },
          });
          console.log(`WhatsApp sent to ${supplier.whatsapp_number}`);
        } catch (whatsappError) {
          console.error(`Error sending WhatsApp:`, whatsappError);
        }
      }

      notificationsSent++;
    }

    console.log(`Sent ${notificationsSent} notifications`);

    return new Response(
      JSON.stringify({
        success: true,
        lowStockItems: lowStockItems.length,
        notificationsSent,
        message: `Processed ${lowStockItems.length} low stock items, sent ${notificationsSent} notifications`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in check-low-stock:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
