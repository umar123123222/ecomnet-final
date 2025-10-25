import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoginLogs from '@/components/LoginLogs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Search, UserPlus, Download, Edit, Trash2, Eye, Check, ChevronsUpDown, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { manageUser } from '@/integrations/supabase/functions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { UserRole } from '@/types/auth';
const userSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').or(z.literal('')).optional(),
  roles: z.array(z.string()).min(1, 'At least one role is required'),
  supplier_id: z.string().optional()
});
type UserFormData = z.infer<typeof userSchema>;
interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user_roles: Array<{
    role: UserRole;
    is_active: boolean;
  }>;
}
const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isViewUserOpen, setIsViewUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const {
    user: currentUser,
    refreshProfile
  } = useAuth();
  const {
    permissions
  } = useUserRoles();
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      roles: [],
      supplier_id: ''
    },
    mode: 'onChange'
  });
  const availableRoles: UserRole[] = ['super_admin', 'super_manager', 'warehouse_manager', 'store_manager', 'dispatch_manager', 'returns_manager', 'staff', 'supplier'];

  // Fetch suppliers for supplier role assignment
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch users from Supabase
  const {
    data: users = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('profiles').select(`
          id,
          email,
          full_name,
          role,
          is_active,
          created_at,
          updated_at,
          user_roles (
            role,
            is_active
          )
        `).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      return data as UserWithRoles[];
    }
  });

  // Add user mutation
  const addUserMutation = useMutation({
    mutationFn: async (userData: UserFormData) => {
      // First create the user
      const result = await manageUser({
        action: 'create',
        userData: {
          email: userData.email,
          full_name: userData.full_name,
          password: userData.password,
          roles: userData.roles
        }
      });

      // If user has supplier role and supplier_id is provided, create supplier_profile
      if (userData.roles.includes('supplier') && userData.supplier_id) {
        const { error: profileError } = await supabase
          .from('supplier_profiles')
          .insert({
            user_id: result.user.id,
            supplier_id: userData.supplier_id
          });
        
        if (profileError) {
          console.error('Error creating supplier profile:', profileError);
          throw new Error('User created but failed to link to supplier');
        }
      }

      return result;
    },
    onSuccess: async (result) => {
      console.log('User creation result:', result);
      console.log('Profile with roles:', result?.profile);
      console.log('User roles array:', result?.profile?.user_roles);
      
      // Optimistically update cache with new user
      if (result?.profile) {
        queryClient.setQueryData(['users'], (prev: UserWithRoles[] = []) => {
          console.log('Previous users:', prev);
          const exists = prev.some(u => u.id === result.profile.id);
          const newUsers = exists ? prev : [result.profile, ...prev];
          console.log('New users array:', newUsers);
          return newUsers;
        });
      }
      
      // Wait for refetch to complete before closing dialog
      await queryClient.invalidateQueries({
        queryKey: ['users']
      });
      
      toast({
        title: 'Success',
        description: 'User created successfully'
      });
      setIsAddUserOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      // Map friendly error messages
      let errorMessage = error.message || 'Failed to create user';
      if (error.message?.includes('already exists')) {
        errorMessage = 'A user with this email already exists';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      userData
    }: {
      userId: string;
      userData: UserFormData;
    }) => {
      return await manageUser({
        action: 'update',
        userData: {
          userId,
          email: userData.email,
          full_name: userData.full_name,
          roles: userData.roles
        }
      });
    },
    onSuccess: async (result, variables) => {
      console.log('User update result:', result);
      console.log('Updated profile with roles:', result?.profile);
      console.log('Updated user roles array:', result?.profile?.user_roles);
      
      // Optimistically update cache with updated user
      if (result?.profile) {
        queryClient.setQueryData(['users'], (prev: UserWithRoles[] = []) => {
          console.log('Updating user in cache:', result.profile.id);
          return prev.map(u => u.id === result.profile.id ? result.profile : u);
        });
      }
      
      // If updating current user's roles, refresh the auth context
      if (variables.userId === currentUser?.id) {
        await refreshProfile();
      }
      
      // Wait for refetch to complete
      await queryClient.invalidateQueries({
        queryKey: ['users']
      });
      
      toast({
        title: 'Success',
        description: 'User updated successfully'
      });
      setIsEditUserOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      // Map friendly error messages
      let errorMessage = error.message || 'Failed to update user';
      if (error.message?.includes('already assigned')) {
        errorMessage = 'One or more roles are already assigned to this user';
      } else if (error.message?.includes('Insufficient permissions')) {
        errorMessage = 'You do not have permission to modify this user';
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await manageUser({
        action: 'delete',
        userData: {
          userId,
          email: '',
          // Not used for delete
          roles: []
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['users']
      });
      toast({
        title: 'Success',
        description: 'User deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive'
      });
    }
  });
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const userRoles = user.user_roles?.map(ur => ur.role) || [user.role];
      const matchesRole = roleFilter === 'all' || userRoles.includes(roleFilter as UserRole);
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };
  const handleSelectAll = () => {
    setSelectedUsers(selectedUsers.length === filteredUsers.length ? [] : filteredUsers.map(u => u.id));
  };
  const handleAddUser = (data: UserFormData) => {
    addUserMutation.mutate(data);
  };
  const handleEditUser = (data: UserFormData) => {
    console.log('Editing user:', { userId: selectedUser?.id, data: { ...data, password: data.password ? '***' : '(empty)' } });
    if (selectedUser) {
      updateUserMutation.mutate({
        userId: selectedUser.id,
        userData: data
      });
    }
  };
  const handleViewUser = (user: UserWithRoles) => {
    setSelectedUser(user);
    setIsViewUserOpen(true);
  };
  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUserMutation.mutate(userId);
    }
  };
  const openEditDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    const userRoles = user.user_roles?.map(ur => ur.role) || [user.role];
    form.setValue('full_name', user.full_name);
    form.setValue('email', user.email);
    form.setValue('password', ''); // Explicitly clear password field
    form.setValue('roles', userRoles);
    setIsEditUserOpen(true);
  };
  if (!permissions?.canAccessUserManagement) {
    return <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access user management.</p>
          </CardContent>
        </Card>
      </div>;
  }
  if (isLoading) {
    return <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>;
  }
  if (error) {
    return <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Users</h2>
            <p className="text-gray-600">{error.message}</p>
          </CardContent>
        </Card>
      </div>;
  }
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users, permissions, and monitor activities</p>
        </div>
        <div className="flex items-center gap-3">
          {permissions.canAddUsers && <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleAddUser)} className="space-y-4">
                    <FormField control={form.control} name="full_name" render={({
                  field
                }) => <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />
                    <FormField control={form.control} name="email" render={({
                  field
                }) => <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter email" type="email" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />
                    <FormField control={form.control} name="password" render={({
                  field
                }) => <FormItem>
                          <FormLabel>Password (optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Auto-generated if empty" type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>} />
                    <FormField control={form.control} name="roles" render={({
                  field
                }) => {
                  const selectedRoles = field.value || [];
                  return <FormItem>
                            <FormLabel>Roles</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-10">
                      <div className="flex flex-wrap gap-1">
                        {selectedRoles.length > 0 ? selectedRoles.map(role => <Badge key={role} variant="secondary" className="mr-1 mb-1 capitalize">
                            {role.replace(/_/g, ' ')}
                            <span className="ml-1 ring-offset-background rounded-full outline-none cursor-pointer inline-flex" role="button" tabIndex={0} onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            field.onChange((field.value || []).filter(r => r !== role));
                          }
                        }} onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                        }} onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          field.onChange(selectedRoles.filter(r => r !== role));
                        }}>
                              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </span>
                          </Badge>) : <span className="text-muted-foreground">Select roles...</span>}
                      </div>
                                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-full p-0">
                                <Command key={`add-roles-${isAddUserOpen}`}>
                                  <CommandInput placeholder="Search roles..." />
                                  <CommandList>
                                    <CommandEmpty>No role found.</CommandEmpty>
                                    <CommandGroup>
                                      {availableRoles.map(role => <CommandItem key={role} value={role} onSelect={() => {
                                const currentValue = selectedRoles;
                                if (currentValue.includes(role)) {
                                  field.onChange(currentValue.filter(r => r !== role));
                                } else {
                                  field.onChange([...currentValue, role]);
                                }
                              }}>
                                          <Check className={`mr-2 h-4 w-4 ${selectedRoles.includes(role) ? "opacity-100" : "opacity-0"}`} />
                                          <span className="capitalize">{role.replace('_', ' ')}</span>
                                        </CommandItem>)}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>;
                }} />
                    {form.watch('roles')?.includes('supplier') && (
                      <FormField control={form.control} name="supplier_id" render={({
                        field
                      }) => (
                        <FormItem>
                          <FormLabel>Link to Supplier</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a supplier" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliers.map((supplier) => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  {supplier.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddUserOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addUserMutation.isPending}>
                        {addUserMutation.isPending ? <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </> : 'Add User'}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>}
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="font-medium">Total Users:</span> {users.length}</p>
              <p><span className="font-medium">Active Users:</span> {users.filter(u => u.is_active).length}</p>
              <p><span className="font-medium">System Health:</span> <Badge className="bg-green-100 text-green-800">Good</Badge></p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">User Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Super Admins:</span> {users.filter(u => u.user_roles?.some(r => r.role === 'super_admin')).length}</p>
              <p><span className="font-medium">Managers:</span> {users.filter(u => u.user_roles?.some(r => ['super_manager', 'store_manager'].includes(r.role))).length}</p>
              <p><span className="font-medium">Staff:</span> {users.filter(u => u.user_roles?.some(r => r.role === 'staff')).length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full" disabled>
                Export User Data
              </Button>
              <Button variant="outline" size="sm" className="w-full" disabled>
                Generate Report
              </Button>
              <Button variant="outline" size="sm" className="w-full" disabled>
                View Audit Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content with Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="logs">Login Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          {/* Users Table with integrated filters */}
          <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users ({filteredUsers.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0} onCheckedChange={handleSelectAll} />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input placeholder="Search by name, email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {availableRoles.map(role => <SelectItem key={role} value={role} className="capitalize">
                    {role.replace('_', ' ')}
                  </SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedUsers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Users
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => {
                  const userRoles = user.user_roles?.filter(ur => ur.is_active).map(ur => ur.role) || [];
                  return <TableRow key={user.id}>
                    <TableCell>
                      <Checkbox checked={selectedUsers.includes(user.id)} onCheckedChange={() => handleSelectUser(user.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{user.full_name || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length > 0 ? userRoles.map(role => <Badge key={role} className="bg-purple-100 text-purple-800 text-xs capitalize">
                            {role.replace(/_/g, ' ')}
                          </Badge>) : <span className="text-sm text-gray-400">No roles</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleViewUser(user)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        {permissions.canEditUsers && <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            <Edit className="h-3 w-3" />
                          </Button>}
                        {permissions.canDeleteUsers && user.id !== currentUser?.id && <Button variant="outline" size="sm" onClick={() => handleDeleteUser(user.id)} disabled={deleteUserMutation.isPending}>
                            <Trash2 className="h-3 w-3" />
                          </Button>}
                      </div>
                    </TableCell>
                  </TableRow>;
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="logs">
          <LoginLogs />
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditUser)} className="space-y-4">
              <FormField control={form.control} name="full_name" render={({
              field
            }) => <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="email" render={({
              field
            }) => <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
              <FormField control={form.control} name="roles" render={({
              field
            }) => {
              const selectedRoles = field.value || [];
              return <FormItem>
                      <FormLabel>Roles</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-10">
                        <div className="flex flex-wrap gap-1">
                          {selectedRoles.length > 0 ? selectedRoles.map(role => <Badge key={role} variant="secondary" className="mr-1 mb-1 capitalize">
                              {role.replace(/_/g, ' ')}
                              <span className="ml-1 ring-offset-background rounded-full outline-none cursor-pointer inline-flex" role="button" tabIndex={0} onKeyDown={e => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            field.onChange((field.value || []).filter(r => r !== role));
                          }
                        }} onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                        }} onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          field.onChange(selectedRoles.filter(r => r !== role));
                        }}>
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </span>
                            </Badge>) : <span className="text-muted-foreground">Select roles...</span>}
                        </div>
                              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command key={`edit-roles-${isEditUserOpen}-${selectedUser?.id}`}>
                            <CommandInput placeholder="Search roles..." />
                            <CommandList>
                              <CommandEmpty>No role found.</CommandEmpty>
                              <CommandGroup>
                                {availableRoles.map(role => <CommandItem key={role} value={role} onSelect={() => {
                            const currentValue = selectedRoles;
                            if (currentValue.includes(role)) {
                              field.onChange(currentValue.filter(r => r !== role));
                            } else {
                              field.onChange([...currentValue, role]);
                            }
                          }}>
                                    <Check className={`mr-2 h-4 w-4 ${selectedRoles.includes(role) ? "opacity-100" : "opacity-0"}`} />
                                    <span className="capitalize">{role.replace('_', ' ')}</span>
                                  </CommandItem>)}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>;
            }} />
              {form.watch('roles')?.includes('supplier') && (
                <FormField control={form.control} name="supplier_id" render={({
                  field
                }) => (
                  <FormItem>
                    <FormLabel>Link to Supplier</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a supplier" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </> : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View User Dialog */}
      <Dialog open={isViewUserOpen} onOpenChange={setIsViewUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-sm">{selectedUser.full_name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-sm">{selectedUser.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Roles</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(selectedUser.user_roles?.map(ur => ur.role) || [selectedUser.role]).map((role: string) => <Badge key={role} className="bg-purple-100 text-purple-800 text-xs capitalize">
                      {role.replace('_', ' ')}
                    </Badge>)}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="text-sm">{selectedUser.is_active ? 'Active' : 'Inactive'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Created</label>
                <p className="text-sm">{new Date(selectedUser.created_at).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Updated</label>
                <p className="text-sm">{new Date(selectedUser.updated_at).toLocaleString()}</p>
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default UserManagement;