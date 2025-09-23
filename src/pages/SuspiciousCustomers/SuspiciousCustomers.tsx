
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Search, Download, ChevronDown, ChevronUp, MessageCircle, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/contexts/AuthContext';
import TagsNotes from '@/components/TagsNotes';

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  riskScore: string;
  totalOrders: number;
  deliveredOrders: number;
  failedOrders: number;
  lastMessages: string[];
  tags?: Array<{
    id: string;
    text: string;
    addedBy: string;
    addedAt: string;
    canDelete: boolean;
  }>;
  notes?: Array<{
    id: string;
    text: string;
    addedBy: string;
    addedAt: string;
    canDelete: boolean;
  }>;
}

const SuspiciousCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  useEffect(() => {
    const fetchSuspiciousCustomers = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('suspicious_customers')
          .select(`
            *,
            customers (
              name,
              phone,
              email,
              total_orders,
              delivered_count,
              return_count
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching suspicious customers:', error);
          toast({
            title: "Error",
            description: "Failed to fetch suspicious customers",
            variant: "destructive",
          });
        } else {
          const formattedCustomers = (data || []).map(sc => ({
            id: sc.id,
            name: sc.customers?.name || 'N/A',
            phone: sc.customers?.phone || 'N/A',
            email: sc.customers?.email || 'N/A',
            riskScore: sc.risk_score || 'Medium',
            totalOrders: sc.customers?.total_orders || 0,
            deliveredOrders: sc.customers?.delivered_count || 0,
            failedOrders: (sc.customers?.total_orders || 0) - (sc.customers?.delivered_count || 0),
            lastMessages: Array.isArray(sc.message_log) ? 
              sc.message_log.slice(-3).map(msg => String(msg)) : 
              ['No recent messages'],
            tags: [],
            notes: []
          }));

          setCustomers(formattedCustomers);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSuspiciousCustomers();
  }, [toast]);

  const form = useForm({
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      riskScore: '',
    },
  });

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCustomers(
      selectedCustomers.length === customers.length 
        ? [] 
        : customers.map(c => c.id)
    );
  };

  const toggleExpanded = (customerId: string) => {
    setExpandedRows(prev => 
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleWhatsAppContact = (phone: string) => {
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}`, '_blank');
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      riskScore: customer.riskScore,
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveCustomer = (data: any) => {
    if (editingCustomer) {
      setCustomers(prev => prev.map(customer => 
        customer.id === editingCustomer.id 
          ? { ...customer, ...data }
          : customer
      ));
      setIsEditDialogOpen(false);
      setEditingCustomer(null);
    }
  };

  const handleAddTag = (customerId: string, tag: string) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? {
            ...customer,
            tags: [
              ...(customer.tags || []),
              {
                id: Date.now().toString(),
                text: tag,
                addedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
                addedAt: new Date().toLocaleString(),
                canDelete: true
              }
            ]
          }
        : customer
    ));
  };

  const handleAddNote = (customerId: string, note: string) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? {
            ...customer,
            notes: [
              ...(customer.notes || []),
              {
                id: Date.now().toString(),
                text: note,
                addedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
                addedAt: new Date().toLocaleString(),
                canDelete: true
              }
            ]
          }
        : customer
    ));
  };

  const handleDeleteTag = (customerId: string, tagId: string) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? {
            ...customer,
            tags: customer.tags?.filter(tag => tag.id !== tagId)
          }
        : customer
    ));
  };

  const handleDeleteNote = (customerId: string, noteId: string) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === customerId 
        ? {
            ...customer,
            notes: customer.notes?.filter(note => note.id !== noteId)
          }
        : customer
    ));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suspicious Customers</h1>
          <p className="text-gray-600 mt-1">Monitor and manage high-risk customers</p>
        </div>
      </div>

      {/* Combined Filters and Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Suspicious Customers</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedCustomers.length === customers.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div></div>
            <Button variant="outline" disabled={selectedCustomers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Expand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Loading suspicious customers...</TableCell>
                </TableRow>
              ) : customers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">No suspicious customers found</TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                <React.Fragment key={customer.id}>
                  <TableRow>
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
                        customer.riskScore === 'High' ? 'bg-red-100 text-red-800' : 
                        customer.riskScore === 'Medium' ? 'bg-orange-100 text-orange-800' : 
                        'bg-green-100 text-green-800'
                      }>
                        {customer.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWhatsAppContact(customer.phone)}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditCustomer(customer)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(customer.id)}
                      >
                        {expandedRows.includes(customer.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(customer.id) && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Order History</h4>
                            <div className="space-y-2">
                              <p><span className="font-medium">Total Orders:</span> {customer.totalOrders}</p>
                              <p><span className="font-medium">Delivered:</span> {customer.deliveredOrders}</p>
                              <p><span className="font-medium">Failed:</span> {customer.failedOrders}</p>
                              <p><span className="font-medium">Success Rate:</span> {Math.round((customer.deliveredOrders / customer.totalOrders) * 100)}%</p>
                            </div>
                            <h4 className="font-semibold mb-2 mt-4">Last 10 Messages</h4>
                            <div className="space-y-1">
                              {customer.lastMessages.map((message, index) => (
                                <p key={index} className="text-sm text-gray-600 bg-white p-2 rounded border">
                                  {message}
                                </p>
                              ))}
                            </div>
                          </div>
                          <div>
                            <TagsNotes
                              itemId={customer.id}
                              tags={customer.tags}
                              notes={customer.notes}
                              onAddTag={(tag) => handleAddTag(customer.id, tag)}
                              onAddNote={(note) => handleAddNote(customer.id, note)}
                              onDeleteTag={(tagId) => handleDeleteTag(customer.id, tagId)}
                              onDeleteNote={(noteId) => handleDeleteNote(customer.id, noteId)}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Customer Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Customer Details</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveCustomer)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="riskScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Score</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuspiciousCustomers;
