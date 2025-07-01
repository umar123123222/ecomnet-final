
import React, { useState } from 'react';
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
import { Search, Download, CheckCircle, XCircle, MessageCircle, Loader2 } from 'lucide-react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { addressVerificationService, AddressVerification } from '@/services/addressVerificationService';
import { userService } from '@/services/userService';
import { activityLogService } from '@/services/activityLogService';
import { useToast } from '@/hooks/use-toast';

const AddressVerification = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch address verifications
  const {
    data: addresses = [],
    isLoading: addressesLoading,
    refetch: refetchAddresses
  } = useSupabaseQuery(
    ['address-verifications', searchTerm],
    () => addressVerificationService.getAddressVerifications({
      search: searchTerm
    })
  );

  // Fetch current user
  const { data: currentUser } = useSupabaseQuery(
    ['current-user'],
    () => userService.getCurrentUser()
  );

  // Approve mutation
  const approveMutation = useSupabaseMutation(
    (id: string) => addressVerificationService.approveAddress(id, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Address approved successfully',
        });
        refetchAddresses();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Disapprove mutation
  const disapproveMutation = useSupabaseMutation(
    (id: string) => addressVerificationService.disapproveAddress(id, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Address disapproved successfully',
        });
        refetchAddresses();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Bulk approve mutation
  const bulkApproveMutation = useSupabaseMutation(
    (ids: string[]) => addressVerificationService.bulkApprove(ids, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Addresses approved successfully',
        });
        setSelectedAddresses([]);
        refetchAddresses();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Bulk disapprove mutation
  const bulkDisapproveMutation = useSupabaseMutation(
    (ids: string[]) => addressVerificationService.bulkDisapprove(ids, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Addresses disapproved successfully',
        });
        setSelectedAddresses([]);
        refetchAddresses();
      },
      invalidateKeys: [['address-verifications']]
    }
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
      selectedAddresses.length === addresses.length 
        ? [] 
        : addresses.map(a => a.id)
    );
  };

  const handleBulkApprove = () => {
    if (selectedAddresses.length === 0) return;
    bulkApproveMutation.mutate(selectedAddresses);

    // Log activity
    if (currentUser) {
      selectedAddresses.forEach(addressId => {
        activityLogService.logActivity(
          currentUser.id,
          'bulk_approve_address',
          'address_verification',
          addressId,
          { count: selectedAddresses.length }
        );
      });
    }
  };

  const handleBulkDisapprove = () => {
    if (selectedAddresses.length === 0) return;
    bulkDisapproveMutation.mutate(selectedAddresses);

    // Log activity
    if (currentUser) {
      selectedAddresses.forEach(addressId => {
        activityLogService.logActivity(
          currentUser.id,
          'bulk_disapprove_address',
          'address_verification',
          addressId,
          { count: selectedAddresses.length }
        );
      });
    }
  };

  const handleIndividualApprove = (addressId: string) => {
    approveMutation.mutate(addressId);

    // Log activity
    if (currentUser) {
      activityLogService.logActivity(
        currentUser.id,
        'approve_address',
        'address_verification',
        addressId
      );
    }
  };

  const handleIndividualDisapprove = (addressId: string) => {
    disapproveMutation.mutate(addressId);

    // Log activity
    if (currentUser) {
      activityLogService.logActivity(
        currentUser.id,
        'disapprove_address',
        'address_verification',
        addressId
      );
    }
  };

  const handleWhatsAppMessage = (phone: string) => {
    if (!phone) {
      toast({
        title: 'Error',
        description: 'No phone number available',
        variant: 'destructive',
      });
      return;
    }
    
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 60) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-red-50 text-red-700 border-red-200';
  };

  const getStatusBadge = (verified: boolean, verifiedBy?: string) => {
    if (verified) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (verifiedBy) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  const getStatusLabel = (verified: boolean, verifiedBy?: string) => {
    if (verified) return 'Approved';
    if (verifiedBy) return 'Disapproved';
    return 'Pending';
  };

  if (addressesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading address verifications...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Address Verification</h1>
          <p className="text-slate-600 mt-1">Verify and manage customer addresses</p>
        </div>
      </div>

      {/* Address Verification Queue */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-white">
          <CardTitle className="flex items-center justify-between">
            <span className="text-slate-900">Address Verification Queue ({addresses.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddresses.length === addresses.length && addresses.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Bulk Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search by order ID, customer name, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0 || bulkApproveMutation.isPending}
              onClick={handleBulkApprove}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0 || bulkDisapproveMutation.isPending}
              onClick={handleBulkDisapprove}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Disapprove Selected
            </Button>
            <Button 
              variant="outline" 
              disabled={selectedAddresses.length === 0}
              className="border-slate-300 hover:bg-slate-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
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
                {addresses.map((address) => (
                  <TableRow key={address.id} className="hover:bg-slate-50">
                    <TableCell>
                      <Checkbox
                        checked={selectedAddresses.includes(address.id)}
                        onCheckedChange={() => handleSelectAddress(address.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {address.order?.id.slice(0, 8) || 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {address.order?.customer?.name || 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {address.order?.customer?.phone || 'N/A'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-slate-700">
                      {address.order?.shipping_address || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getScoreBadge(address.gpt_score)} border font-medium`}>
                        {address.gpt_score}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={`${getStatusBadge(address.verified, address.verified_by)} border font-medium`}>
                          {getStatusLabel(address.verified, address.verified_by)}
                        </Badge>
                        {address.verifier && (
                          <p className="text-xs text-slate-500">
                            {address.verified ? 'Approved' : 'Disapproved'} by {address.verifier.name}
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
                          disabled={address.verified || approveMutation.isPending}
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleIndividualDisapprove(address.id)}
                          disabled={(address.verified === false && address.verified_by) || disapproveMutation.isPending}
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWhatsAppMessage(address.order?.customer?.phone || '')}
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {addresses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500">No address verifications found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressVerification;
