
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner, LoadingTable } from '@/components/ui/loading-spinner';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { orderService, activityLogService } from '@/services/supabaseService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Download, CheckCircle, XCircle, MessageCircle } from 'lucide-react';

const AddressVerification = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: orders, loading, refetch } = useSupabaseData(
    'orders',
    '*',
    { verification_status: 'pending' },
    { column: 'created_at', ascending: false }
  );

  const filteredOrders = orders.filter((order: any) =>
    order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer_phone.includes(searchTerm)
  );

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddresses(prev => 
      prev.includes(addressId) 
        ? prev.filter(id => id !== addressId)
        : [...prev, addressId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAddresses(
      selectedAddresses.length === filteredOrders.length 
        ? [] 
        : filteredOrders.map((order: any) => order.id)
    );
  };

  const handleBulkAction = async (action: 'approved' | 'disapproved') => {
    if (selectedAddresses.length === 0) return;

    setProcessing(true);
    try {
      await Promise.all(
        selectedAddresses.map(id =>
          orderService.updateVerificationStatus(id, action, undefined, user?.id)
        )
      );

      // Log activity
      await activityLogService.create({
        user_id: user!.id,
        action: `bulk_${action}_addresses`,
        entity_type: 'orders',
        entity_id: 'bulk',
        details: { count: selectedAddresses.length }
      });

      toast({
        title: 'Success',
        description: `${selectedAddresses.length} addresses ${action} successfully`,
      });

      setSelectedAddresses([]);
      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update addresses',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleIndividualAction = async (orderId: string, action: 'approved' | 'disapproved') => {
    try {
      await orderService.updateVerificationStatus(orderId, action, undefined, user?.id);
      
      await activityLogService.create({
        user_id: user!.id,
        action: `${action}_address`,
        entity_type: 'orders',
        entity_id: orderId,
        details: { verification_status: action }
      });

      toast({
        title: 'Success',
        description: `Address ${action} successfully`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update address',
        variant: 'destructive',
      });
    }
  };

  const handleWhatsAppMessage = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Address Verification</h1>
          <p className="text-gray-600 mt-1">Verify and manage customer addresses</p>
        </div>
      </div>

      {/* Address Verification Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Address Verification Queue</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddresses.length === filteredOrders.length && filteredOrders.length > 0}
                onCheckedChange={handleSelectAll}
                disabled={loading}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Bulk Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by order ID, customer name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0 || processing}
              onClick={() => handleBulkAction('approved')}
            >
              {processing ? <LoadingSpinner size="sm" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0 || processing}
              onClick={() => handleBulkAction('disapproved')}
            >
              {processing ? <LoadingSpinner size="sm" /> : <XCircle className="h-4 w-4 mr-2" />}
              Disapprove Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>

          {loading ? (
            <LoadingTable rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Select</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>GPT Score</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order: any) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedAddresses.includes(order.id)}
                        onCheckedChange={() => handleSelectAddress(order.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>{order.customer_phone}</TableCell>
                    <TableCell className="max-w-xs truncate">{order.customer_address}</TableCell>
                    <TableCell>
                      {order.gpt_score && (
                        <Badge className={getScoreBadge(order.gpt_score)}>
                          {order.gpt_score}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleIndividualAction(order.id, 'approved')}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleIndividualAction(order.id, 'disapproved')}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWhatsAppMessage(order.customer_phone)}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No addresses pending verification
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

export default AddressVerification;
