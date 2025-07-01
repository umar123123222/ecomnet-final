
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, LoadingTable } from '@/components/ui/loading-spinner';
import { useRealtimeData } from '@/hooks/useSupabaseData';
import { customerService } from '@/services/supabaseService';
import { useToast } from '@/hooks/use-toast';
import { Customer } from '@/types/database';
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
import { Search, Plus, Edit, Trash2, AlertTriangle, Users } from 'lucide-react';

const AllCustomers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const { data: customers, loading, refetch } = useRealtimeData<Customer>(
    'customers',
    '*',
    undefined
  );

  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSuspicious = async (customerId: string, isSuspicious: boolean) => {
    setProcessing(true);
    try {
      await customerService.update(customerId, {
        is_suspicious: !isSuspicious,
        suspicious_reason: !isSuspicious ? 'Marked as suspicious' : undefined
      });

      toast({
        title: 'Success',
        description: `Customer ${!isSuspicious ? 'marked as suspicious' : 'removed from suspicious list'}`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update customer status',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    setProcessing(true);
    try {
      await customerService.delete(customerId);
      
      toast({
        title: 'Success',
        description: 'Customer deleted successfully',
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete customer',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const getSuspiciousBadge = (isSuspicious: boolean) => {
    return isSuspicious
      ? 'bg-red-100 text-red-800'
      : 'bg-green-100 text-green-800';
  };

  // Calculate average orders per customer safely
  const avgOrdersPerCustomer = customers.length > 0 
    ? Math.round(customers.reduce((sum: number, c: Customer) => sum + (c.total_orders || 0), 0) / customers.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Customers</h1>
          <p className="text-gray-600 mt-1">Manage all customer accounts and information</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Suspicious Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {customers.filter((c: Customer) => c.is_suspicious).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Orders/Customer</p>
                <p className="text-2xl font-bold text-gray-900">{avgOrdersPerCustomer}</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer List</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search customers by name, email, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          {loading ? (
            <LoadingTable rows={10} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Returns</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer: Customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-600">{customer.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-gray-900">{customer.phone}</p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-gray-900">{customer.city}</p>
                        <p className="text-xs text-gray-600 truncate max-w-[200px]">
                          {customer.address}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.total_orders || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{customer.return_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSuspiciousBadge(customer.is_suspicious)}>
                        {customer.is_suspicious ? 'Suspicious' : 'Normal'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleSuspicious(customer.id, customer.is_suspicious)}
                          disabled={processing}
                        >
                          {processing ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCustomer(customer.id)}
                          disabled={processing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCustomers.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AllCustomers;
