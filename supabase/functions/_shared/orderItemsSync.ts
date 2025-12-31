// Shared utility for syncing order items from Shopify to ERP

interface ShopifyLineItemProperty {
  name: string;
  value: string;
}

interface ShopifyLineItem {
  id: number;
  name: string;
  quantity: number;
  price: string;
  product_id: number;
  variant_id: number;
  properties?: ShopifyLineItemProperty[];
}

interface SyncResult {
  success: boolean;
  itemsCreated: number;
  itemsDeleted: number;
  matchedProducts: number;
  bundleComponents: number;
  error?: string;
}

// Helper to extract Simple Bundles properties from line item
function getSimpleBundleInfo(item: ShopifyLineItem): { bundleTitle: string | null; bundleGroup: string | null } {
  if (!item.properties || item.properties.length === 0) {
    return { bundleTitle: null, bundleGroup: null };
  }
  
  const bundleTitleProp = item.properties.find(p => p.name === '_sb_bundle_title');
  const bundleGroupProp = item.properties.find(p => p.name === '_sb_bundle_group');
  
  return {
    bundleTitle: bundleTitleProp?.value || null,
    bundleGroup: bundleGroupProp?.value || null,
  };
}

/**
 * Syncs order items from Shopify line items to ERP order_items table
 * Handles product matching, bundle expansion, and Simple Bundle detection
 */
export async function syncOrderItems(
  supabase: any,
  orderId: string,
  shopifyLineItems: ShopifyLineItem[],
  isUpdate: boolean = false
): Promise<SyncResult> {
  try {
    let itemsDeleted = 0;
    
    // For updates, delete existing order items first
    if (isUpdate) {
      const { data: existingItems, error: fetchError } = await supabase
        .from('order_items')
        .select('id')
        .eq('order_id', orderId);
      
      if (fetchError) {
        console.error('Error fetching existing order items:', fetchError);
      }
      
      if (existingItems && existingItems.length > 0) {
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', orderId);
        
        if (deleteError) {
          console.error('Error deleting existing order items:', deleteError);
          return {
            success: false,
            itemsCreated: 0,
            itemsDeleted: 0,
            matchedProducts: 0,
            bundleComponents: 0,
            error: `Failed to delete existing items: ${deleteError.message}`
          };
        }
        
        itemsDeleted = existingItems.length;
        console.log(`✓ Deleted ${itemsDeleted} existing order items for order ${orderId}`);
      }
    }
    
    if (!shopifyLineItems || shopifyLineItems.length === 0) {
      console.log('No line items to sync');
      return {
        success: true,
        itemsCreated: 0,
        itemsDeleted,
        matchedProducts: 0,
        bundleComponents: 0
      };
    }
    
    // Fetch all products for matching (include is_bundle flag)
    const { data: products } = await supabase
      .from('products')
      .select('id, name, shopify_product_id, is_bundle');
    
    // Fetch bundle components for all bundles (fixed bundles)
    const { data: bundleComponents } = await supabase
      .from('product_bundle_items')
      .select('bundle_product_id, component_product_id, quantity');
    
    const orderItems: any[] = [];
    
    // First, identify items that are part of Simple Bundles (customer choice bundles)
    // Group items by their _sb_bundle_group to link them together
    const simpleBundleGroups: Map<string, { bundleTitle: string; items: ShopifyLineItem[] }> = new Map();
    const regularItems: ShopifyLineItem[] = [];
    
    for (const item of shopifyLineItems) {
      const { bundleTitle, bundleGroup } = getSimpleBundleInfo(item);
      
      if (bundleTitle && bundleGroup) {
        // This item is part of a Simple Bundle (customer choice)
        if (!simpleBundleGroups.has(bundleGroup)) {
          simpleBundleGroups.set(bundleGroup, { bundleTitle, items: [] });
        }
        simpleBundleGroups.get(bundleGroup)!.items.push(item);
      } else {
        // Regular item (not part of Simple Bundle)
        regularItems.push(item);
      }
    }
    
    // Log Simple Bundles detection
    if (simpleBundleGroups.size > 0) {
      console.log(`✓ Detected ${simpleBundleGroups.size} Simple Bundle(s):`, 
        Array.from(simpleBundleGroups.entries()).map(([group, data]) => ({
          group,
          bundleTitle: data.bundleTitle,
          componentCount: data.items.length,
          components: data.items.map(i => i.name)
        }))
      );
    }
    
    // Process Simple Bundle items (customer choice bundles)
    for (const [bundleGroup, { bundleTitle, items }] of simpleBundleGroups) {
      // Find the bundle product in our system
      const bundleProduct = products?.find((p: any) => 
        p.name.toLowerCase().trim() === bundleTitle.toLowerCase().trim() ||
        p.name.toLowerCase().includes(bundleTitle.toLowerCase()) ||
        bundleTitle.toLowerCase().includes(p.name.toLowerCase())
      );
      
      const bundleProductId = bundleProduct?.id || null;
      
      if (bundleProduct) {
        console.log(`✓ Matched Simple Bundle "${bundleTitle}" to product: ${bundleProduct.name} (${bundleProduct.id})`);
      } else {
        console.warn(`⚠ Could not match Simple Bundle "${bundleTitle}" to any product in system`);
      }
      
      // Create order items for each component in the bundle
      for (const item of items) {
        // Match component product
        let matchedProduct = products?.find((p: any) => 
          p.shopify_product_id && p.shopify_product_id === item.product_id
        );
        
        if (!matchedProduct) {
          matchedProduct = products?.find((p: any) => 
            p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          );
        }
        
        if (!matchedProduct) {
          matchedProduct = products?.find((p: any) => 
            item.name.toLowerCase().includes(p.name.toLowerCase())
          );
        }
        
        orderItems.push({
          order_id: orderId,
          item_name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          product_id: matchedProduct?.id || null,
          shopify_product_id: item.product_id || null,
          shopify_variant_id: item.variant_id || null,
          bundle_product_id: bundleProductId,
          is_bundle_component: true,
          bundle_name: bundleTitle,
        });
      }
    }
    
    // Process regular items (including fixed bundles)
    for (const item of regularItems) {
      // Match by Shopify product ID first (most reliable)
      let matchedProduct = products?.find((p: any) => 
        p.shopify_product_id && p.shopify_product_id === item.product_id
      );
      
      // Fallback to exact name match
      if (!matchedProduct) {
        matchedProduct = products?.find((p: any) => 
          p.name.toLowerCase().trim() === item.name.toLowerCase().trim()
        );
      }
      
      // Fallback to partial name match
      if (!matchedProduct) {
        matchedProduct = products?.find((p: any) => 
          item.name.toLowerCase().includes(p.name.toLowerCase())
        );
      }
      
      // Check if matched product is a FIXED bundle with components
      if (matchedProduct?.is_bundle) {
        const components = bundleComponents?.filter((bc: any) => bc.bundle_product_id === matchedProduct.id) || [];
        
        if (components.length > 0) {
          // Create order items for each component with bundle reference
          for (const component of components) {
            const componentProduct = products?.find((p: any) => p.id === component.component_product_id);
            orderItems.push({
              order_id: orderId,
              item_name: componentProduct?.name || 'Unknown Component',
              quantity: item.quantity * component.quantity,
              price: 0, // Component price is included in bundle
              product_id: component.component_product_id,
              shopify_product_id: componentProduct?.shopify_product_id || null,
              shopify_variant_id: null,
              bundle_product_id: matchedProduct.id,
              is_bundle_component: true,
              bundle_name: matchedProduct.name,
            });
          }
          console.log(`✓ Fixed Bundle "${matchedProduct.name}" expanded to ${components.length} components`);
        } else {
          // Bundle without components - treat as regular product but mark as bundle
          orderItems.push({
            order_id: orderId,
            item_name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            product_id: matchedProduct?.id || null,
            shopify_product_id: item.product_id || null,
            shopify_variant_id: item.variant_id || null,
            bundle_product_id: null,
            is_bundle_component: false,
            bundle_name: null,
          });
          console.log(`⚠ Bundle "${matchedProduct.name}" has no components defined, treating as regular product`);
        }
      } else {
        // Regular product (not a bundle)
        orderItems.push({
          order_id: orderId,
          item_name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          product_id: matchedProduct?.id || null,
          shopify_product_id: item.product_id || null,
          shopify_variant_id: item.variant_id || null,
          bundle_product_id: null,
          is_bundle_component: false,
          bundle_name: null,
        });
      }
    }
    
    // Insert new order items
    if (orderItems.length > 0) {
      const { error: insertError } = await supabase.from('order_items').insert(orderItems);
      
      if (insertError) {
        console.error('Error inserting order items:', insertError);
        return {
          success: false,
          itemsCreated: 0,
          itemsDeleted,
          matchedProducts: 0,
          bundleComponents: 0,
          error: `Failed to insert items: ${insertError.message}`
        };
      }
    }
    
    const matchedCount = orderItems.filter(i => i.product_id).length;
    const bundleComponentCount = orderItems.filter(i => i.is_bundle_component).length;
    const simpleBundleComponentCount = Array.from(simpleBundleGroups.values()).reduce((sum, g) => sum + g.items.length, 0);
    
    console.log(`✓ Synced ${orderItems.length} order items: ${matchedCount} matched to products, ${bundleComponentCount} bundle components (${simpleBundleComponentCount} from Simple Bundles)`);
    
    return {
      success: true,
      itemsCreated: orderItems.length,
      itemsDeleted,
      matchedProducts: matchedCount,
      bundleComponents: bundleComponentCount
    };
  } catch (error: any) {
    console.error('Error syncing order items:', error);
    return {
      success: false,
      itemsCreated: 0,
      itemsDeleted: 0,
      matchedProducts: 0,
      bundleComponents: 0,
      error: error.message
    };
  }
}
