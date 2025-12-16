import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface OrderFilters {
  search: string;
  status: string;
  courier: string;
  orderType: string;
  verificationStatus: string;
  statusDateRange: { from: Date; to?: Date } | null;
  amountMin: number | undefined;
  amountMax: number | undefined;
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
    status: 'all',
    courier: 'all',
    orderType: 'all',
    verificationStatus: 'all',
    statusDateRange: null,
    amountMin: undefined,
    amountMax: undefined
  });

  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const [showNewOrdersNotification, setShowNewOrdersNotification] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
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
        query = query.or(`order_number.ilike.%${filters.search}%,shopify_order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,customer_email.ilike.%${filters.search}%,tracking_id.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);
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

      if (filters.amountMin !== undefined) {
        query = query.gte('total_amount', filters.amountMin);
      }
      if (filters.amountMax !== undefined) {
        query = query.lte('total_amount', filters.amountMax);
      }

      query = query.order('created_at', { ascending: sortOrder === 'oldest' });
      query = query.range(offset, offset + effectivePageSize - 1);

      const { data: baseOrders, error: ordersError, count } = await query;

      if (ordersError) {
        console.error('Error fetching orders:', ordersError);
        toast({ title: "Error loading orders", description: ordersError.message, variant: "destructive" });
        setOrders([]);
        return;
      }

      if (!baseOrders || baseOrders.length === 0) {
        setOrders([]);
        setTotalCount(0);
        return;
      }

      setTotalCount(count || 0);

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

      const commentProfilesResult = commentEmails.size > 0
        ? await supabase.from('profiles').select('id, full_name, email').in('email', Array.from(commentEmails))
        : { data: [], error: null };

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
          amount: `PKR ${order.total_amount?.toLocaleString() || '0'}`,
          date: new Date(order.created_at || '').toLocaleDateString(),
          createdAtISO: order.created_at,
          address: order.customer_address,
          gptScore: order.gpt_score || 0,
          totalPrice: order.total_amount || 0,
          shipping_charges: order.shipping_charges || 0,
          orderType: order.order_type || 'COD',
          city: order.city,
          items: [],
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
      console.error('Unexpected error:', error);
      toast({ title: "Error", description: "Failed to load orders. Please try again.", variant: "destructive" });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, sortOrder, toast]);

  // Fetch on dependency change
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase.channel('order-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        const eventType = (payload as any).eventType;
        if (eventType === 'INSERT') {
          setNewOrdersCount(prev => prev + 1);
          setShowNewOrdersNotification(true);
        } else if (eventType === 'UPDATE') {
          fetchOrders();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  // Lazy load order items when expanded
  useEffect(() => {
    const toFetch = Array.from(expandedRows).filter(id => !orderItemsCache.has(id));
    if (toFetch.length === 0) return;

    (async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('item_name, quantity, price, order_id')
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
      status: 'all',
      courier: 'all',
      orderType: 'all',
      verificationStatus: 'all',
      statusDateRange: null,
      amountMin: undefined,
      amountMax: undefined
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
