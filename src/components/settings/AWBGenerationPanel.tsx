import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Upload, Download, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AWBGenerationPanelProps {
  couriers: any[];
}

export function AWBGenerationPanel({ couriers }: AWBGenerationPanelProps) {
  const { toast } = useToast();
  const [selectedCourier, setSelectedCourier] = useState('');
  const [orderIds, setOrderIds] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = async () => {
    if (!selectedCourier) {
      toast({
        title: "Error",
        description: "Please select a courier",
        variant: "destructive"
      });
      return;
    }

    if (!orderIds.trim()) {
      toast({
        title: "Error",
        description: "Please enter order IDs",
        variant: "destructive"
      });
      return;
    }

    const orderIdArray = orderIds
      .split(/[,\n]/)
      .map(id => id.trim())
      .filter(Boolean);

    if (orderIdArray.length === 0) {
      toast({
        title: "Error",
        description: "No valid order IDs found",
        variant: "destructive"
      });
      return;
    }

    if (orderIdArray.length > 1000) {
      toast({
        title: "Error",
        description: "Maximum 1000 orders allowed per batch",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResult(null);

    try {
      // Get order UUIDs from order numbers
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number')
        .in('order_number', orderIdArray);

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        throw new Error('No matching orders found');
      }

      const orderUUIDs = orders.map(o => o.id);

      setProgress(10);

      // Call edge function to generate AWBs
      const { data, error } = await supabase.functions.invoke('generate-courier-awbs', {
        body: {
          courier_code: selectedCourier,
          order_ids: orderUUIDs
        }
      });

      if (error) throw error;

      setProgress(100);
      setResult(data);

      toast({
        title: "Success",
        description: data.message || "AWBs generated successfully"
      });

    } catch (error: any) {
      console.error('Error generating AWBs:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate AWBs",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string, index?: number) => {
    const filename = index !== undefined 
      ? `awb-${selectedCourier}-batch-${index + 1}.pdf`
      : `awb-${selectedCourier}.pdf`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Generate Bulk Airway Bills
        </CardTitle>
        <CardDescription>
          Generate AWBs in batches for up to 1000 orders at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Orders will be processed in batches of 10 (courier limit). Enter order numbers separated by commas or new lines.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="courier-select">Select Courier</Label>
          <Select value={selectedCourier} onValueChange={setSelectedCourier}>
            <SelectTrigger id="courier-select">
              <SelectValue placeholder="Choose a courier" />
            </SelectTrigger>
            <SelectContent>
              {couriers.map((courier) => (
                <SelectItem key={courier.id} value={courier.code}>
                  {courier.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="order-ids">Order Numbers</Label>
          <textarea
            id="order-ids"
            className="w-full min-h-[120px] p-2 border rounded-md"
            placeholder="Enter order numbers (comma or newline separated)&#10;Example:&#10;ORD-001, ORD-002&#10;ORD-003"
            value={orderIds}
            onChange={(e) => setOrderIds(e.target.value)}
            disabled={isGenerating}
          />
          <p className="text-sm text-muted-foreground">
            {orderIds.split(/[,\n]/).filter(id => id.trim()).length} orders entered (max 1000)
          </p>
        </div>

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Generating AWBs...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {result && (
          <Alert className="border-green-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{result.message}</p>
                <ul className="text-sm space-y-1">
                  <li>Processed: {result.processed_count} orders</li>
                  <li>Batches: {result.total_batches}</li>
                  <li>Tracking IDs: {result.tracking_ids?.length || 0}</li>
                </ul>
                {result.pdf_urls && result.pdf_urls.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {result.pdf_urls.map((url: string, index: number) => (
                      <Button
                        key={index}
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(url, result.pdf_urls.length > 1 ? index : undefined)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download {result.pdf_urls.length > 1 ? `Batch ${index + 1}` : 'AWB'}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !selectedCourier || !orderIds.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Generate AWBs
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}