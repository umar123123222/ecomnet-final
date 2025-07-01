
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, MapPin, AlertTriangle, CheckCircle, X, Download, Filter } from 'lucide-react';
import { useSupabaseQuery, useSupabaseMutation } from '@/hooks/useSupabaseQuery';
import { addressVerificationService, type AddressVerificationData } from '@/services/addressVerificationService';
import { userService } from '@/services/userService';
import { activityLogService } from '@/services/activityLogService';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

const AddressVerificationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('all');
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  const { toast } = useToast();

  // Fetch address verifications
  const {
    data: addressVerifications = [],
    isLoading: verificationsLoading,
    refetch: refetchVerifications
  } = useSupabaseQuery(
    ['address-verifications', verificationFilter, searchTerm],
    () => addressVerificationService.getAddressVerifications({
      verified: verificationFilter === 'verified' ? true : 
               verificationFilter === 'unverified' ? false : undefined,
      search: searchTerm
    })
  );

  // Fetch current user
  const { data: currentUser } = useSupabaseQuery(
    ['current-user'],
    () => userService.getCurrentUser()
  );

  // Approve address mutation
  const approveMutation = useSupabaseMutation(
    (addressId: string) => 
      addressVerificationService.approveAddress(addressId, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Address approved successfully',
        });
        refetchVerifications();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Disapprove address mutation
  const disapproveMutation = useSupabaseMutation(
    (addressId: string) => 
      addressVerificationService.disapproveAddress(addressId, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Address flagged successfully',
        });
        refetchVerifications();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Bulk approve mutation
  const bulkApproveMutation = useSupabaseMutation(
    (addressIds: string[]) => 
      addressVerificationService.bulkApprove(addressIds, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Addresses approved successfully',
        });
        setSelectedAddresses([]);
        refetchVerifications();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  // Bulk disapprove mutation
  const bulkDisapproveMutation = useSupabaseMutation(
    (addressIds: string[]) => 
      addressVerificationService.bulkDisapprove(addressIds, currentUser?.id || ''),
    {
      onSuccess: () => {
        toast({
          title: 'Success',
          description: 'Addresses flagged successfully',
        });
        setSelectedAddresses([]);
        refetchVerifications();
      },
      invalidateKeys: [['address-verifications']]
    }
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const getVerificationBadge = (verified: boolean) => {
    return verified ? (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Verified
      </Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Unverified
      </Badge>
    );
  };

  const handleSelectAddress = (addressId: string) => {
    setSelectedAddresses(prev => 
      prev.includes(addressId) 
        ? prev.filter(id => id !== addressId)
        : [...prev, addressId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAddresses(
      selectedAddresses.length === addressVerifications.length 
        ? [] 
        : addressVerifications.map(addr => addr.id)
    );
  };

  const handleApprove = (addressId: string) => {
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

  const handleDisapprove = (addressId: string) => {
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

  const handleBulkApprove = () => {
    if (selectedAddresses.length === 0) return;
    bulkApproveMutation.mutate(selectedAddresses);
    
    // Log activity
    if (currentUser) {
      activityLogService.logActivity(
        currentUser.id,
        'bulk_approve_addresses',
        'address_verification',
        'bulk',
        { count: selectedAddresses.length }
      );
    }
  };

  const handleBulkDisapprove = () => {
    if (selectedAddresses.length === 0) return;
    bulkDisapproveMutation.mutate(selectedAddresses);
    
    // Log activity
    if (currentUser) {
      activityLogService.logActivity(
        currentUser.id,
        'bulk_disapprove_addresses',
        'address_verification',
        'bulk',
        { count: selectedAddresses.length }
      );
    }
  };

  if (verificationsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Address Verification</h1>
            <p className="text-slate-600 mt-1">Review and verify shipping addresses</p>
          </div>
        </div>

        {/* Bulk Actions Section */}
        {selectedAddresses.length > 0 && (
          <Card className="border-blue-200 bg-blue-50 shadow-sm">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <span className="font-medium text-blue-800">
                    {selectedAddresses.length} address{selectedAddresses.length > 1 ? 'es' : ''} selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={handleBulkApprove}
                    disabled={bulkApproveMutation.isPending}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button 
                    size="sm"
                    variant="outline" 
                    onClick={handleBulkDisapprove}
                    disabled={bulkDisapproveMutation.isPending}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Flag All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Address Verification Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-white">
          <CardTitle className="flex items-center justify-between">
            <span className="text-slate-900">Addresses ({addressVerifications.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAddresses.length === addressVerifications.length && addressVerifications.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">Select All</span>
            </div>
          </CardTitle>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                placeholder="Search addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <Select value={verificationFilter} onValueChange={setVerificationFilter}>
              <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Addresses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
            <Button variant="outline" className="border-slate-300 hover:bg-slate-50">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {addressVerifications.length === 0 ? (
            <EmptyState 
              icon="search"
              title="No addresses found"
              description="No address verifications match your current filters."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Select</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>GPT Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Flagged Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {addressVerifications.map((verification) => (
                    <TableRow key={verification.id} className="hover:bg-slate-50">
                      <TableCell>
                        <Checkbox
                          checked={selectedAddresses.includes(verification.id)}
                          onCheckedChange={() => handleSelectAddress(verification.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">
                        {verification.order?.id?.slice(0, 8) || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="text-slate-700">{verification.order?.customer?.name || 'N/A'}</div>
                          <div className="text-slate-500">{verification.order?.customer?.phone || 'N/A'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-sm text-slate-700 truncate">
                          {verification.order?.shipping_address || 'N/A'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getScoreColor(verification.gpt_score)} border font-medium`}>
                          {verification.gpt_score}%
                        </Badge>
                      </TableCell>
                      <TableCell>{getVerificationBadge(verification.verified)}</TableCell>
                      <TableCell className="text-slate-600">
                        {verification.flagged_reason || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {!verification.verified ? (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleApprove(verification.id)}
                              disabled={approveMutation.isPending}
                              className="border-green-300 text-green-700 hover:bg-green-100"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                          ) : (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDisapprove(verification.id)}
                              disabled={disapproveMutation.isPending}
                              className="border-red-300 text-red-700 hover:bg-red-100"
                            >
                              <X className="h-3 w-3 mr-1" />
                              Flag
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AddressVerificationPage;
