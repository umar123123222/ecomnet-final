import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Eye, Edit, MessageCircle, RefreshCw } from 'lucide-react';
import TagsNotes from '@/components/TagsNotes';
import { useAuth } from '@/contexts/AuthContext';

const AllCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState({
    activeCustomers: 0,
    newThisMonth: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      // Get total count
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });
      
      setTotalCount(totalCustomers || 0);

      // Calculate pagination range
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      // Fetch paginated customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (customersError) {
        console.error('Error fetching customers:', customersError);
        toast({
          title: "Error",
          description: "Failed to fetch customers",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Get order stats for these customers
      const customerIds = customersData?.map(c => c.id) || [];
      
      const { data: orderStats } = await supabase
        .from('orders')
        .select('customer_id, total_amount, status')
        .in('customer_id', customerIds);

      // Calculate order totals per customer
      const orderTotalsMap = new Map<string, { count: number; total: number }>();
      orderStats?.forEach(order => {
        const existing = orderTotalsMap.get(order.customer_id) || { count: 0, total: 0 };
        orderTotalsMap.set(order.customer_id, {
          count: existing.count + 1,
          total: existing.total + (Number(order.total_amount) || 0)
        });
      });

      const formattedCustomers = (customersData || []).map(customer => {
        const orderData = orderTotalsMap.get(customer.id) || { count: 0, total: 0 };
        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone || 'N/A',
          email: customer.email || 'N/A',
          status: 'Active',
          totalOrders: orderData.count,
          totalSpent: `Rs. ${orderData.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          joinDate: new Date(customer.created_at).toLocaleDateString(),
          createdAt: customer.created_at,
          ordersDelivered: customer.delivered_count || 0,
          ordersCancelled: 0,
          ordersReturned: customer.return_count || 0,
          tags: [],
          notes: [],
          orders: []
        };
      });

      setCustomers(formattedCustomers);

      // Calculate summary data
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const newThisMonth = formattedCustomers.filter(c => {
        const createdDate = new Date(c.createdAt);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      }).length;

      setSummaryData({
        activeCustomers: totalCustomers || 0,
        newThisMonth
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();

    // Subscribe to realtime changes on customers table
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        },
        () => {
          // Refetch customers when any change occurs
          fetchCustomers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPage, toast]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCustomers(
      selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0
        ? [] 
        : filteredCustomers.map(c => c.id)
    );
  };

  const handleWhatsAppContact = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  const handleViewCustomer = (customer: any) => {
    setSelectedCustomer(customer);
  };

  const handleEditCustomer = (customer: any) => {
    // Edit customer functionality would be implemented here
    setEditingCustomer({ ...customer });
    setIsEditDialogOpen(true);
  };

  const handleSaveCustomer = () => {
    if (!editingCustomer) return;
    
    const updatedCustomers = customers.map(customer => 
      customer.id === editingCustomer.id ? editingCustomer : customer
    );
    setCustomers(updatedCustomers);
    
    // Update selected customer if it's currently being viewed
    if (selectedCustomer && selectedCustomer.id === editingCustomer.id) {
      setSelectedCustomer(editingCustomer);
    }
    
    setIsEditDialogOpen(false);
    setEditingCustomer(null);
  };

  const handleEditInputChange = (field: string, value: string) => {
    if (!editingCustomer) return;
    setEditingCustomer({
      ...editingCustomer,
      [field]: value
    });
  };

  const handleAddTag = (customerId: string, tag: string) => {
    // Add tag to customer functionality would be implemented here
    const updatedCustomers = customers.map(customer => {
      if (customer.id === customerId) {
        const newTag = {
          id: `tag-${Date.now()}`,
          text: tag,
          addedBy: profile?.full_name || user?.email || 'Current User',
          addedAt: new Date().toLocaleString(),
          canDelete: true
        };
        return {
          ...customer,
          tags: [...customer.tags, newTag]
        };
      }
      return customer;
    });
    setCustomers(updatedCustomers);
    
    // Update selected customer if it's currently being viewed
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updatedCustomer = updatedCustomers.find(c => c.id === customerId);
      setSelectedCustomer(updatedCustomer);
    }
  };

  const handleAddNote = (customerId: string, note: string) => {
    // Add note to customer functionality would be implemented here
    const updatedCustomers = customers.map(customer => {
      if (customer.id === customerId) {
        const newNote = {
          id: `note-${Date.now()}`,
          text: note,
          addedBy: profile?.full_name || user?.email || 'Current User',
          addedAt: new Date().toLocaleString(),
          canDelete: true
        };
        return {
          ...customer,
          notes: [...customer.notes, newNote]
        };
      }
      return customer;
    });
    setCustomers(updatedCustomers);
    
    // Update selected customer if it's currently being viewed
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updatedCustomer = updatedCustomers.find(c => c.id === customerId);
      setSelectedCustomer(updatedCustomer);
    }
  };

  const handleDeleteTag = (customerId: string, tagId: string) => {
    // Delete tag from customer functionality would be implemented here
    const updatedCustomers = customers.map(customer => {
      if (customer.id === customerId) {
        return {
          ...customer,
          tags: customer.tags.filter(tag => tag.id !== tagId)
        };
      }
      return customer;
    });
    setCustomers(updatedCustomers);
    
    // Update selected customer if it's currently being viewed
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updatedCustomer = updatedCustomers.find(c => c.id === customerId);
      setSelectedCustomer(updatedCustomer);
    }
  };

  const handleDeleteNote = (customerId: string, noteId: string) => {
    // Delete note from customer functionality would be implemented here
    const updatedCustomers = customers.map(customer => {
      if (customer.id === customerId) {
        return {
          ...customer,
          notes: customer.notes.filter(note => note.id !== noteId)
        };
      }
      return customer;
    });
    setCustomers(updatedCustomers);
    
    // Update selected customer if it's currently being viewed
    if (selectedCustomer && selectedCustomer.id === customerId) {
      const updatedCustomer = updatedCustomers.find(c => c.id === customerId);
      setSelectedCustomer(updatedCustomer);
    }
  };

  // Filter customers based on search term
  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm.trim()) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.phone?.toLowerCase().includes(search) ||
      customer.email?.toLowerCase().includes(search) ||
      customer.id?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Customers</h1>
          <p className="text-gray-600 mt-1">Manage all customer accounts and information</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {loading ? "..." : summaryData.activeCustomers.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">New This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {loading ? "..." : summaryData.newThisMonth.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Filters and Customer List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              Customer List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
          
          {/* Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer, order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchCustomers} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" disabled={selectedCustomers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">Loading customers...</TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">No customers found</TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => handleSelectCustomer(customer.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email}</TableCell>
                  <TableCell>
                    <Badge className={
                      customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }>
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{customer.totalOrders}</TableCell>
                  <TableCell>{customer.totalSpent}</TableCell>
                  <TableCell>{customer.joinDate}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {/* View Customer Dialog */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleViewCustomer(customer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Customer Details - {customer.name}</DialogTitle>
                            <DialogDescription>
                              Complete customer information, order history, and notes
                            </DialogDescription>
                          </DialogHeader>
                          
                          <Tabs defaultValue="overview" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="orders">Orders</TabsTrigger>
                              <TabsTrigger value="statistics">Statistics</TabsTrigger>
                              <TabsTrigger value="notes-tags">Notes & Tags</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="overview" className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Name</label>
                                  <p className="text-sm text-gray-600">{customer.name}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Phone</label>
                                  <p className="text-sm text-gray-600">{customer.phone}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <p className="text-sm text-gray-600">{customer.email}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <Badge className={
                                    customer.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                  }>
                                    {customer.status}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Join Date</label>
                                  <p className="text-sm text-gray-600">{customer.joinDate}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total Spent</label>
                                  <p className="text-sm text-gray-600">{customer.totalSpent}</p>
                                </div>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="orders" className="space-y-4">
                              <div className="space-y-4">
                                <h3 className="text-lg font-semibold">Order History</h3>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Order ID</TableHead>
                                      <TableHead>Date</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Amount</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {customer.orders.map((order) => (
                                      <TableRow key={order.id}>
                                        <TableCell className="font-medium">{order.id}</TableCell>
                                        <TableCell>{order.date}</TableCell>
                                        <TableCell>
                                          <Badge className={
                                            order.status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                            order.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                          }>
                                            {order.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>{order.amount}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="statistics" className="space-y-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold">{customer.totalOrders}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Delivered</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-green-600">{customer.ordersDelivered}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Cancelled</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-red-600">{customer.ordersCancelled}</div>
                                  </CardContent>
                                </Card>
                                <Card>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-gray-600">Orders Returned</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="text-2xl font-bold text-yellow-600">{customer.ordersReturned}</div>
                                  </CardContent>
                                </Card>
                              </div>
                            </TabsContent>
                            
                            <TabsContent value="notes-tags" className="space-y-4">
                              <TagsNotes
                                itemId={customer.id}
                                tags={customer.tags}
                                notes={customer.notes}
                                onAddTag={(tag) => handleAddTag(customer.id, tag)}
                                onAddNote={(note) => handleAddNote(customer.id, note)}
                                onDeleteTag={(tagId) => handleDeleteTag(customer.id, tagId)}
                                onDeleteNote={(noteId) => handleDeleteNote(customer.id, noteId)}
                              />
                            </TabsContent>
                          </Tabs>
                        </DialogContent>
                      </Dialog>

                      {/* Edit Customer Dialog */}
                      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Customer - {editingCustomer?.name}</DialogTitle>
                            <DialogDescription>
                              Update customer information
                            </DialogDescription>
                          </DialogHeader>
                          
                          {editingCustomer && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Name</label>
                                  <Input
                                    value={editingCustomer.name}
                                    onChange={(e) => handleEditInputChange('name', e.target.value)}
                                    placeholder="Customer name"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Phone</label>
                                  <Input
                                    value={editingCustomer.phone}
                                    onChange={(e) => handleEditInputChange('phone', e.target.value)}
                                    placeholder="Phone number"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Email</label>
                                  <Input
                                    value={editingCustomer.email}
                                    onChange={(e) => handleEditInputChange('email', e.target.value)}
                                    placeholder="Email address"
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Status</label>
                                  <select
                                    value={editingCustomer.status}
                                    onChange={(e) => handleEditInputChange('status', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                  </select>
                                </div>
                              </div>
                              
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setIsEditDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleSaveCustomer}>
                                  Save Changes
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppContact(customer.phone)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-gray-600">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} customers
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                let pageNumber: number;
                if (totalPages <= 5) {
                  pageNumber = idx + 1;
                } else if (currentPage <= 3) {
                  pageNumber = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + idx;
                } else {
                  pageNumber = currentPage - 2 + idx;
                }
                
                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={loading}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AllCustomers;
