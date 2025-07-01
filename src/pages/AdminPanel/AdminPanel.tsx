
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
import { Search, Filter, Download, Upload, Eye, Edit, Shield } from 'lucide-react';

const AdminPanel = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdmins, setSelectedAdmins] = useState<string[]>([]);

  const admins = [
    {
      id: 'ADMIN-001',
      name: 'Super Admin',
      email: 'super@admin.com',
      role: 'Super Admin',
      status: 'Active',
      lastLogin: '2024-01-15 10:30 AM',
      permissions: 'All'
    },
    {
      id: 'ADMIN-002',
      name: 'System Admin',
      email: 'system@admin.com',
      role: 'System Admin',
      status: 'Active',
      lastLogin: '2024-01-14 3:15 PM',
      permissions: 'System Management'
    },
  ];

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-1">Manage system administrators and global actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload to Leopard
          </Button>
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload to PostEx
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
              <p><span className="font-medium">Total Users:</span> 156</p>
              <p><span className="font-medium">Active Sessions:</span> 23</p>
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
              <p>Order ORD-123 updated</p>
              <p>System backup completed</p>
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
            <Button variant="outline" disabled={selectedAdmins.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Selected
            </Button>
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
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
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
    </div>
  );
};

export default AdminPanel;
