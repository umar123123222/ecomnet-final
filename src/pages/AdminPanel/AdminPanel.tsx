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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Search, Filter, UserPlus, Trash2, Eye, Edit } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import LoginLogs from '@/components/LoginLogs';

const adminSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.string().min(1, 'Role is required'),
});

const AdminPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [isEditAdminOpen, setIsEditAdminOpen] = useState(false);
  const [isViewAdminOpen, setIsViewAdminOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null);

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

  const form = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      name: '',
      email: '',
      role: '',
    },
  });

  const roles = ['Owner/SuperAdmin', 'Store Manager', 'Dispatch Manager', 'Returns Manager'];

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

  const handleAddAdmin = (data: z.infer<typeof adminSchema>) => {
    const newAdmin = {
      id: `SA-${String(admins.length + 1).padStart(3, '0')}`,
      name: data.name,
      email: data.email,
      role: data.role,
      status: 'Active',
      lastLogin: 'Never',
      permissions: data.role === 'Owner/SuperAdmin' ? 'All' : 'Limited'
    };
    
    setAdmins(prev => [...prev, newAdmin]);
    setIsAddAdminOpen(false);
    form.reset();
    console.log('Admin added:', newAdmin);
  };

  const handleEditAdmin = (data: z.infer<typeof adminSchema>) => {
    setAdmins(prev => prev.map(admin => 
      admin.id === selectedAdmin?.id 
        ? { ...admin, name: data.name, email: data.email, role: data.role }
        : admin
    ));
    setIsEditAdminOpen(false);
    form.reset();
    console.log('Admin edited:', data);
  };

  const handleViewAdmin = (admin: any) => {
    setSelectedAdmin(admin);
    setIsViewAdminOpen(true);
  };

  const handleDeleteAdmin = (adminId: string) => {
    if (confirm('Are you sure you want to delete this admin?')) {
      setAdmins(prev => prev.filter(admin => admin.id !== adminId));
      console.log('Admin deleted:', adminId);
    }
  };

  const openEditDialog = (admin: any) => {
    setSelectedAdmin(admin);
    form.setValue('name', admin.name);
    form.setValue('email', admin.email);
    form.setValue('role', admin.role);
    setIsEditAdminOpen(true);
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
                <DialogTitle>Add New Admin</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleAddAdmin)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter name" {...field} />
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
                          <Input placeholder="Enter email" type="email" {...field} />
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
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles.map(role => (
                              <SelectItem key={role} value={role}>{role}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
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

      {/* Login Activity Logs */}
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
            <span>Current Administrators ({admins.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedAdmins.length === admins.length && admins.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              {admins.filter(admin => 
                admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                admin.email.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((admin) => (
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
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleViewAdmin(admin)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(admin)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteAdmin(admin.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Admin Dialog */}
      <Dialog open={isEditAdminOpen} onOpenChange={setIsEditAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditAdmin)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
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
                      <Input placeholder="Enter email" type="email" {...field} />
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
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditAdminOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Admin Dialog */}
      <Dialog open={isViewAdminOpen} onOpenChange={setIsViewAdminOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Details</DialogTitle>
          </DialogHeader>
          {selectedAdmin && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-sm">{selectedAdmin.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-sm">{selectedAdmin.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Role</label>
                <p className="text-sm">{selectedAdmin.role}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <p className="text-sm">{selectedAdmin.status}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Last Login</label>
                <p className="text-sm">{selectedAdmin.lastLogin}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Permissions</label>
                <p className="text-sm">{selectedAdmin.permissions}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
