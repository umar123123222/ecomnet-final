/**
 * Phase 5: Fraud Reporting & Automated Actions Dashboard
 * Comprehensive fraud analytics and automated response system
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { 
  Shield, AlertTriangle, TrendingUp, Lock, Eye, 
  BarChart3, FileText, Download, RefreshCw, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  batchAnalyzeOrders, 
  getFraudStatistics, 
  OrderFraudAnalysis 
} from '@/utils/orderFraudDetection';

const FraudReportDashboard = () => {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [fraudAnalyses, setFraudAnalyses] = useState<OrderFraudAnalysis[]>([]);
  const [autoActionsEnabled, setAutoActionsEnabled] = useState(false);
  const [processingActions, setProcessingActions] = useState(false);

  // Fetch orders and analyze
  useEffect(() => {
    fetchAndAnalyze();
  }, []);

  const fetchAndAnalyze = async () => {
    setLoading(true);
    try {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      const orders = ordersData || [];
      setOrders(orders);

      // Analyze all orders for fraud
      const analyses = batchAnalyzeOrders(orders, orders);
      setFraudAnalyses(analyses);

      toast({
        title: "Analysis Complete",
        description: `Analyzed ${orders.length} orders for fraud patterns`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => getFraudStatistics(fraudAnalyses), [fraudAnalyses]);

  // High-risk orders requiring immediate action
  const criticalOrders = useMemo(() => 
    fraudAnalyses
      .filter(a => a.fraudIndicators.riskLevel === 'critical')
      .sort((a, b) => b.fraudIndicators.riskScore - a.fraudIndicators.riskScore)
      .slice(0, 10),
    [fraudAnalyses]
  );

  // Execute automated fraud actions
  const executeAutomatedActions = async () => {
    setProcessingActions(true);
    try {
      const ordersToBlock = fraudAnalyses.filter(a => a.fraudIndicators.shouldBlock);
      const ordersToFlag = fraudAnalyses.filter(a => a.fraudIndicators.shouldFlag && !a.fraudIndicators.shouldBlock);

      // Block high-risk orders
      for (const analysis of ordersToBlock) {
        await supabase
          .from('orders')
          .update({ 
            status: 'cancelled',
            notes: `AUTO-BLOCKED: Fraud risk score ${analysis.fraudIndicators.riskScore}%. ${analysis.fraudIndicators.flags.join(', ')}`
          })
          .eq('id', analysis.order.id);
      }

      // Flag medium-risk orders
      for (const analysis of ordersToFlag) {
        await supabase
          .from('orders')
          .update({ 
            verification_status: 'disapproved',
            verification_notes: `AUTO-FLAGGED: Fraud risk ${analysis.fraudIndicators.riskScore}%. Requires review. ${analysis.fraudIndicators.flags.join(', ')}`
          })
          .eq('id', analysis.order.id);
      }

      toast({
        title: "Automated Actions Complete",
        description: `Blocked ${ordersToBlock.length} orders, flagged ${ordersToFlag.length} for review`
      });

      await fetchAndAnalyze();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setProcessingActions(false);
    }
  };

  // Export fraud report
  const exportReport = () => {
    const reportData = fraudAnalyses.map(a => ({
      order_number: a.order.order_number,
      customer_name: a.order.customer_name,
      customer_phone: a.order.customer_phone,
      total_amount: a.order.total_amount,
      risk_score: a.fraudIndicators.riskScore,
      risk_level: a.fraudIndicators.riskLevel,
      flags: a.fraudIndicators.flags.join('; '),
      patterns: a.fraudIndicators.patterns.join('; '),
      auto_actions: a.fraudIndicators.autoActions.join('; '),
      created_at: a.order.created_at
    }));

    const csv = [
      Object.keys(reportData[0]).join(','),
      ...reportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fraud-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();

    toast({
      title: "Report Exported",
      description: "Fraud analysis report downloaded successfully"
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-4 text-lg">Analyzing orders for fraud patterns...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            Fraud Prevention Command Center
          </h1>
          <p className="text-muted-foreground">Phase 5: Automated Actions & Intelligence Reporting</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchAndAnalyze} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh Analysis
          </Button>
          <Button onClick={exportReport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalOrders.length > 0 && (
        <Alert variant="destructive" className="border-red-600 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="text-lg font-semibold">
            🚨 {criticalOrders.length} Critical Fraud Alerts - Immediate Action Required
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-2">High-risk fraudulent orders detected with risk scores above 80%</p>
            <Button 
              onClick={executeAutomatedActions} 
              disabled={processingActions}
              variant="destructive"
              size="sm"
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              {processingActions ? 'Processing...' : 'Execute Automated Actions'}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Critical Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.critical}</div>
            <p className="text-xs text-muted-foreground mt-1">Auto-block recommended</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.high}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Medium Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.medium}</div>
            <p className="text-xs text-muted-foreground mt-1">Monitor closely</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgRiskScore}%</div>
            <Progress value={stats.avgRiskScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Low Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.low}</div>
            <p className="text-xs text-muted-foreground mt-1">Safe to proceed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="critical" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="critical">Critical Orders ({criticalOrders.length})</TabsTrigger>
          <TabsTrigger value="patterns">Fraud Patterns</TabsTrigger>
          <TabsTrigger value="actions">Automated Actions</TabsTrigger>
        </TabsList>

        {/* Critical Orders Tab */}
        <TabsContent value="critical" className="space-y-4">
          {criticalOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                <p className="text-lg font-semibold">No Critical Fraud Alerts</p>
                <p className="text-muted-foreground">All orders are within acceptable risk thresholds</p>
              </CardContent>
            </Card>
          ) : (
            criticalOrders.map((analysis) => {
              const order = analysis.order;
              const fraud = analysis.fraudIndicators;
              
              return (
                <Card key={order.id} className="border-2 border-red-500">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <Shield className="h-6 w-6 text-red-600" />
                            <div>
                              <h3 className="text-lg font-semibold">Order #{order.order_number}</h3>
                              <p className="text-sm text-muted-foreground">
                                {order.customer_name} • {order.customer_phone}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive" className="text-lg px-4 py-2">
                          RISK: {fraud.riskScore}%
                        </Badge>
                      </div>

                      {/* Risk meter */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Fraud Risk Level</span>
                          <span className="text-sm font-bold text-red-600">{fraud.riskLevel.toUpperCase()}</span>
                        </div>
                        <Progress value={fraud.riskScore} className="h-3" />
                      </div>

                      {/* Patterns detected */}
                      {fraud.patterns.length > 0 && (
                        <Alert variant="destructive" className="bg-red-50 dark:bg-red-950">
                          <Eye className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Fraud Patterns Detected:</strong>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                              {fraud.patterns.map((pattern, idx) => (
                                <li key={idx} className="text-sm">{pattern}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Fraud flags */}
                      <div>
                        <span className="text-sm font-medium mb-2 block">Fraud Indicators:</span>
                        <div className="flex flex-wrap gap-2">
                          {fraud.flags.map((flag, idx) => (
                            <Badge key={idx} variant="outline" className="border-red-300 text-red-700">
                              {flag}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Automated actions */}
                      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                        <span className="text-sm font-medium mb-2 block">Recommended Actions:</span>
                        <ul className="space-y-1">
                          {fraud.autoActions.map((action, idx) => (
                            <li key={idx} className="text-sm flex items-center gap-2">
                              <Lock className="h-3 w-3" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Order details */}
                      <div className="grid grid-cols-3 gap-4 text-sm border-t pt-4">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>{' '}
                          <span className="font-semibold">{formatCurrency(order.total_amount || 0)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">City:</span>{' '}
                          <span>{order.city}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Created:</span>{' '}
                          <span>{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Fraud Patterns Tab */}
        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Fraud Patterns Detected
              </CardTitle>
              <CardDescription>Most common fraudulent patterns across all orders</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topPatterns.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No fraud patterns detected</p>
              ) : (
                <div className="space-y-4">
                  {stats.topPatterns.map((pattern, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{pattern.pattern}</span>
                        <Badge variant="outline">{pattern.count} occurrences</Badge>
                      </div>
                      <Progress value={(pattern.count / stats.total) * 100} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automated Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Automated Fraud Prevention Actions
              </CardTitle>
              <CardDescription>Configure and execute automated responses to fraud</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Orders to Block</h4>
                  <p className="text-3xl font-bold text-red-600">{stats.blocked}</p>
                  <p className="text-sm text-muted-foreground mt-1">Risk score ≥ 80%</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Orders to Flag</h4>
                  <p className="text-3xl font-bold text-orange-600">{stats.flagged}</p>
                  <p className="text-sm text-muted-foreground mt-1">Risk score 60-79%</p>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Automated Action Policy</AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>Critical (80-100%):</strong> Auto-block order, prevent dispatch</li>
                    <li><strong>High (60-79%):</strong> Flag for manual review, require verification</li>
                    <li><strong>Medium (40-59%):</strong> Monitor closely, no automatic action</li>
                    <li><strong>Low (0-39%):</strong> Normal processing</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <Button 
                onClick={executeAutomatedActions}
                disabled={processingActions || (stats.blocked === 0 && stats.flagged === 0)}
                className="w-full gap-2"
                size="lg"
              >
                <Lock className="h-5 w-5" />
                {processingActions ? 'Processing Actions...' : `Execute Actions (Block ${stats.blocked}, Flag ${stats.flagged})`}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FraudReportDashboard;
