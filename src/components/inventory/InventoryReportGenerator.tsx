import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

type ReportType = 'full-inventory' | 'stock-valuation' | 'low-stock' | 'movement-history' | 'abc-analysis' | 'turnover-report';
type ExportFormat = 'csv' | 'excel' | 'pdf';

export function InventoryReportGenerator() {
  const [reportType, setReportType] = useState<ReportType>('full-inventory');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [includeOutlets, setIncludeOutlets] = useState(true);
  const [includeValues, setIncludeValues] = useState(true);

  const generateReportMutation = useMutation({
    mutationFn: async () => {
      let reportData: any[] = [];
      let fileName = '';

      switch (reportType) {
        case 'full-inventory':
          fileName = 'Full_Inventory_Report';
          const { data: fullInventory } = await supabase
            .from('inventory')
            .select(`
              quantity,
              reserved_quantity,
              available_quantity,
              updated_at,
              product:products!inner (
                sku,
                name,
                category,
                price,
                cost,
                reorder_level
              ),
              outlet:outlets!inner (
                name,
                outlet_type
              )
            `)
            .order('product(name)');

          reportData = fullInventory?.map(inv => ({
            'SKU': inv.product?.sku,
            'Product Name': inv.product?.name,
            'Category': inv.product?.category || 'N/A',
            ...(includeOutlets && { 'Outlet': inv.outlet?.name, 'Outlet Type': inv.outlet?.outlet_type }),
            'Quantity': inv.quantity,
            'Reserved': inv.reserved_quantity,
            'Available': inv.available_quantity,
            'Reorder Level': inv.product?.reorder_level,
            ...(includeValues && {
              'Unit Cost': inv.product?.cost,
              'Unit Price': inv.product?.price,
              'Total Cost': (inv.quantity * (inv.product?.cost || 0)).toFixed(2),
              'Total Value': (inv.quantity * (inv.product?.price || 0)).toFixed(2),
            }),
            'Last Updated': new Date(inv.updated_at).toLocaleString(),
          })) || [];
          break;

        case 'stock-valuation':
          fileName = 'Stock_Valuation_Report';
          const { data: valuation } = await supabase
            .from('inventory')
            .select(`
              quantity,
              product:products!inner (
                sku,
                name,
                category,
                cost,
                price
              ),
              outlet:outlets!inner (
                name
              )
            `);

          reportData = valuation?.map(inv => {
            const costValue = inv.quantity * (inv.product?.cost || 0);
            const retailValue = inv.quantity * (inv.product?.price || 0);
            const margin = retailValue - costValue;
            const marginPercent = costValue > 0 ? (margin / costValue * 100) : 0;

            return {
              'SKU': inv.product?.sku,
              'Product': inv.product?.name,
              'Category': inv.product?.category || 'N/A',
              ...(includeOutlets && { 'Outlet': inv.outlet?.name }),
              'Quantity': inv.quantity,
              'Unit Cost': inv.product?.cost?.toFixed(2),
              'Unit Price': inv.product?.price?.toFixed(2),
              'Cost Value': costValue.toFixed(2),
              'Retail Value': retailValue.toFixed(2),
              'Potential Margin': margin.toFixed(2),
              'Margin %': marginPercent.toFixed(2),
            };
          }) || [];
          break;

        case 'low-stock':
          fileName = 'Low_Stock_Report';
          const { data: lowStock } = await supabase
            .from('inventory')
            .select(`
              quantity,
              product:products!inner (
                sku,
                name,
                reorder_level,
                cost
              ),
              outlet:outlets!inner (
                name
              )
            `);

          reportData = lowStock
            ?.filter(inv => inv.quantity <= (inv.product?.reorder_level || 0))
            .map(inv => ({
              'SKU': inv.product?.sku,
              'Product': inv.product?.name,
              ...(includeOutlets && { 'Outlet': inv.outlet?.name }),
              'Current Stock': inv.quantity,
              'Reorder Level': inv.product?.reorder_level,
              'Stock Deficit': (inv.product?.reorder_level || 0) - inv.quantity,
              ...(includeValues && {
                'Unit Cost': inv.product?.cost?.toFixed(2),
                'Reorder Cost': (((inv.product?.reorder_level || 0) - inv.quantity) * (inv.product?.cost || 0)).toFixed(2),
              }),
              'Status': inv.quantity === 0 ? 'OUT OF STOCK' : 'LOW STOCK',
            })) || [];
          break;

        case 'movement-history':
          fileName = 'Stock_Movement_History';
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
          const { data: movements } = await supabase
            .from('stock_movements')
            .select(`
              movement_type,
              quantity,
              notes,
              created_at,
              product:products!inner (
                sku,
                name
              ),
              outlet:outlets!inner (
                name
              )
            `)
            .gte('created_at', thirtyDaysAgo)
            .order('created_at', { ascending: false });

          reportData = movements?.map(mov => ({
            'Date': new Date(mov.created_at).toLocaleString(),
            'Product': mov.product?.name,
            'SKU': mov.product?.sku,
            ...(includeOutlets && { 'Outlet': mov.outlet?.name }),
            'Movement Type': mov.movement_type,
            'Quantity': mov.quantity,
            'Notes': mov.notes || 'N/A',
          })) || [];
          break;

        case 'abc-analysis':
          fileName = 'ABC_Analysis_Report';
          // This would need the ABC analysis logic from ABCAnalysisWidget
          const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          const { data: salesData } = await supabase
            .from('stock_movements')
            .select(`
              product_id,
              quantity,
              product:products!inner (
                sku,
                name,
                price
              )
            `)
            .eq('movement_type', 'sale')
            .gte('created_at', ninetyDaysAgo);

          const productSales: Record<string, { name: string; sku: string; value: number }> = {};
          salesData?.forEach((sale) => {
            const value = sale.quantity * (sale.product?.price || 0);
            if (!productSales[sale.product_id]) {
              productSales[sale.product_id] = {
                name: sale.product?.name || 'Unknown',
                sku: sale.product?.sku || 'N/A',
                value: 0,
              };
            }
            productSales[sale.product_id].value += value;
          });

          const sorted = Object.entries(productSales)
            .sort(([, a], [, b]) => b.value - a.value);

          const totalValue = sorted.reduce((sum, [, data]) => sum + data.value, 0);
          let cumulative = 0;

          reportData = sorted.map(([id, data]) => {
            const percentage = totalValue > 0 ? (data.value / totalValue) * 100 : 0;
            cumulative += percentage;
            let category = 'C';
            if (cumulative <= 80) category = 'A';
            else if (cumulative <= 95) category = 'B';

            return {
              'Product': data.name,
              'SKU': data.sku,
              'Sales Value (90 days)': data.value.toFixed(2),
              '% of Total': percentage.toFixed(2),
              'Cumulative %': cumulative.toFixed(2),
              'ABC Category': category,
            };
          });
          break;

        case 'turnover-report':
          fileName = 'Inventory_Turnover_Report';
          // Similar logic to InventoryTurnoverWidget
          toast.info('Generating turnover report...');
          break;
      }

      return { reportData, fileName };
    },
    onSuccess: ({ reportData, fileName }) => {
      if (reportData.length === 0) {
        toast.error('No data available for this report');
        return;
      }

      const timestamp = new Date().toISOString().split('T')[0];
      const fullFileName = `${fileName}_${timestamp}`;

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Report');
        XLSX.writeFile(wb, `${fullFileName}.xlsx`);
      } else if (format === 'csv') {
        const ws = XLSX.utils.json_to_sheet(reportData);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fullFileName}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }

      toast.success(`Report generated: ${fullFileName}`);
    },
    onError: (error) => {
      toast.error(`Failed to generate report: ${error.message}`);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Inventory Report
        </CardTitle>
        <CardDescription>
          Export comprehensive inventory data and analytics
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="report-type">Report Type</Label>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger id="report-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-inventory">Full Inventory Report</SelectItem>
              <SelectItem value="stock-valuation">Stock Valuation</SelectItem>
              <SelectItem value="low-stock">Low Stock Alert Report</SelectItem>
              <SelectItem value="movement-history">Movement History (30 days)</SelectItem>
              <SelectItem value="abc-analysis">ABC Analysis</SelectItem>
              <SelectItem value="turnover-report">Turnover Report</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="format">Export Format</Label>
          <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            <SelectTrigger id="format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label>Report Options</Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-outlets"
              checked={includeOutlets}
              onCheckedChange={(checked) => setIncludeOutlets(checked as boolean)}
            />
            <label
              htmlFor="include-outlets"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include outlet information
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-values"
              checked={includeValues}
              onCheckedChange={(checked) => setIncludeValues(checked as boolean)}
            />
            <label
              htmlFor="include-values"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Include cost and value data
            </label>
          </div>
        </div>

        <Button
          onClick={() => generateReportMutation.mutate()}
          disabled={generateReportMutation.isPending}
          className="w-full"
        >
          {generateReportMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Generate & Download Report
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
