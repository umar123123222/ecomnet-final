import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type SearchType = 'all' | 'order_number' | 'tracking_id' | 'tags' | 'order_id';

export interface OrderFilters {
  search: string;
  searchType: SearchType;
  status: string;
  courier: string;
  orderType: string;
  verificationStatus: string;
  statusDateRange: { from: Date; to?: Date } | null;
  dateFilterMode: 'created' | 'status';
  amountMin: number | undefined;
  amountMax: number | undefined;
  city: string;
  hasTrackingId: string;
  hasBundle: string;
  productId: string;
}

export interface FormattedOrder {
  id: string;
  orderNumber: string;
  shopifyOrderNumber: string | null;
  shopifyOrderId: number | null;
  customerId: string;
  trackingId: string;
  customer: string;
  email: string;
  phone: string;
  courier: string;
  status: string;
  verificationStatus: string;
  amount: string;
  date: string;
  createdAtISO: string;
  address: string;
  gptScore: number;
  totalPrice: number;
  shipping_charges: number;
  orderType: string;
  city: string;
  items: any[];
  bundleNames: string[];
  assignedTo: string | null;
  assignedToProfile: any;
  dispatchedAt: string;
  deliveredAt: string;
  orderNotes: string;
  userComments: any[];
  tags: any[];
  shopify_order_id: number | null;
  fraudIndicators?: any;
}

export interface SummaryData {
  totalOrders: number;
  booked: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
  returns: number;
}

const getStatusDateField = (status: string): string => {
  switch (status) {
    case 'pending': return 'created_at';
    case 'booked': return 'booked_at';
    case 'dispatched': return 'dispatched_at';
    case 'delivered': return 'delivered_at';
    case 'returned':
    case 'cancelled': return 'updated_at';
    default: return 'created_at';
  }
};

export const useOrdersData = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const [orders, setOrders] = useState<FormattedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalOrders: 0,
    booked: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    returns: 0
  });
  
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('orders_page_size');
    const initial = saved ? Number(saved) : 50;
    return Math.min(initial, 100);
  });
  
  const [sortOrder, setSortOrder] = useState<'latest' | 'oldest'>('latest');
  const [orderItemsCache, setOrderItemsCache] = useState<Map<string, any[]>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectAllPages, setSelectAllPages] = useState(false);
  
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    searchType: 'all',
    status: 'all',
    courier: 'all',
    orderType: 'all',
    verificationStatus: 'all',
    statusDateRange: null,
    dateFilterMode: 'status',
    amountMin: undefined,
    amountMax: undefined,
    city: 'all',
    hasTrackingId: 'all',
    hasBundle: 'all',
    productId: 'all'
  });

  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [showNewOrdersNotification, setShowNewOrdersNotification] = useState(false);

  // Abort controller ref to cancel stale fetches
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchOrders = useCallback(async () => {
    // Cancel any ongoing fetch to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;

    setLoading(true);
    setOrders([]); // Reset state immediately
    try {
      const effectivePageSize = Math.min(pageSize, 100);
      const offset = page * effectivePageSize;

      let query = supabase.from('orders').select(`
        id, order_number, shopify_order_number, shopify_order_id, customer_id,
        customer_name, customer_email, customer_phone, customer_address, city,
        total_amount, shipping_charges, status, courier, tracking_id, order_type,
        verification_status, assigned_to, created_at, booked_at, dispatched_at,
        delivered_at, updated_at, notes, comments, gpt_score, tags
      `, { count: 'exact' });

      if (filters.search) {
        const searchTerm = filters.search.trim();
        switch (filters.searchType) {
          case 'order_number':
            query = query.or(`order_number.ilike.%${searchTerm}%,shopify_order_number.ilike.%${searchTerm}%`);
            break;
          case 'tracking_id':
            query = query.ilike('tracking_id', `%${searchTerm}%`);
            break;
          case 'tags':
            query = query.contains('tags', [searchTerm]);
            break;
          case 'order_id':
            query = query.ilike('id', `%${searchTerm}%`);
            break;
          default:
            query = query.or(`order_number.ilike.%${searchTerm}%,shopify_order_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%,customer_phone.ilike.%${searchTerm}%,customer_email.ilike.%${searchTerm}%,tracking_id.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
        }
      }

      if (filters.status !== 'all') {
        query = query.eq('status', filters.status as any);
      }

      if (filters.courier === 'none') {
        query = query.is('courier', null);
      } else if (filters.courier !== 'all') {
        query = query.eq('courier', filters.courier as any);
      }

      if (filters.orderType !== 'all') {
        query = query.eq('order_type', filters.orderType);
      }

      if (filters.verificationStatus !== 'all') {
        query = query.eq('verification_status', filters.verificationStatus as any);
      }

      if (filters.statusDateRange?.from) {
        // Use created_at if dateFilterMode is 'created', otherwise use status-based field
        const dateField = filters.dateFilterMode === 'created' 
          ? 'created_at' 
          : getStatusDateField(filters.status);
        const startOfDay = new Date(filters.statusDateRange.from);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte(dateField, startOfDay.toISOString());
        if (filters.statusDateRange.to) {
          const endOfDay = new Date(filters.statusDateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte(dateField, endOfDay.toISOString());
        }
      }

      if (filters.amountMin !== undefined) {
        query = query.gte('total_amount', filters.amountMin);
      }
      if (filters.amountMax !== undefined) {
        query = query.lte('total_amount', filters.amountMax);
      }

      if (filters.city !== 'all') {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.hasTrackingId === 'yes') {
        query = query.not('tracking_id', 'is', null);
      } else if (filters.hasTrackingId === 'no') {
        query = query.is('tracking_id', null);
      }

      // Handle bundle filter - need to get order IDs with bundles first
      let bundleOrderIds: string[] | null = null;
      if (filters.hasBundle !== 'all') {
        // Check if it's a specific bundle name or yes/no filter
        if (filters.hasBundle === 'yes') {
          const { data: bundleOrders } = await supabase
            .from('order_items')
            .select('order_id')
            .or('bundle_name.neq.,is_bundle_component.eq.true');
          
          if (currentAbortController.signal.aborted) return;
          
          bundleOrderIds = [...new Set(bundleOrders?.map(item => item.order_id) || [])];
          
          if (bundleOrderIds.length > 0) {
            query = query.in('id', bundleOrderIds);
          } else {
            setOrders([]);
            setTotalCount(0);
            return;
          }
        } else if (filters.hasBundle === 'no') {
          const { data: bundleOrders } = await supabase
            .from('order_items')
            .select('order_id')
            .or('bundle_name.neq.,is_bundle_component.eq.true');
          
          if (currentAbortController.signal.aborted) return;
          
          bundleOrderIds = [...new Set(bundleOrders?.map(item => item.order_id) || [])];
          
          if (bundleOrderIds.length > 0) {
            query = query.not('id', 'in', `(${bundleOrderIds.join(',')})`);
          }
        } else {
          // Specific bundle name selected
          const { data: bundleOrders } = await supabase
            .from('order_items')
            .select('order_id')
            .eq('bundle_name', filters.hasBundle);
          
          if (currentAbortController.signal.aborted) return;
          
          bundleOrderIds = [...new Set(bundleOrders?.map(item => item.order_id) || [])];
          
          if (bundleOrderIds.length > 0) {
            query = query.in('id', bundleOrderIds);
          } else {
            setOrders([]);
            setTotalCount(0);
            return;
          }
        }
      }

      // Handle product filter - filter by product_id in order_items (includes bundle components)
      if (filters.productId !== 'all') {
        const { data: productOrders } = await supabase
          .from('order_items')
          .select('order_id')
          .eq('product_id', filters.productId);
        
        if (currentAbortController.signal.aborted) return;
        
        const productOrderIds = [...new Set(productOrders?.map(item => item.order_id) || [])];
        
        if (productOrderIds.length > 0) {
          query = query.in('id', productOrderIds);
        } else {
          setOrders([]);
          setTotalCount(0);
          return;
        }
      }

      query = query.order('created_at', { ascending: sortOrder === 'oldest' });
      query = query.range(offset, offset + effectivePageSize - 1);

      const { data: baseOrders, error: ordersError, count } = await query;

      // Check if this fetch was aborted
      if (currentAbortController.signal.aborted) return;

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        if (!currentAbortController.signal.aborted) {
          toast({ title: "Error loading orders", description: ordersError.message, variant: "destructive" });
        }
        setOrders([]);
        return;
      }

      if (!baseOrders || baseOrders.length === 0) {
        if (!currentAbortController.signal.aborted) {
          setOrders([]);
          setTotalCount(0);
        }
        return;
      }

      if (!currentAbortController.signal.aborted) {
        setTotalCount(count || 0);
      }

      // Fetch order_items for orders with total_amount = 0 to calculate actual total
      const zeroAmountOrderIds = baseOrders
        .filter(o => !o.total_amount || o.total_amount === 0)
        .map(o => o.id);
      
      let orderItemsTotals = new Map<string, number>();
      if (zeroAmountOrderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('order_id, price, quantity')
          .in('order_id', zeroAmountOrderIds);
        
        if (currentAbortController.signal.aborted) return;
        
        if (itemsData) {
          itemsData.forEach(item => {
            const currentTotal = orderItemsTotals.get(item.order_id) || 0;
            orderItemsTotals.set(item.order_id, currentTotal + (Number(item.price) * Number(item.quantity)));
          });
        }
      }

      // Fetch bundle names for all visible orders
      const allOrderIds = baseOrders.map(o => o.id);
      const bundleNamesMap = new Map<string, string[]>();
      if (allOrderIds.length > 0) {
        const { data: bundleItems } = await supabase
          .from('order_items')
          .select('order_id, bundle_name, is_bundle_component')
          .in('order_id', allOrderIds)
          .or('bundle_name.neq.,is_bundle_component.eq.true');
        
        if (currentAbortController.signal.aborted) return;
        
        if (bundleItems) {
          bundleItems.forEach(item => {
            if (item.bundle_name || item.is_bundle_component) {
              const existing = bundleNamesMap.get(item.order_id) || [];
              const name = item.bundle_name || 'Bundle';
              if (!existing.includes(name)) {
                existing.push(name);
                bundleNamesMap.set(item.order_id, existing);
              }
            }
          });
        }
      }

      const assignedIds = baseOrders.map(o => o.assigned_to).filter((id): id is string => id != null);
      const commentEmails = new Set<string>();
      baseOrders.forEach(order => {
        if (order.comments) {
          try {
            let comments = typeof order.comments === 'string' ? JSON.parse(order.comments) : order.comments;
            if (Array.isArray(comments)) {
              comments.forEach(comment => {
                if (comment.addedBy?.includes('@')) commentEmails.add(comment.addedBy);
              });
            }
          } catch (e) {}
        }
      });

      const assignedProfilesResult = assignedIds.length > 0 
        ? await supabase.from('profiles').select('id, full_name, email').in('id', assignedIds)
        : { data: [], error: null };

      if (currentAbortController.signal.aborted) return;

      const commentProfilesResult = commentEmails.size > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('email', Array.from(commentEmails))
        : { data: [], error: null };

      if (currentAbortController.signal.aborted) return;

      const profilesById = new Map<string, any>();
      (assignedProfilesResult.data || []).forEach(p => profilesById.set(p.id, p));
      (commentProfilesResult.data || []).forEach(p => profilesById.set(p.id, p));

      const formattedOrders: FormattedOrder[] = baseOrders.map(order => {
        let orderNotes = order.notes && typeof order.notes === 'string' ? order.notes : '';
        let userComments: any[] = [];
        if (order.comments) {
          try {
            userComments = typeof order.comments === 'string' ? JSON.parse(order.comments) : order.comments;
          } catch (e) { userComments = []; }
        }

        userComments = userComments.map(comment => {
          const addedByProfile = Array.from(profilesById.values()).find(p => p.email === comment.addedBy);
          return { ...comment, addedBy: addedByProfile?.full_name || comment.addedBy };
        });

        // Calculate actual total: use total_amount if available, otherwise calculate from order_items
        const actualTotal = order.total_amount || orderItemsTotals.get(order.id) || 0;

        return {
          id: order.id,
          orderNumber: order.order_number,
          shopifyOrderNumber: order.shopify_order_number,
          shopifyOrderId: order.shopify_order_id,
          customerId: order.customer_id || 'N/A',
          trackingId: order.tracking_id || 'N/A',
          customer: order.customer_name,
          email: order.customer_email || 'N/A',
          phone: order.customer_phone,
          courier: order.courier || 'N/A',
          status: order.status,
          verificationStatus: order.verification_status || 'pending',
          amount: `PKR ${actualTotal.toLocaleString()}`,
          date: new Date(order.created_at || '').toLocaleDateString(),
          createdAtISO: order.created_at,
          address: order.customer_address,
          gptScore: order.gpt_score || 0,
          totalPrice: actualTotal,
          shipping_charges: order.shipping_charges || 0,
          orderType: order.order_type || 'COD',
          city: order.city,
          items: [],
          bundleNames: bundleNamesMap.get(order.id) || [],
          assignedTo: order.assigned_to,
          assignedToProfile: order.assigned_to ? profilesById.get(order.assigned_to) : null,
          dispatchedAt: order.dispatched_at ? new Date(order.dispatched_at).toLocaleString() : 'N/A',
          deliveredAt: order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A',
          orderNotes,
          userComments,
          tags: (order.tags || []).map((tag: string, index: number) => {
            const isSystemTag = tag.startsWith('Ecomnet - ') || tag.startsWith('Shopify - ') || tag.includes('Simple Bundles') || tag === 'cancelled' || tag === 'abdullah';
            return {
              id: `tag-${index}`,
              text: tag,
              addedBy: isSystemTag ? 'Shopify' : 'System',
              addedAt: order.created_at || new Date().toISOString(),
              canDelete: !isSystemTag
            };
          }),
          shopify_order_id: order.shopify_order_id
        };
      });

      // Final check before updating state
      if (currentAbortController.signal.aborted) return;

      setOrders(formattedOrders);

      // Fetch summary counts
      if (filters.status !== 'all') {
        const statusCount = count || 0;
        setSummaryData({
          totalOrders: statusCount,
          booked: filters.status === 'booked' ? statusCount : 0,
          dispatched: filters.status === 'dispatched' ? statusCount : 0,
          delivered: filters.status === 'delivered' ? statusCount : 0,
          cancelled: filters.status === 'cancelled' ? statusCount : 0,
          returns: filters.status === 'returned' ? statusCount : 0
        });
      } else {
        const { data: statusCounts } = await supabase.rpc('get_order_counts_by_status_optimized');
        
        if (currentAbortController.signal.aborted) return;

        const counts = (statusCounts || []).reduce((acc: Record<string, number>, item: { status: string; count: number }) => {
          acc[item.status] = item.count;
          return acc;
        }, {});

        setSummaryData({
          totalOrders: count || 0,
          booked: counts['booked'] || 0,
          dispatched: counts['dispatched'] || 0,
          delivered: counts['delivered'] || 0,
          cancelled: counts['cancelled'] || 0,
          returns: counts['returned'] || 0
        });
      }
    } catch (error) {
      if (!currentAbortController.signal.aborted) {
        console.error('Unexpected error:', error);
        toast({ title: "Error", description: "Failed to load orders. Please try again.", variant: "destructive" });
        setOrders([]);
      }
    } finally {
      if (!currentAbortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [page, pageSize, filters, sortOrder, toast]);

  // Fetch on dependency change
  useEffect(() => {
    fetchOrders();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchOrders]);

  // Real-time subscription with debounce
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout;
    
    const channel = supabase.channel('order-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const eventType = (payload as any).eventType;
        if (eventType === 'INSERT') {
          setNewOrdersCount(prev => prev + 1);
          setShowNewOrdersNotification(true);
        } else if (eventType === 'UPDATE') {
          // Debounce rapid consecutive changes (500ms)
          clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            fetchOrders();
          }, 500);
        }
      })
      .subscribe();

    return () => { 
      clearTimeout(refreshTimeout);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      supabase.removeChannel(channel); 
    };
  }, [fetchOrders]);

  // Lazy load order items when expanded
  useEffect(() => {
    const toFetch = Array.from(expandedRows).filter(id => !orderItemsCache.has(id));
    if (toFetch.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('item_name, quantity, price, order_id, bundle_name, bundle_product_id, is_bundle_component')
        .in('order_id', toFetch);

      if (error) {
        console.error('Error fetching order items:', error);
        return;
      }

      const newMap = new Map(orderItemsCache);
      (data || []).forEach((item: any) => {
        if (!newMap.has(item.order_id)) newMap.set(item.order_id, []);
        newMap.get(item.order_id)!.push(item);
      });
      setOrderItemsCache(newMap);
      setOrders(prev => prev.map(o => newMap.has(o.id) ? { ...o, items: newMap.get(o.id) } : o));
    })();
  }, [expandedRows, orderItemsCache]);

  // Handlers
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('orders_page_size', String(newSize));
    setPage(0);
  }, []);

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const handleSelectAllCurrentPage = useCallback(() => {
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  }, [selectedOrders.size, orders]);

  const handleSelectAllPages = useCallback(async () => {
    if (selectAllPages) {
      setSelectAllPages(false);
      setSelectedOrders(new Set());
      return;
    }

    try {
      let query = supabase.from('orders').select('id', { count: 'exact' });

      if (filters.search) {
        query = query.or(`order_number.ilike.%${filters.search}%,shopify_order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,tracking_id.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
      }
      if (filters.status !== 'all') query = query.eq('status', filters.status as any);
      if (filters.courier !== 'all') query = query.eq('courier', filters.courier as any);
      if (filters.orderType !== 'all') query = query.eq('order_type', filters.orderType);
      if (filters.verificationStatus !== 'all') query = query.eq('verification_status', filters.verificationStatus as any);

      if (filters.statusDateRange?.from) {
        const statusDateField = getStatusDateField(filters.status);
        const startOfDay = new Date(filters.statusDateRange.from);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte(statusDateField, startOfDay.toISOString());
        if (filters.statusDateRange.to) {
          const endOfDay = new Date(filters.statusDateRange.to);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte(statusDateField, endOfDay.toISOString());
        }
      }

      if (filters.amountMin !== undefined) query = query.gte('total_amount', filters.amountMin);
      if (filters.amountMax !== undefined) query = query.lte('total_amount', filters.amountMax);
      if (filters.city !== 'all') query = query.ilike('city', `%${filters.city}%`);
      if (filters.hasTrackingId === 'yes') query = query.not('tracking_id', 'is', null);
      else if (filters.hasTrackingId === 'no') query = query.is('tracking_id', null);

      const { data } = await query;
      if (data && data.length > 0) {
        setSelectedOrders(new Set(data.map(o => o.id)));
        setSelectAllPages(true);
        toast({ title: "All Records Selected", description: `Selected ${data.length} order(s) matching your filters` });
      }
    } catch (error) {
      console.error('Error selecting all pages:', error);
      toast({ title: "Selection Failed", description: "Could not select all records.", variant: "destructive" });
    }
  }, [selectAllPages, filters, toast]);

  const toggleExpanded = useCallback((orderId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const updateFilter = useCallback((key: keyof OrderFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      search: '',
      searchType: 'all',
      status: 'all',
      courier: 'all',
      orderType: 'all',
      verificationStatus: 'all',
      statusDateRange: null,
      dateFilterMode: 'status',
      amountMin: undefined,
      amountMax: undefined,
      city: 'all',
      hasTrackingId: 'all',
      hasBundle: 'all',
      productId: 'all'
    });
    setPage(0);
  }, []);

  const handleRefreshNewOrders = useCallback(() => {
    setNewOrdersCount(0);
    setShowNewOrdersNotification(false);
    fetchOrders();
  }, [fetchOrders]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.courier !== 'all') count++;
    if (filters.orderType !== 'all') count++;
    if (filters.verificationStatus !== 'all') count++;
    if (filters.statusDateRange) count++;
    if (filters.amountMin !== undefined || filters.amountMax !== undefined) count++;
    if (filters.city !== 'all') count++;
    if (filters.hasTrackingId !== 'all') count++;
    if (filters.hasBundle !== 'all') count++;
    return count;
  }, [filters]);

  const pagination = useMemo(() => {
    const effective = Math.min(pageSize, 100);
    return {
      effectivePageSize: effective,
      start: page * effective + 1,
      end: Math.min((page + 1) * effective, totalCount),
      totalPages: Math.ceil(totalCount / effective)
    };
  }, [pageSize, page, totalCount]);

  return {
    orders,
    setOrders,
    loading,
    totalCount,
    summaryData,
    page,
    setPage,
    pageSize,
    handlePageSizeChange,
    sortOrder,
    setSortOrder,
    filters,
    updateFilter,
    resetFilters,
    activeFiltersCount,
    selectedOrders,
    setSelectedOrders,
    selectAllPages,
    handleSelectOrder,
    handleSelectAllCurrentPage,
    handleSelectAllPages,
    expandedRows,
    toggleExpanded,
    pagination,
    fetchOrders,
    newOrdersCount,
    showNewOrdersNotification,
    handleRefreshNewOrders,
    user,
    profile
  };
};
