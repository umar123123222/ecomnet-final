
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Plus, Filter, Download, ChevronDown, ChevronUp, UserPlus, Trash2, Edit } from 'lucide-react';

const UserManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  const users = [
    {
      id: 'USER-001',
      name: 'John Admin',
      email: 'john@admin.com',
      role: 'Admin',
      status: 'Active',
      lastLogin: '2024-01-15 10:30 AM',
      permissions: ['Dashboard', 'Orders', 'Users', 'Admin Panel'],
      activities: [
        { action: 'Login', timestamp: '2024-01-15 10:30 AM' },
        { action: 'Updated order ORD-001', timestamp: '2024-01-15 10:45 AM' },
        { action: 'Created user USER-005', timestamp: '2024-01-15 11:00 AM' },
      ]
    },
    {
      id: 'USER-002',
      name: 'Jane Manager',
      email: 'jane@manager.com',
      role: 'Manager',
      status: 'Active',
      lastLogin: '2024-01-14 2:15 PM',
      permissions: ['Dashboard', 'Orders', 'Dispatch', 'Returns'],
      activities: [
        { action: 'Login', timestamp: '2024-01-14 2:15 PM' },
        { action: 'Dispatched order ORD-002', timestamp: '2024-01-14 2:30 PM' },
        { action: 'Processed return RTN-001', timestamp: '2024-01-14 3:00 PM' },
      ]
    },
  ];

  const roles = ['Admin', 'Manager', 'Operator', 'Viewer'];

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    setSelectedUsers(
      selectedUsers.length === users.length 
        ? [] 
        : users.map(u => u.id)
    );
  };

  const toggleExpanded = (userId: string) => {
    setExpandedRows(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
          <Button variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </Button>
        </div>
      </div>

      {/* Role Management */}
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {roles.map((role) => (
              <div key={role} className="p-4 border rounded-lg flex items-center justify-between">
                <span className="font-medium">{role}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role.toLowerCase()}>{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={selectedUsers.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="outline" disabled={selectedUsers.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export Users
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedUsers.length === users.length}
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
                <TableHead>Actions</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <TableRow>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.includes(user.id)}
                        onCheckedChange={() => handleSelectUser(user.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800">{user.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={user.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.lastLogin}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpanded(user.id)}
                      >
                        {expandedRows.includes(user.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.includes(user.id) && (
                    <TableRow>
                      <TableCell colSpan={8} className="bg-gray-50 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Permissions</h4>
                            <div className="flex flex-wrap gap-2">
                              {user.permissions.map((permission) => (
                                <Badge key={permission} variant="outline">
                                  {permission}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Recent Activity</h4>
                            <div className="space-y-2">
                              {user.activities.map((activity, index) => (
                                <div key={index} className="text-sm">
                                  <span className="font-medium">{activity.action}</span>
                                  <span className="text-gray-500 ml-2">{activity.timestamp}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
