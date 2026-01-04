import { useState, useMemo } from 'react';
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
import { Search, AlertTriangle, CheckCircle2, XCircle, TrendingUp, Shield, Eye, Flag } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCurrency } from '@/hooks/useCurrency';

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
  count_item_id: string;
  product_id: string;
  outlet_id: string;
}

interface FraudIndicators {
  riskScore: number;
  isHighRisk: boolean;
  flags: string[];
  pattern: string | null;
}

// Fraud detection utility
const calculateFraudRisk = (variance: Variance, allVariances: Variance[]): FraudIndicators => {
  const flags: string[] = [];
  let riskScore = 0;

  // High value variance (>10,000 PKR)
  if (Math.abs(variance.variance_value) > 10000) {
    flags.push('High Value Loss');
    riskScore += 35;
  }

  // Negative variance (stock loss)
  if (variance.variance < 0) {
    flags.push('Stock Loss');
    riskScore += 20;
  }

  // Critical severity
  if (variance.severity === 'critical') {
    flags.push('Critical Severity');
    riskScore += 25;
  }

  // Check for repeated variances at same outlet
  const sameOutletVariances = allVariances.filter(v => 
    v.outlet_id === variance.outlet_id && 
    v.id !== variance.id &&
    v.status !== 'resolved'
  );
  if (sameOutletVariances.length >= 3) {
    flags.push(`${sameOutletVariances.length} Unresolved at Location`);
    riskScore += 30;
  }

  // Check for repeated variances for same product
  const sameProductVariances = allVariances.filter(v => 
    v.product_id === variance.product_id && 
    v.id !== variance.id &&
    v.status !== 'resolved'
  );
  if (sameProductVariances.length >= 2) {
    flags.push(`${sameProductVariances.length} Unresolved for Product`);
    riskScore += 20;
  }

  // Long unresolved time (>7 days)
  const daysOpen = Math.floor((Date.now() - new Date(variance.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (daysOpen > 7 && variance.status === 'open') {
    flags.push(`Unresolved for ${daysOpen} Days`);
    riskScore += 15;
  }

  // Pattern detection
  let pattern = null;
  if (sameOutletVariances.length >= 3 && Math.abs(variance.variance_value) > 5000) {
    pattern = 'Systematic Losses at Location';
  } else if (sameProductVariances.length >= 3) {
    pattern = 'Repeated Product Shrinkage';
  } else if (variance.variance < -50 && Math.abs(variance.variance_value) > 20000) {
    pattern = 'Large Quantity Theft Suspected';
  }

  return {
    riskScore: Math.min(riskScore, 100),
    isHighRisk: riskScore >= 60,
    flags,
    pattern
  };
};

const VarianceManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { formatCurrency, currencySymbol } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [isInvestigateDialogOpen, setIsInvestigateDialogOpen] = useState(false);
  const [selectedVariance, setSelectedVariance] = useState<Variance | null>(null);
  const [showFraudAlertsOnly, setShowFraudAlertsOnly] = useState(false);

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

  // Calculate fraud indicators for all variances
  const variancesWithFraud = useMemo(() => {
    return variances.map(v => ({
      ...v,
      fraudIndicators: calculateFraudRisk(v, variances)
    }));
  }, [variances]);

  // Filter and sort by fraud risk
  const filteredVariances = useMemo(() => {
    let filtered = variancesWithFraud.filter(v =>
      v.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.products?.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Risk filter
    if (riskFilter === 'high') {
      filtered = filtered.filter(v => v.fraudIndicators.isHighRisk);
    } else if (riskFilter === 'low') {
      filtered = filtered.filter(v => !v.fraudIndicators.isHighRisk);
    }

    // Show fraud alerts only
    if (showFraudAlertsOnly) {
      filtered = filtered.filter(v => v.fraudIndicators.isHighRisk);
    }

    // Sort by risk score (highest first)
    return filtered.sort((a, b) => b.fraudIndicators.riskScore - a.fraudIndicators.riskScore);
  }, [variancesWithFraud, searchTerm, riskFilter, showFraudAlertsOnly]);

  // Fraud alerts (high risk items)
  const fraudAlerts = useMemo(() => 
    variancesWithFraud.filter(v => v.fraudIndicators.isHighRisk && v.status !== 'resolved'),
    [variancesWithFraud]
  );

  const stats = {
    open: variances.filter(v => v.status === 'open').length,
    investigating: variances.filter(v => v.status === 'investigating').length,
    resolved: variances.filter(v => v.status === 'resolved').length,
    totalValue: variances.reduce((sum, v) => sum + Math.abs(v.variance_value), 0),
    highRiskCount: variancesWithFraud.filter(v => v.fraudIndicators.isHighRisk && v.status !== 'resolved').length,
    averageRiskScore: Math.round(variancesWithFraud.reduce((sum, v) => sum + v.fraudIndicators.riskScore, 0) / Math.max(variancesWithFraud.length, 1))
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Fraud Prevention & Variance Management
          </h1>
          <p className="text-muted-foreground">AI-powered fraud detection and variance investigation</p>
        </div>
        <Button
          variant={showFraudAlertsOnly ? "default" : "outline"}
          onClick={() => setShowFraudAlertsOnly(!showFraudAlertsOnly)}
          className="gap-2"
        >
          <Flag className="h-4 w-4" />
          {showFraudAlertsOnly ? 'Show All' : 'Fraud Alerts Only'}
        </Button>
      </div>

      {/* Fraud Alerts Banner */}
      {fraudAlerts.length > 0 && (
        <Alert variant="destructive" className="border-red-600 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">
            {fraudAlerts.length} High-Risk Fraud Alert{fraudAlerts.length !== 1 ? 's' : ''} Detected
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-1">
              <p>Critical variances requiring immediate investigation:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                {fraudAlerts.slice(0, 3).map(v => (
                  <li key={v.id} className="text-sm">
                    <strong>{v.products?.name}</strong> at {v.outlets?.name} 
                    {v.fraudIndicators.pattern && <span className="ml-2 text-red-700">• {v.fraudIndicators.pattern}</span>}
                  </li>
                ))}
                {fraudAlerts.length > 3 && (
                  <li className="text-sm font-semibold">+ {fraudAlerts.length - 3} more alerts</li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Flag className="h-4 w-4 text-red-600" />
              High Risk Fraud
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highRiskCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
          </CardContent>
        </Card>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.averageRiskScore}%</div>
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
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
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
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by fraud risk" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="high">High Risk Only</SelectItem>
                <SelectItem value="low">Low Risk Only</SelectItem>
              </SelectContent>
            </Select>
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
          {filteredVariances.map((variance) => {
            const fraud = variance.fraudIndicators;
            return (
              <Card 
                key={variance.id} 
                className={`hover:shadow-lg transition-shadow ${fraud.isHighRisk ? 'border-red-500 border-2' : ''}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      {/* Header with fraud indicator */}
                      <div className="flex items-center gap-3">
                        {fraud.isHighRisk ? (
                          <Shield className="h-6 w-6 text-red-600" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-lg">{variance.products?.name}</h3>
                            {fraud.isHighRisk && (
                              <Badge variant="destructive" className="gap-1">
                                <Flag className="h-3 w-3" />
                                HIGH RISK FRAUD
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            SKU: {variance.products?.sku} • {variance.outlets?.name}
                          </p>
                        </div>
                      </div>

                      {/* Fraud pattern alert */}
                      {fraud.pattern && (
                        <Alert variant="destructive" className="py-2 bg-red-50 dark:bg-red-950">
                          <Eye className="h-4 w-4" />
                          <AlertDescription className="text-sm font-semibold">
                            🚨 Pattern Detected: {fraud.pattern}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Fraud Risk Score */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Fraud Risk Score:</span>
                        <div className="flex-1 max-w-xs">
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                fraud.riskScore >= 60 ? 'bg-red-600' : 
                                fraud.riskScore >= 40 ? 'bg-amber-500' : 
                                'bg-green-500'
                              }`}
                              style={{ width: `${fraud.riskScore}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${
                          fraud.riskScore >= 60 ? 'text-red-600' : 
                          fraud.riskScore >= 40 ? 'text-amber-600' : 
                          'text-green-600'
                        }`}>
                          {fraud.riskScore}%
                        </span>
                      </div>

                      {/* Fraud Flags */}
                      {fraud.flags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {fraud.flags.map((flag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-red-300 text-red-700">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      
                      {/* Variance details */}
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
                        <Button 
                          size="sm" 
                          variant={fraud.isHighRisk ? "destructive" : "outline"} 
                          onClick={() => handleInvestigate(variance)}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          Investigate
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
