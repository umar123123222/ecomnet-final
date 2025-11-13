import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { openAWBPrintWindow, downloadAWBHTML } from "@/utils/awbHtmlGenerator";
import { convertPDFPagesToImages, loadPdfJsLibrary } from "@/utils/pdfToImage";

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

  const handleDownloadPDF = async (awb: any) => {
    setLoading(true);
    try {
      if (awb.pdf_url) {
        // Legacy: Single PDF URL
        const link = document.createElement('a');
        link.href = awb.pdf_url;
        link.download = `awb-${awb.courier_code}-${awb.id}.pdf`;
        link.target = '_blank';
        link.click();
      } else if (awb.pdf_data) {
        const pdfData = awb.pdf_data;
        
        // Check if it's multiple PDFs (JSON array) or single base64 string
        if (pdfData.startsWith('[')) {
          // Multiple PDFs
          const pdfArray = JSON.parse(pdfData);
          toast({
            title: "Downloading PDFs",
            description: `Downloading ${pdfArray.length} PDF file(s)...`,
          });
          pdfArray.forEach((base64: string, index: number) => {
            setTimeout(() => {
              const link = document.createElement('a');
              link.href = `data:application/pdf;base64,${base64}`;
              link.download = `awb-${awb.courier_code}-batch-${index + 1}.pdf`;
              link.click();
            }, index * 500); // Delay to avoid browser blocking multiple downloads
          });
        } else {
          // Single base64 PDF
          const link = document.createElement('a');
          link.href = `data:application/pdf;base64,${pdfData}`;
          link.download = `awb-${awb.courier_code}-${awb.id}.pdf`;
          link.click();
        }
      }

      toast({
        title: "Success",
        description: "AWB PDF download started"
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

  const handlePrintHTML = async (awb: any) => {
    setLoading(true);
    try {
      if (!awb.html_images) {
        toast({
          title: "Not Available",
          description: "HTML format not available for this AWB. Please use PDF format.",
          variant: "destructive"
        });
        return;
      }

      // Load PDF.js library if not already loaded
      toast({
        title: "Processing",
        description: "Converting PDFs to images for printing..."
      });

      await loadPdfJsLibrary();

      const pdfPagesBase64 = JSON.parse(awb.html_images);
      
      if (pdfPagesBase64.length === 0) {
        throw new Error('No PDF pages available');
      }

      // Convert PDF pages to images
      const imageDataArray = await convertPDFPagesToImages(pdfPagesBase64);

      if (imageDataArray.length === 0) {
        throw new Error('Failed to convert PDFs to images');
      }

      openAWBPrintWindow(imageDataArray);

      toast({
        title: "Success",
        description: `Print window opened with ${imageDataArray.length} AWBs (3 per page layout)`
      });
    } catch (error: any) {
      console.error('Error opening print window:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to open print window. Please allow popups.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadHTML = async (awb: any) => {
    setLoading(true);
    try {
      if (!awb.html_images) {
        toast({
          title: "Not Available",
          description: "HTML format not available for this AWB.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Processing",
        description: "Converting PDFs to images..."
      });

      await loadPdfJsLibrary();

      const pdfPagesBase64 = JSON.parse(awb.html_images);
      const imageDataArray = await convertPDFPagesToImages(pdfPagesBase64);

      downloadAWBHTML(imageDataArray, `awb-${awb.courier_code}-${awb.id}.html`);

      toast({
        title: "Success",
        description: "HTML file downloaded with 3 AWBs per page layout"
      });
    } catch (error: any) {
      console.error('Error downloading HTML:', error);
      toast({
        title: "Error",
        description: "Failed to download HTML",
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
    const awb = awbs[0];
    const hasHTML = !!awb.html_images;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            AWB
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>PDF Format</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleDownloadPDF(awb)}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </DropdownMenuItem>
          
          {hasHTML && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>HTML Format (3/page)</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handlePrintHTML(awb)}>
                <Printer className="h-4 w-4 mr-2" />
                Print HTML
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadHTML(awb)}>
                <Download className="h-4 w-4 mr-2" />
                Download HTML
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
        {awbs.map((awb, index) => {
          const hasHTML = !!awb.html_images;
          const date = new Date(awb.generated_at).toLocaleDateString();
          
          return (
            <div key={awb.id}>
              {index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>
                AWB {index + 1} - {date}
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleDownloadPDF(awb)}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </DropdownMenuItem>
              {hasHTML && (
                <>
                  <DropdownMenuItem onClick={() => handlePrintHTML(awb)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print HTML (3/page)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDownloadHTML(awb)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download HTML
                  </DropdownMenuItem>
                </>
              )}
            </div>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}