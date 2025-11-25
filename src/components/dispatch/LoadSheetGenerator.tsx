import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileText, Download, Calendar } from "lucide-react";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { DateRange } from "react-day-picker";

export function LoadSheetGenerator() {
  const [courierCode, setCourierCode] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(false);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loadSheets, setLoadSheets] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchCouriers();
    fetchLoadSheets();
  }, []);

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('*')
      .eq('is_active', true)
      .not('load_sheet_endpoint', 'is', null)
      .order('name');
    
    if (data) setCouriers(data);
  };

  const fetchLoadSheets = async () => {
    const { data } = await supabase
      .from('courier_load_sheets')
      .select(`
        *,
        couriers (name, code),
        profiles (full_name)
      `)
      .order('generated_at', { ascending: false })
      .limit(10);
    
    if (data) setLoadSheets(data);
  };

  const handleGenerate = async () => {
    if (!courierCode) {
      toast({ title: "Error", description: "Please select a courier", variant: "destructive" });
      return;
    }

    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Error", description: "Please select date range", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-load-sheet', {
        body: {
          courierCode,
          dateFrom: dateRange.from.toISOString(),
          dateTo: dateRange.to.toISOString()
        }
      });

      if (error) throw error;

      toast({
        title: "Load Sheet Generated",
        description: `Successfully generated load sheet for ${data.trackingCount} shipments`
      });

      // Download if URL available
      if (data.loadSheetUrl) {
        window.open(data.loadSheetUrl, '_blank');
      } else if (data.loadSheetData) {
        // Download base64 PDF
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.loadSheetData}`;
        link.download = `load-sheet-${courierCode}-${new Date().toISOString()}.pdf`;
        link.click();
      }

      fetchLoadSheets();

    } catch (error: any) {
      console.error('Load sheet generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (sheet: any) => {
    if (sheet.load_sheet_url) {
      window.open(sheet.load_sheet_url, '_blank');
    } else if (sheet.load_sheet_data) {
      const link = document.createElement('a');
      link.href = `data:application/pdf;base64,${sheet.load_sheet_data}`;
      link.download = `load-sheet-${sheet.couriers.code}-${sheet.generated_at}.pdf`;
      link.click();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Load Sheet Generator
        </CardTitle>
        <CardDescription>
          Generate courier manifests/load sheets for shipments in a date range
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select value={courierCode} onValueChange={setCourierCode}>
            <SelectTrigger>
              <SelectValue placeholder="Select Courier" />
            </SelectTrigger>
            <SelectContent>
              {couriers.map(courier => (
                <SelectItem key={courier.id} value={courier.code}>
                  {courier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </label>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Load Sheet
        </Button>

        {loadSheets.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-semibold">Recent Load Sheets</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {loadSheets.map((sheet) => (
                <div
                  key={sheet.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{sheet.couriers.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(sheet.generated_at).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {sheet.tracking_ids.length} shipments
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(sheet)}
                    disabled={!sheet.load_sheet_url && !sheet.load_sheet_data}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
