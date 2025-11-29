
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
import { Search, Download, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/utils/activityLogger';

interface Address {
  id: string;
  orderId: string;
  customerName: string;
  phone: string;
  address: string;
  gptScore: number;
  status: 'pending' | 'approved' | 'disapproved';
  approvedBy?: string;
  approvedAt?: string;
  disapprovedBy?: string;
  disapprovedAt?: string;
}

const AddressVerification = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchAddressVerifications = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('address_verifications')
          .select(`
            *,
            orders!fk_address_verifications_order (
              order_number,
              customer_name,
              customer_phone,
              customer_address
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching address verifications:', error);
          toast({
            title: "Error",
            description: "Failed to fetch address verifications",
            variant: "destructive",
          });
        } else {
          const formattedAddresses = (data || []).map(addr => ({
            id: addr.id,
            orderId: addr.orders?.order_number || 'N/A',
            customerName: addr.orders?.customer_name || 'N/A',
            phone: addr.orders?.customer_phone || 'N/A',
            address: addr.orders?.customer_address || 'N/A',
            gptScore: addr.gpt_score || 0,
            status: (addr.verified === true ? 'approved' : addr.verified === false ? 'disapproved' : 'pending') as 'pending' | 'approved' | 'disapproved',
            approvedBy: addr.verified_by || undefined,
            approvedAt: addr.verified_at || undefined
          }));

          setAddresses(formattedAddresses);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAddressVerifications();
  }, [toast]);

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddresses(prev => 
      prev.includes(addressId) 
        ? prev.filter(id => id !== addressId)
        : [...prev, addressId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAddresses(
      selectedAddresses.length === addresses.length 
        ? [] 
        : addresses.map(a => a.id)
    );
  };

  const handleBulkApprove = async () => {
    try {
      const { error } = await supabase
        .from('address_verifications')
        .update({
          verified: true,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .in('id', selectedAddresses);

      if (error) throw error;

      // Also update orders verification status
      const { data: verifications } = await supabase
        .from('address_verifications')
        .select('order_id')
        .in('id', selectedAddresses);

      if (verifications) {
        await supabase
          .from('orders')
          .update({ 
            verification_status: 'approved',
            verified_at: new Date().toISOString(),
            verified_by: user?.id
          })
          .in('id', verifications.map(v => v.order_id));
      }

      toast({
        title: "Success",
        description: `Approved ${selectedAddresses.length} addresses`,
      });

      const currentTime = new Date().toISOString();
      setAddresses(prev => prev.map(address => 
        selectedAddresses.includes(address.id)
          ? {
              ...address,
              status: 'approved' as const,
              approvedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
              approvedAt: currentTime
            }
          : address
      ));
      setSelectedAddresses([]);
    } catch (error: any) {
      console.error('Error approving addresses:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve addresses",
        variant: "destructive",
      });
    }
  };

  const handleBulkDisapprove = async () => {
    try {
      const { error } = await supabase
        .from('address_verifications')
        .update({
          verified: false,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .in('id', selectedAddresses);

      if (error) throw error;

      // Also update orders verification status
      const { data: verifications } = await supabase
        .from('address_verifications')
        .select('order_id')
        .in('id', selectedAddresses);

      if (verifications) {
        await supabase
          .from('orders')
          .update({ 
            verification_status: 'disapproved',
            verified_at: new Date().toISOString(),
            verified_by: user?.id
          })
          .in('id', verifications.map(v => v.order_id));
      }

      toast({
        title: "Success",
        description: `Disapproved ${selectedAddresses.length} addresses`,
      });

      const currentTime = new Date().toISOString();
      setAddresses(prev => prev.map(address => 
        selectedAddresses.includes(address.id)
          ? {
              ...address,
              status: 'disapproved' as const,
              disapprovedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
              disapprovedAt: currentTime
            }
          : address
      ));
      setSelectedAddresses([]);
    } catch (error: any) {
      console.error('Error disapproving addresses:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disapprove addresses",
        variant: "destructive",
      });
    }
  };

  const handleIndividualApprove = async (addressId: string) => {
    try {
      const address = addresses.find(a => a.id === addressId);
      if (!address) return;

      const { error } = await supabase
        .from('address_verifications')
        .update({
          verified: true,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', addressId);

      if (error) throw error;

      // Also update order verification status
      const { data: verification } = await supabase
        .from('address_verifications')
        .select('order_id')
        .eq('id', addressId)
        .single();

      if (verification) {
        await supabase
          .from('orders')
          .update({ 
            verification_status: 'approved',
            verified_at: new Date().toISOString(),
            verified_by: user?.id
          })
          .eq('id', verification.order_id);
      }

      // Log address verification
      await logActivity({
        action: 'address_verified',
        entityType: 'address_verification',
        entityId: addressId,
        details: {
          order_id: address.orderId,
          customer_name: address.customerName,
          verified: true,
        },
      });

      toast({
        title: "Success",
        description: "Address approved successfully",
      });

      const currentTime = new Date().toISOString();
      setAddresses(prev => prev.map(address => 
        address.id === addressId
          ? {
              ...address,
              status: 'approved' as const,
              approvedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
              approvedAt: currentTime
            }
          : address
      ));
    } catch (error: any) {
      console.error('Error approving address:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve address",
        variant: "destructive",
      });
    }
  };

  const handleIndividualDisapprove = async (addressId: string) => {
    try {
      const address = addresses.find(a => a.id === addressId);
      if (!address) return;

      const { error } = await supabase
        .from('address_verifications')
        .update({
          verified: false,
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', addressId);

      if (error) throw error;

      // Also update order verification status
      const { data: verification } = await supabase
        .from('address_verifications')
        .select('order_id')
        .eq('id', addressId)
        .single();

      if (verification) {
        await supabase
          .from('orders')
          .update({ 
            verification_status: 'disapproved',
            verified_at: new Date().toISOString(),
            verified_by: user?.id
          })
          .eq('id', verification.order_id);
      }

      toast({
        title: "Success",
        description: "Address disapproved successfully",
      });

      const currentTime = new Date().toISOString();
      setAddresses(prev => prev.map(address => 
        address.id === addressId
          ? {
              ...address,
              status: 'disapproved' as const,
              disapprovedBy: user?.user_metadata?.full_name || user?.email || 'Current User',
              disapprovedAt: currentTime
            }
          : address
      ));
    } catch (error: any) {
      console.error('Error disapproving address:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disapprove address",
        variant: "destructive",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'disapproved':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
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

      {/* Combined Address Verification Queue with Integrated Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Address Verification Queue</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddresses.length === addresses.length}
                onCheckedChange={handleSelectAll}
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
              />
            </div>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              onClick={handleBulkApprove}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              onClick={handleBulkDisapprove}
            >
              <XCircle className="h-4 w-4 mr-2" />
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>GPT Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">Loading address verifications...</TableCell>
                </TableRow>
              ) : addresses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">No address verifications found</TableCell>
                </TableRow>
              ) : (
                addresses.map((address) => (
                <TableRow key={address.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAddresses.includes(address.id)}
                      onCheckedChange={() => handleSelectAddress(address.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{address.orderId}</TableCell>
                  <TableCell>{address.customerName}</TableCell>
                  <TableCell>{address.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{address.address}</TableCell>
                  <TableCell>
                    <Badge className={getScoreBadge(address.gptScore)}>
                      {address.gptScore}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={getStatusBadge(address.status)}>
                        {address.status}
                      </Badge>
                      {address.status === 'approved' && address.approvedBy && (
                        <p className="text-xs text-gray-500">
                          Approved by {address.approvedBy}
                        </p>
                      )}
                      {address.status === 'disapproved' && address.disapprovedBy && (
                        <p className="text-xs text-gray-500">
                          Disapproved by {address.disapprovedBy}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIndividualApprove(address.id)}
                        disabled={address.status !== 'pending'}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleIndividualDisapprove(address.id)}
                        disabled={address.status !== 'pending'}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleWhatsAppMessage(address.phone)}
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
      </Card>
    </div>
  );
};

export default AddressVerification;
