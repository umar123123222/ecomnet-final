
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Filter, UserPlus, Trash2, Eye, Edit } from 'lucide-react';
import LoginLogs from '@/components/LoginLogs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const addAdminSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['Owner/SuperAdmin', 'Store Manager', 'Dispatch Manager', 'Returns Manager', 'Staff']),
});

const AdminPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isViewAdminOpen, setIsViewAdminOpen] = useState(false);
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

  const form = useForm<z.infer<typeof addAdminSchema>>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Staff',
    },
  });

  const editForm = useForm<z.infer<typeof addAdminSchema>>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Staff',
    },
  });

  const [admins, setAdmins] = useState([
    {
      id: 'SA-001',
      name: 'Muhammad Umar',
      email: 'umaridmpaksitan@gmail.com',
      role: 'Owner/SuperAdmin',
      status: 'Active',
      lastLogin: new Date().toLocaleString(),
      permissions: 'All'
    },
  ]);

  const handleSelectAdmin = (adminId: string) => {
    setSelectedAdmins(prev => 
      prev.includes(adminId) 
        ? prev.filter(id => id !== adminId)
        : [...prev, adminId]
    );
  };

  const handleSelectAll = () => {
    setSelectedAdmins(
      selectedAdmins.length === admins.length 
        ? [] 
        : admins.map(a => a.id)
    );
  };

  const onAddAdminSubmit = (values: z.infer<typeof addAdminSchema>) => {
    const newAdmin = {
      id: `SA-${String(admins.length + 1).padStart(3, '0')}`,
      name: values.name,
      email: values.email,
      role: values.role,
      status: 'Active',
      lastLogin: 'Never',
      permissions: values.role === 'Owner/SuperAdmin' ? 'All' : 'Limited'
    };
    
    setAdmins(prev => [...prev, newAdmin]);
    setIsAddAdminOpen(false);
    form.reset();
    console.log('New admin added:', newAdmin);
  };

  const handleViewAdmin = (admin: any) => {
    setSelectedAdmin(admin);
    setIsViewAdminOpen(true);
  };

  const handleEditAdmin = (admin: any) => {
    setSelectedAdmin(admin);
    editForm.reset({
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
    setIsEditAdminOpen(true);
  };

  const onEditAdminSubmit = (values: z.infer<typeof addAdminSchema>) => {
    if (selectedAdmin) {
      setAdmins(prev => prev.map(admin => 
        admin.id === selectedAdmin.id 
          ? { ...admin, ...values }
          : admin
      ));
      setIsEditAdminOpen(false);
      editForm.reset();
      console.log('Admin updated:', { ...selectedAdmin, ...values });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage system administrators and global actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isAddAdminOpen} onOpenChange={setIsAddAdminOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Administrator</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddAdminSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter full name" {...field} />
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
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter email address" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Staff">Staff</SelectItem>
                            <SelectItem value="Returns Manager">Returns Manager</SelectItem>
                            <SelectItem value="Dispatch Manager">Dispatch Manager</SelectItem>
                            <SelectItem value="Store Manager">Store Manager</SelectItem>
                            <SelectItem value="Owner/SuperAdmin">Owner/SuperAdmin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsAddAdminOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Add Admin</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" disabled={selectedAdmins.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p><span className="font-medium">Total Users:</span> {admins.length}</p>
              <p><span className="font-medium">Active Sessions:</span> 1</p>
              <p><span className="font-medium">System Health:</span> <Badge className="bg-green-100 text-green-800">Good</Badge></p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>User login detected</p>
              <p>System initialized</p>
              <p>Authentication enabled</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                System Backup
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Clear Cache
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                Export Logs
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <LoginLogs />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Admin Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search admins..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admins Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Current Administrators</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAdmins.length === admins.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedAdmins.includes(admin.id)}
                      onCheckedChange={() => handleSelectAdmin(admin.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>
                    <Badge className="bg-purple-100 text-purple-800">{admin.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={admin.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {admin.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{admin.lastLogin}</TableCell>
                  <TableCell>{admin.permissions}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleViewAdmin(admin)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditAdmin(admin)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Admin Dialog */}
      <Dialog open={isViewAdminOpen} onOpenChange={setIsViewAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Details</DialogTitle>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Admin ID</label>
                <p className="text-sm">{selectedAdmin.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-sm">{selectedAdmin.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-sm">{selectedAdmin.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Role</label>
                <p className="text-sm">{selectedAdmin.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <Badge className={selectedAdmin.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {selectedAdmin.status}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Login</label>
                <p className="text-sm">{selectedAdmin.lastLogin}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Permissions</label>
                <p className="text-sm">{selectedAdmin.permissions}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditAdminOpen} onOpenChange={setIsEditAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Administrator</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditAdminSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email address" type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Staff">Staff</SelectItem>
                        <SelectItem value="Returns Manager">Returns Manager</SelectItem>
                        <SelectItem value="Dispatch Manager">Dispatch Manager</SelectItem>
                        <SelectItem value="Store Manager">Store Manager</SelectItem>
                        <SelectItem value="Owner/SuperAdmin">Owner/SuperAdmin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditAdminOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Admin</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
