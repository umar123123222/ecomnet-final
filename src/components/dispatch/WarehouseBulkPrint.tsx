import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, Download, AlertCircle, CheckCircle2, RefreshCw, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WarehouseBulkPrintProps {
  selectedOrderIds: string[];
  courierCode: string;
  onClose?: () => void;
}

interface PrintResult {
  order_id: string;
  tracking_id: string;
  success: boolean;
  error?: string;
}

type PrintStatus = 'idle' | 'fetching' | 'consolidating' | 'complete' | 'error';

const WarehouseBulkPrint: React.FC<WarehouseBulkPrintProps> = ({
  selectedOrderIds,
  courierCode,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<PrintStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [labelsPerPage, setLabelsPerPage] = useState<'2' | '3'>('3');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [results, setResults] = useState<PrintResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const failedResults = results.filter(r => !r.success);
  const successResults = results.filter(r => r.success);

  const handlePrint = async () => {
    if (selectedOrderIds.length === 0) {
      toast({
        title: "No orders selected",
        description: "Please select orders to print labels for",
        variant: "destructive"
      });
      return;
    }

    setIsOpen(true);
    setStatus('fetching');
    setProgress(10);
    setResults([]);
    setDownloadUrl(null);
    setPdfData(null);
    setErrorMessage(null);

    try {
      setProgress(30);
      setStatus('fetching');

      const { data, error } = await supabase.functions.invoke('bulk-print-labels', {
        body: {
          order_ids: selectedOrderIds,
          courier_code: courierCode,
          labels_per_page: parseInt(labelsPerPage)
        }
      });

      if (error) {
        throw error;
      }

      setProgress(80);
      setStatus('consolidating');

      if (!data.success) {
        throw new Error(data.error || 'Unknown error occurred');
      }

      setResults(data.results || []);
      setDownloadUrl(data.download_url || null);
      setPdfData(data.pdf_data || null);
      setProgress(100);
      setStatus('complete');

      toast({
        title: "Labels Generated",
        description: `${data.total_labels} labels consolidated into ${data.total_pages} pages`,
      });

    } catch (err: any) {
      console.error('Bulk print error:', err);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to generate labels');
      toast({
        title: "Print Failed",
        description: err.message || 'Failed to generate labels',
        variant: "destructive"
      });
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else if (pdfData) {
      // Fallback: download base64 PDF
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${pdfData}`;
      link.download = `labels-${courierCode}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRetryFailed = async () => {
    const failedOrderIds = failedResults.map(r => r.order_id);
    if (failedOrderIds.length === 0) return;

    // Reset and retry just the failed ones
    setStatus('fetching');
    setProgress(10);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-print-labels', {
        body: {
          order_ids: failedOrderIds,
          courier_code: courierCode,
          labels_per_page: parseInt(labelsPerPage)
        }
      });

      if (error) throw error;

      // Merge results
      const newResults = [...successResults, ...(data.results || [])];
      setResults(newResults);
      setDownloadUrl(data.download_url || downloadUrl);
      setPdfData(data.pdf_data || pdfData);
      setProgress(100);
      setStatus('complete');

    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStatus('idle');
    setProgress(0);
    setResults([]);
    setDownloadUrl(null);
    setPdfData(null);
    setErrorMessage(null);
    onClose?.();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={labelsPerPage} onValueChange={(v) => setLabelsPerPage(v as '2' | '3')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Labels/page" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2 per page</SelectItem>
            <SelectItem value="3">3 per page</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={handlePrint}
          disabled={selectedOrderIds.length === 0}
          className="gap-2"
        >
          <Printer className="h-4 w-4" />
          Print {selectedOrderIds.length} Labels
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bulk Label Generation
            </DialogTitle>
            <DialogDescription>
              {courierCode.toUpperCase()} • {labelsPerPage} labels per A4 page
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Progress */}
            {status !== 'idle' && status !== 'complete' && status !== 'error' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {status === 'fetching' && 'Fetching labels from courier...'}
                    {status === 'consolidating' && 'Consolidating PDF...'}
                  </span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Success State */}
            {status === 'complete' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Labels Generated Successfully</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{successResults.length}</div>
                    <div className="text-muted-foreground">Successful</div>
                  </div>
                  {failedResults.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{failedResults.length}</div>
                      <div className="text-muted-foreground">Failed</div>
                    </div>
                  )}
                </div>

                {/* Failed Labels List */}
                {failedResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-red-600">Failed Labels</span>
                      <Button variant="outline" size="sm" onClick={handleRetryFailed} className="gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Retry Failed
                      </Button>
                    </div>
                    <ScrollArea className="h-24 rounded border">
                      <div className="p-2 space-y-1">
                        {failedResults.map((r, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="font-mono">{r.tracking_id || r.order_id.slice(0, 8)}</span>
                            <Badge variant="destructive" className="text-xs">{r.error}</Badge>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-950 rounded-lg p-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{errorMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {status === 'complete' && (downloadUrl || pdfData) && (
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            )}
            <Button variant="outline" onClick={handleClose}>
              {status === 'complete' ? 'Close' : 'Cancel'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WarehouseBulkPrint;
