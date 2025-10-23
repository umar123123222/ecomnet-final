import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Upload, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { parseFile } from '@/utils/csvParser';
import { generateOrderTemplate, exportErrorsToCSV } from '@/utils/orderTemplate';
import { processOrdersForImport, bulkCreateOrders, type ValidatedOrder } from '@/utils/orderBulkImport';

interface BulkUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'validate' | 'import' | 'complete';

export function BulkUploadDialog({ open, onOpenChange, onSuccess }: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [validOrders, setValidOrders] = useState<ValidatedOrder[]>([]);
  const [invalidOrders, setInvalidOrders] = useState<ValidatedOrder[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const { toast } = useToast();

  const resetDialog = () => {
    setStep('upload');
    setFile(null);
    setValidOrders([]);
    setInvalidOrders([]);
    setProgress(0);
    setImportResult(null);
  };

  const handleFileSelect = (selectedFile: File) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    if (selectedFile.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please upload a file smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
  };

  const handleFileUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);

    try {
      // Parse file
      const parseResult = await parseFile(file);
      setProgress(30);

      if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
        toast({
          title: 'File parsing failed',
          description: parseResult.errors[0].message,
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      // Validate orders
      const importResult = await processOrdersForImport(parseResult.data);
      setProgress(70);

      setValidOrders(importResult.validOrders);
      setInvalidOrders(importResult.invalidOrders);
      setProgress(100);
      setStep('validate');

      toast({
        title: 'File processed',
        description: `Found ${importResult.validOrders.length} valid orders and ${importResult.invalidOrders.length} invalid orders`,
      });
    } catch (error) {
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    setIsProcessing(true);
    setProgress(0);
    setStep('import');

    try {
      const result = await bulkCreateOrders(validOrders);
      setProgress(100);
      setImportResult(result);
      setStep('complete');

      if (result.success > 0) {
        toast({
          title: 'Import completed',
          description: `Successfully imported ${result.success} orders${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
        });
        onSuccess?.();
      } else {
        toast({
          title: 'Import failed',
          description: 'No orders were imported. Please check the error details.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      setStep('validate');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadErrors = () => {
    const errors = invalidOrders.map(order => ({
      row: order.rowNumber,
      field: 'Multiple',
      message: order.errors.join('; '),
      data: order.data,
    }));
    exportErrorsToCSV(errors);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Orders</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file to import multiple orders at once
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload File */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={generateOrderTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('file-upload')?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) handleFileSelect(droppedFile);
              }}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">
                {file ? file.name : 'Click to upload or drag and drop'}
              </p>
              <p className="text-sm text-muted-foreground">
                CSV or Excel files (max 5MB)
              </p>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) handleFileSelect(selectedFile);
                }}
              />
            </div>

            {file && (
              <Alert>
                <FileSpreadsheet className="h-4 w-4" />
                <AlertTitle>File selected</AlertTitle>
                <AlertDescription>
                  {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleFileUpload} disabled={!file || isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Process File'
                )}
              </Button>
            </div>

            {isProcessing && <Progress value={progress} />}
          </div>
        )}

        {/* Step 2: Validate & Preview */}
        {step === 'validate' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{validOrders.length + invalidOrders.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-green-600">Valid Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{validOrders.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-600">Invalid Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{invalidOrders.length}</div>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="valid">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="valid">
                  Valid Orders ({validOrders.length})
                </TabsTrigger>
                <TabsTrigger value="errors">
                  Errors ({invalidOrders.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="valid" className="mt-4">
                <div className="border rounded-lg max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Items</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validOrders.map((order) => (
                        <TableRow key={order.rowNumber}>
                          <TableCell>{order.rowNumber}</TableCell>
                          <TableCell>{order.data.customer_name}</TableCell>
                          <TableCell>{order.data.customer_phone}</TableCell>
                          <TableCell>{order.data.city}</TableCell>
                          <TableCell>Rs. {order.data.total_amount}</TableCell>
                          <TableCell>{order.data.items?.length || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="errors" className="mt-4">
                {invalidOrders.length > 0 && (
                  <div className="mb-4">
                    <Button variant="outline" size="sm" onClick={handleDownloadErrors}>
                      <Download className="mr-2 h-4 w-4" />
                      Download Error Report
                    </Button>
                  </div>
                )}
                <div className="border rounded-lg max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidOrders.map((order) => (
                        <TableRow key={order.rowNumber}>
                          <TableCell>{order.rowNumber}</TableCell>
                          <TableCell>{order.data.customer_name || 'N/A'}</TableCell>
                          <TableCell>
                            <ul className="text-sm text-destructive list-disc list-inside">
                              {order.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetDialog}>
                Start Over
              </Button>
              <Button onClick={handleImport} disabled={validOrders.length === 0 || isProcessing}>
                Import {validOrders.length} Valid Orders
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Import Progress */}
        {step === 'import' && (
          <div className="space-y-4 py-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Importing Orders...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we create {validOrders.length} orders
              </p>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="text-center py-6">
              {importResult.success > 0 ? (
                <>
                  <CheckCircle2 className="mx-auto h-16 w-16 text-green-600 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Import Completed!</h3>
                  <p className="text-muted-foreground">
                    Successfully imported {importResult.success} orders
                    {importResult.failed > 0 && ` (${importResult.failed} failed)`}
                  </p>
                </>
              ) : (
                <>
                  <XCircle className="mx-auto h-16 w-16 text-red-600 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Import Failed</h3>
                  <p className="text-muted-foreground">
                    No orders were imported. Please check the errors and try again.
                  </p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetDialog}>
                Import Another File
              </Button>
              <Button onClick={() => {
                onOpenChange(false);
                resetDialog();
              }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
