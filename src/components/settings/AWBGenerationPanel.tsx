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
export function AWBGenerationPanel({
  couriers
}: AWBGenerationPanelProps) {
  const {
    toast
  } = useToast();
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
    const orderIdArray = orderIds.split(/[,\n]/).map(id => id.trim()).filter(Boolean);
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
      const {
        data: orders,
        error: ordersError
      } = await supabase.from('orders').select('id, order_number').in('order_number', orderIdArray);
      if (ordersError) throw ordersError;
      if (!orders || orders.length === 0) {
        throw new Error('No matching orders found');
      }
      const orderUUIDs = orders.map(o => o.id);
      setProgress(10);

      // Call edge function to generate AWBs
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-courier-awbs', {
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
    const filename = index !== undefined ? `awb-${selectedCourier}-batch-${index + 1}.pdf` : `awb-${selectedCourier}.pdf`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    link.click();
  };
  return;
}