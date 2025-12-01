
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoginLog } from '@/types/auth';
import { Clock, User } from 'lucide-react';

const LoginLogs = () => {
  const [logs, setLogs] = useState<LoginLog[]>([]);

  useEffect(() => {
    const savedLogs = JSON.parse(localStorage.getItem('loginLogs') || '[]');
    setLogs(savedLogs.reverse()); // Show most recent first
  }, []);

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      hour12: true,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Login Activity Logs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Login Time</TableHead>
              <TableHead>Logout Time</TableHead>
              <TableHead>Session Duration</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Muhammad Umar</span>
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(log.loginTime)}</TableCell>
                <TableCell>
                  {log.logoutTime ? formatDateTime(log.logoutTime) : '-'}
                </TableCell>
                <TableCell>
                  {log.sessionDuration ? formatDuration(log.sessionDuration) : '-'}
                </TableCell>
                <TableCell>
                  <Badge className={log.logoutTime ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}>
                    {log.logoutTime ? 'Ended' : 'Active'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-gray-500">
                  No login activity found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default LoginLogs;
