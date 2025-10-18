import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Trash2, Shield } from 'lucide-react';

interface OutletStaffManagementProps {
  outletId: string;
}

export const OutletStaffManagement = ({ outletId }: OutletStaffManagementProps) => {
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch outlet staff
  const { data: outletStaff, isLoading } = useQuery({
    queryKey: ['outlet-staff', outletId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('manage-outlet-staff', {
        body: { action: 'list', outlet_id: outletId },
      });
      if (error) throw error;
      return data.staff;
    },
  });

  // Fetch available staff to assign
  const { data: availableStaff } = useQuery({
    queryKey: ['available-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .in('role', ['staff', 'store_manager'])
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  // Assign staff mutation
  const assignStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-outlet-staff', {
        body: {
          action: 'assign',
          outlet_id: outletId,
          user_id: userId,
          can_access_pos: false,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Staff member assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['outlet-staff', outletId] });
      setIsAddingStaff(false);
      setSelectedUserId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign staff member');
    },
  });

  // Toggle POS access mutation
  const togglePOSAccessMutation = useMutation({
    mutationFn: async ({ userId, canAccess }: { userId: string; canAccess: boolean }) => {
      const { data, error } = await supabase.functions.invoke('manage-outlet-staff', {
        body: {
          action: 'toggle_pos_access',
          outlet_id: outletId,
          user_id: userId,
          can_access_pos: canAccess,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('POS access updated successfully');
      queryClient.invalidateQueries({ queryKey: ['outlet-staff', outletId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update POS access');
    },
  });

  // Remove staff mutation
  const removeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('manage-outlet-staff', {
        body: {
          action: 'remove',
          outlet_id: outletId,
          user_id: userId,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Staff member removed successfully');
      queryClient.invalidateQueries({ queryKey: ['outlet-staff', outletId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove staff member');
    },
  });

  const handleAssignStaff = () => {
    if (!selectedUserId) {
      toast.error('Please select a staff member');
      return;
    }
    assignStaffMutation.mutate(selectedUserId);
  };

  const alreadyAssignedIds = outletStaff?.map((s: any) => s.user_id) || [];
  const unassignedStaff = availableStaff?.filter(staff => !alreadyAssignedIds.includes(staff.id)) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Staff & POS Access</CardTitle>
            <CardDescription>Manage staff assignments and POS access for this outlet</CardDescription>
          </div>
          <Dialog open={isAddingStaff} onOpenChange={setIsAddingStaff}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Staff to Outlet</DialogTitle>
                <DialogDescription>
                  Select a staff member to assign to this outlet
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedStaff?.map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.full_name || staff.email} ({staff.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignStaff}
                  disabled={assignStaffMutation.isPending}
                  className="w-full"
                >
                  {assignStaffMutation.isPending ? 'Assigning...' : 'Assign Staff'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading staff...</p>
        ) : outletStaff?.length === 0 ? (
          <p className="text-muted-foreground">No staff assigned to this outlet yet</p>
        ) : (
          <div className="space-y-4">
            {outletStaff?.map((staff: any) => (
              <div key={staff.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{staff.profiles?.full_name || staff.profiles?.email}</p>
                    <Badge variant="outline">{staff.profiles?.role}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{staff.profiles?.email}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${staff.can_access_pos ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className="text-sm text-muted-foreground">POS Access</span>
                    <Switch
                      checked={staff.can_access_pos}
                      onCheckedChange={(checked) =>
                        togglePOSAccessMutation.mutate({
                          userId: staff.user_id,
                          canAccess: checked,
                        })
                      }
                      disabled={togglePOSAccessMutation.isPending}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeStaffMutation.mutate(staff.user_id)}
                    disabled={removeStaffMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
