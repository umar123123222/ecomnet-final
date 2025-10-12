import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, AlertTriangle, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Variance {
  id: string;
  variance: number;
  variance_value: number;
  severity: string;
  status: string;
  root_cause: string | null;
  corrective_action: string | null;
  created_at: string;
  products: { name: string; sku: string } | null;
  outlets: { name: string } | null;
}

const VarianceManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);
  const [selectedVariance, setSelectedVariance] = useState<Variance | null>(null);

  const [investigationData, setInvestigationData] = useState({
    root_cause: '',
    corrective_action: '',
    status: 'investigating'
  });

  // Fetch variances
  const { data: variances = [], isLoading } = useQuery({
    queryKey: ['variances', statusFilter, severityFilter],
    queryFn: async () => {
      let query = supabase
        .from('count_variances')
        .select(`
          *,
          products(name, sku),
          outlets(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Variance[];
    }
  });

  // Update variance
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase
        .from('count_variances')
        .update(data)
        .eq('id', selectedVariance?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['variances'] });
      toast({
        title: 'Variance Updated',
        description: 'Variance investigation has been updated successfully.'
      });
      setIsInvestigateDialogOpen(false);
      setSelectedVariance(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleInvestigate = (variance: Variance) => {
    setSelectedVariance(variance);
    setInvestigationData({
      root_cause: variance.root_cause || '',
      corrective_action: variance.corrective_action || '',
      status: variance.status
    });
    setIsInvestigateDialogOpen(true);
  };

  const handleSaveInvestigation = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...investigationData,
      resolved_at: investigationData.status === 'resolved' ? new Date().toISOString() : null
    });
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, color: string }> = {
      low: { variant: 'secondary', label: 'Low', color: 'text-blue-600' },
      medium: { variant: 'outline', label: 'Medium', color: 'text-yellow-600' },
      high: { variant: 'destructive', label: 'High', color: 'text-orange-600' },
      critical: { variant: 'destructive', label: 'Critical', color: 'text-red-600' }
    };
    const config = variants[severity] || variants.low;
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      open: { variant: 'secondary', label: 'Open' },
      investigating: { variant: 'outline', label: 'Investigating' },
      resolved: { variant: 'default', label: 'Resolved' },
      write_off: { variant: 'destructive', label: 'Write Off' }
    };
    const config = variants[status] || variants.open;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredVariances = variances.filter(v =>
    v.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.products?.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    open: variances.filter(v => v.status === 'open').length,
    investigating: variances.filter(v => v.status === 'investigating').length,
    resolved: variances.filter(v => v.status === 'resolved').length,
    totalValue: variances.reduce((sum, v) => sum + Math.abs(v.variance_value), 0)
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Variance Management</h1>
          <p className="text-muted-foreground">Investigate and resolve stock count variances</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investigating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.investigating}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalValue.toLocaleString()} PKR</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="write_off">Write Off</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Variances List */}
      {isLoading ? (
        <div className="text-center py-12">Loading variances...</div>
      ) : filteredVariances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-muted-foreground">No variances found. Great job!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredVariances.map((variance) => (
            <Card key={variance.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <div>
                        <h3 className="font-semibold text-lg">{variance.products?.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          SKU: {variance.products?.sku} • {variance.outlets?.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Variance:</span>{' '}
                        <span className={variance.variance > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {variance.variance > 0 ? '+' : ''}{variance.variance} units
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value Impact:</span>{' '}
                        <span className="font-semibold">
                          {Math.abs(variance.variance_value).toLocaleString()} PKR
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reported:</span>{' '}
                        {format(new Date(variance.created_at), 'MMM dd, yyyy')}
                      </div>
                    </div>

                    {variance.root_cause && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Root Cause:</span>{' '}
                        {variance.root_cause}
                      </div>
                    )}

                    {variance.corrective_action && (
                      <div className="text-sm">
                        <span className="text-muted-foreground font-medium">Action Taken:</span>{' '}
                        {variance.corrective_action}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {getSeverityBadge(variance.severity)}
                    {getStatusBadge(variance.status)}
                    {variance.status !== 'resolved' && (
                      <Button size="sm" variant="outline" onClick={() => handleInvestigate(variance)}>
                        Investigate
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Investigation Dialog */}
      <Dialog open={isInvestigateDialogOpen} onOpenChange={setIsInvestigateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Variance Investigation</DialogTitle>
          </DialogHeader>
          
          {selectedVariance && (
            <form onSubmit={handleSaveInvestigation} className="space-y-4">
              <Card className="bg-amber-50 dark:bg-amber-950">
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Product:</span>
                      <span>{selectedVariance.products?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Variance:</span>
                      <span className={selectedVariance.variance > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        {selectedVariance.variance > 0 ? '+' : ''}{selectedVariance.variance} units
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Value Impact:</span>
                      <span className="font-semibold">{Math.abs(selectedVariance.variance_value).toLocaleString()} PKR</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <Label htmlFor="root_cause">Root Cause *</Label>
                <Textarea
                  id="root_cause"
                  value={investigationData.root_cause}
                  onChange={(e) => setInvestigationData({ ...investigationData, root_cause: e.target.value })}
                  placeholder="What caused this variance? (e.g., theft, damage, system error, clerical)"
                  required
                />
              </div>

              <div>
                <Label htmlFor="corrective_action">Corrective Action *</Label>
                <Textarea
                  id="corrective_action"
                  value={investigationData.corrective_action}
                  onChange={(e) => setInvestigationData({ ...investigationData, corrective_action: e.target.value })}
                  placeholder="What action was taken or will be taken to prevent this in the future?"
                  required
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={investigationData.status} onValueChange={(value) => setInvestigationData({ ...investigationData, status: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="write_off">Write Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsInvestigateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Investigation'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VarianceManagement;
