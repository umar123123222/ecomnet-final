import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { generateBarcode } from '@/utils/barcodeGenerator';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Package, PackageCheck, Truck, QrCode, Calendar, User } from 'lucide-react';
import { ProductBarcode, BarcodeType } from '@/types/barcode';
import { format } from 'date-fns';

interface ProductBarcodeManagerProps {
  productId: string;
  productName: string;
  productSku: string;
}

const barcodeTypeConfig = {
  raw: {
    label: 'Raw Product',
    icon: Package,
    color: 'bg-blue-500',
    description: 'Generated when raw material is entered',
  },
  finished: {
    label: 'Finished Product',
    icon: PackageCheck,
    color: 'bg-green-500',
    description: 'Generated when product is ready for sale',
  },
  distribution: {
    label: 'Distribution',
    icon: Truck,
    color: 'bg-purple-500',
    description: 'Generated for e-commerce or retail assignment',
  },
};

export function ProductBarcodeManager({ productId, productName, productSku }: ProductBarcodeManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isManager, isSeniorStaff } = useUserRoles();
  const [barcodeImages, setBarcodeImages] = useState<Record<string, string>>({});

  const canManageBarcodes = isManager() || isSeniorStaff();

  // Fetch all barcodes for this product
  const { data: barcodes = [], isLoading } = useQuery({
    queryKey: ['product-barcodes', productId],
    queryFn: async () => {
      const { data: barcodesData, error } = await supabase
        .from('product_barcodes')
        .select('*')
        .eq('product_id', productId)
        .order('generated_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles for generated_by
      const userIds = [...new Set(barcodesData?.map(b => b.generated_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Generate barcode images
      const images: Record<string, string> = {};
      const result = [];
      
      for (const barcode of barcodesData || []) {
        try {
          const imageUrl = await generateBarcode(barcode.barcode_value, barcode.barcode_format);
          images[barcode.id] = imageUrl;
        } catch (err) {
          console.error('Failed to generate barcode image:', err);
        }
        
        result.push({
          ...barcode,
          profiles: barcode.generated_by ? profilesMap.get(barcode.generated_by) || null : null,
        });
      }
      
      setBarcodeImages(images);
      return result as (ProductBarcode & { profiles: { full_name: string } | null })[];
    },
  });

  // Generate new barcode mutation
  const generateMutation = useMutation({
    mutationFn: async (barcodeType: BarcodeType) => {
      const { data, error } = await supabase.functions.invoke('generate-product-barcode', {
        body: {
          product_id: productId,
          barcode_type: barcodeType,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Barcode Generated',
        description: `${barcodeTypeConfig[data.barcode.barcode_type].label} barcode created successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['product-barcodes', productId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate barcode',
        variant: 'destructive',
      });
    },
  });

  const getBarcodeByType = (type: BarcodeType) => {
    return barcodes.find((b) => b.barcode_type === type && b.status === 'active');
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading barcodes...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Product Barcode Management</h3>
          <p className="text-sm text-muted-foreground">
            3-level barcode lifecycle for {productName}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(barcodeTypeConfig) as BarcodeType[]).map((type) => {
          const config = barcodeTypeConfig[type];
          const barcode = getBarcodeByType(type);
          const Icon = config.icon;

          return (
            <Card key={type} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`${config.color} p-2 rounded-lg`}>
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <CardTitle className="text-base">{config.label}</CardTitle>
                  </div>
                  {barcode && (
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs">{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {barcode ? (
                  <>
                    {barcodeImages[barcode.id] && (
                      <div className="bg-white p-2 rounded border">
                        <img
                          src={barcodeImages[barcode.id]}
                          alt={barcode.barcode_value}
                          className="w-full h-auto"
                        />
                      </div>
                    )}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <QrCode className="h-3 w-3" />
                        <span className="font-mono">{barcode.barcode_value}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(barcode.generated_at), 'PPp')}</span>
                      </div>
                      {barcode.profiles && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>{barcode.profiles.full_name}</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      No {config.label.toLowerCase()} barcode generated yet
                    </div>
                    {canManageBarcodes && (
                      <Button
                        onClick={() => generateMutation.mutate(type)}
                        disabled={generateMutation.isPending}
                        className="w-full"
                        size="sm"
                      >
                        {generateMutation.isPending ? 'Generating...' : 'Generate Barcode'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!canManageBarcodes && (
        <p className="text-xs text-muted-foreground text-center">
          You need manager or warehouse permissions to generate barcodes
        </p>
      )}
    </div>
  );
}
