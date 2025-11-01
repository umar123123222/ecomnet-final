import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, CheckCircle, XCircle, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";

interface BulkStockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CSVRow {
  sku: string;
  outlet: string;
  adjustment_type: "increase" | "decrease";
  quantity: number;
  reason: string;
}

interface ProcessingResult {
  sku: string;
  outlet: string;
  status: "success" | "error";
  message: string;
}

export function BulkStockAdjustmentDialog({
  open,
  onOpenChange,
}: BulkStockAdjustmentDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [csvData, setCsvData] = useState<CSVRow[]>([]);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const downloadTemplate = () => {
    const template = [
      ["sku", "outlet", "adjustment_type", "quantity", "reason"],
      ["PROD-001", "Main Warehouse", "increase", "100", "Stock received from supplier"],
      ["PROD-002", "Retail Store", "decrease", "5", "Damaged items removed"],
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-stock-adjustment-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Fill in the template and upload it to perform bulk adjustments",
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as CSVRow[];
        
        // Validate data
        const validRows = data.filter((row) => {
          return (
            row.sku &&
            row.outlet &&
            row.adjustment_type &&
            row.quantity &&
            row.reason &&
            (row.adjustment_type === "increase" || row.adjustment_type === "decrease")
          );
        });

        if (validRows.length === 0) {
          toast({
            title: "Invalid CSV",
            description: "No valid rows found in the CSV file",
            variant: "destructive",
          });
          return;
        }

        setCsvData(validRows);
        toast({
          title: "CSV Loaded",
          description: `${validRows.length} valid rows found`,
        });
      },
      error: (error) => {
        toast({
          title: "Error Parsing CSV",
          description: error.message,
          variant: "destructive",
        });
      },
    });

    // Reset input
    event.target.value = "";
  };

  const processBulkAdjustments = async () => {
    if (csvData.length === 0) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setProgress(0);

    const processResults: ProcessingResult[] = [];

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        // Get product by SKU
        const { data: product, error: productError } = await supabase
          .from("products")
          .select("id")
          .eq("sku", row.sku)
          .single();

        if (productError || !product) {
          processResults.push({
            sku: row.sku,
            outlet: row.outlet,
            status: "error",
            message: "Product not found",
          });
          continue;
        }

        // Get outlet by name
        const { data: outlet, error: outletError } = await supabase
          .from("outlets")
          .select("id")
          .eq("name", row.outlet)
          .single();

        if (outletError || !outlet) {
          processResults.push({
            sku: row.sku,
            outlet: row.outlet,
            status: "error",
            message: "Outlet not found",
          });
          continue;
        }

        // Perform adjustment
        const quantity = row.adjustment_type === "increase" ? row.quantity : -row.quantity;
        
        const { error: adjustError } = await supabase.functions.invoke("manage-stock", {
          body: {
            operation: "adjustStock",
            data: {
              productId: product.id,
              outletId: outlet.id,
              quantity: quantity,
              reason: row.reason,
            },
          },
        });

        if (adjustError) {
          processResults.push({
            sku: row.sku,
            outlet: row.outlet,
            status: "error",
            message: adjustError.message || "Adjustment failed",
          });
        } else {
          processResults.push({
            sku: row.sku,
            outlet: row.outlet,
            status: "success",
            message: `${row.adjustment_type === "increase" ? "+" : "-"}${row.quantity} units`,
          });
        }
      } catch (error: any) {
        processResults.push({
          sku: row.sku,
          outlet: row.outlet,
          status: "error",
          message: error.message || "Unknown error",
        });
      }

      // Update progress
      setProgress(((i + 1) / csvData.length) * 100);
      setResults([...processResults]);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["inventory"] });

    const successCount = processResults.filter((r) => r.status === "success").length;
    const errorCount = processResults.filter((r) => r.status === "error").length;

    toast({
      title: "Bulk Adjustment Complete",
      description: `${successCount} successful, ${errorCount} failed`,
    });
  };

  const handleClose = () => {
    setCsvData([]);
    setResults([]);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Stock Adjustment</DialogTitle>
          <DialogDescription>
            Upload a CSV file to adjust stock for multiple products at once
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Download */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription className="ml-2">
              <div className="flex items-center justify-between">
                <span>Download the CSV template to get started</span>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-3 w-3 mr-2" />
                  Download Template
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
              disabled={isProcessing}
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload CSV file</p>
              <p className="text-xs text-muted-foreground">or drag and drop</p>
            </label>
          </div>

          {/* Data Preview */}
          {csvData.length > 0 && !isProcessing && results.length === 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription className="ml-2">
                <p className="font-medium mb-2">CSV loaded successfully</p>
                <p className="text-sm">
                  {csvData.length} rows ready to process
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Processing adjustments...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Results</h4>
                <div className="flex gap-2">
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {results.filter((r) => r.status === "success").length}
                  </Badge>
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    {results.filter((r) => r.status === "error").length}
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      result.status === "success" ? "bg-success/10" : "bg-destructive/10"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.status === "success" ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">{result.sku}</span>
                      <span className="text-muted-foreground">at {result.outlet}</span>
                    </div>
                    <span className={result.status === "success" ? "text-success" : "text-destructive"}>
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            {results.length > 0 ? "Close" : "Cancel"}
          </Button>
          {csvData.length > 0 && results.length === 0 && (
            <Button onClick={processBulkAdjustments} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process {csvData.length} Adjustments
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
