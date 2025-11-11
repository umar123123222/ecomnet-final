import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AWBDownloadButtonProps {
  orderId: string;
  courierCode?: string;
}

export function AWBDownloadButton({ orderId, courierCode }: AWBDownloadButtonProps) {
  const { toast } = useToast();
  const [awbs, setAwbs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAWBs();
  }, [orderId]);

  const loadAWBs = async () => {
    try {
      const { data, error } = await supabase
        .from('courier_awbs')
        .select('*')
        .contains('order_ids', [orderId])
        .eq('status', 'completed')
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setAwbs(data || []);
    } catch (error: any) {
      console.error('Error loading AWBs:', error);
    }
  };

  const handleDownload = async (awb: any) => {
    setLoading(true);
    try {
      if (awb.pdf_url) {
        // Single PDF URL
        const link = document.createElement('a');
        link.href = awb.pdf_url;
        link.download = `awb-${awb.courier_code}-${awb.id}.pdf`;
        link.target = '_blank';
        link.click();
      } else if (awb.pdf_data) {
        // Multiple PDF URLs stored as JSON
        const urls = JSON.parse(awb.pdf_data);
        urls.forEach((url: string, index: number) => {
          setTimeout(() => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `awb-${awb.courier_code}-batch-${index + 1}.pdf`;
            link.target = '_blank';
            link.click();
          }, index * 500); // Delay to avoid browser blocking multiple downloads
        });
      }

      toast({
        title: "Success",
        description: "AWB download started"
      });
    } catch (error: any) {
      console.error('Error downloading AWB:', error);
      toast({
        title: "Error",
        description: "Failed to download AWB",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (awbs.length === 0) {
    return null;
  }

  if (awbs.length === 1) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleDownload(awbs[0])}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-2" />
        )}
        AWB
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          AWBs ({awbs.length})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {awbs.map((awb, index) => (
          <DropdownMenuItem
            key={awb.id}
            onClick={() => handleDownload(awb)}
          >
            <Download className="h-4 w-4 mr-2" />
            AWB {index + 1} - {new Date(awb.generated_at).toLocaleDateString()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}