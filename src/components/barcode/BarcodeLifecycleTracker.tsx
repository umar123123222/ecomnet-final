import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, PackageCheck, Truck, Calendar, User, ArrowRight } from 'lucide-react';
import { ProductLifecycle } from '@/types/barcode';
import { format } from 'date-fns';
import UnifiedScanner from '@/components/UnifiedScanner';

const barcodeTypeConfig = {
  raw: { label: 'Raw Product', icon: Package, color: 'bg-blue-500' },
  finished: { label: 'Finished Product', icon: PackageCheck, color: 'bg-green-500' },
  distribution: { label: 'Distribution', icon: Truck, color: 'bg-purple-500' },
};

export function BarcodeLifecycleTracker() {
  const [searchValue, setSearchValue] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: lifecycle, isLoading, error } = useQuery({
    queryKey: ['barcode-lifecycle', searchQuery],
    queryFn: async () => {
      if (!searchQuery) return [];

      const { data, error } = await supabase.rpc('get_product_lifecycle', {
        p_barcode: searchQuery,
      });

      if (error) throw error;
      return data as ProductLifecycle[];
    },
    enabled: !!searchQuery,
  });

  const handleSearch = () => {
    if (searchValue.trim()) {
      setSearchQuery(searchValue.trim());
    }
  };

  const handleScan = (result: any) => {
    if (result.barcode) {
      setSearchValue(result.barcode);
      setSearchQuery(result.barcode);
      setScannerOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Product Lifecycle Tracker</CardTitle>
          <CardDescription>
            Scan or search for any barcode to trace the complete product lifecycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter or scan barcode..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={!searchValue.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            <Button onClick={() => setScannerOpen(true)} variant="outline">
              Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {searchQuery && (
        <Card>
          <CardHeader>
            <CardTitle>Lifecycle Results</CardTitle>
            <CardDescription>Showing history for barcode: {searchQuery}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">Loading lifecycle...</div>
            )}

            {error && (
              <div className="text-center py-8 text-destructive">
                Failed to load lifecycle data
              </div>
            )}

            {lifecycle && lifecycle.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No barcode found matching "{searchQuery}"
              </div>
            )}

            {lifecycle && lifecycle.length > 0 && (
              <div className="space-y-6">
                <div className="bg-muted p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-1">{lifecycle[0].product_name}</h3>
                  <p className="text-sm text-muted-foreground">SKU: {lifecycle[0].product_sku}</p>
                </div>

                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-border" />

                  <div className="space-y-6">
                    {lifecycle.map((stage, index) => {
                      const config = barcodeTypeConfig[stage.barcode_type];
                      const Icon = config.icon;

                      return (
                        <div key={stage.barcode_value} className="relative flex gap-4">
                          {/* Timeline node */}
                          <div className={`${config.color} p-3 rounded-full z-10 shrink-0`}>
                            <Icon className="h-5 w-5 text-white" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 pb-6">
                            <div className="bg-card border rounded-lg p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">{config.label}</h4>
                                <Badge variant={stage.status === 'active' ? 'default' : 'secondary'}>
                                  {stage.status}
                                </Badge>
                              </div>

                              <div className="grid gap-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <span className="font-medium">Barcode:</span>
                                  <span className="font-mono">{stage.barcode_value}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  <span>{format(new Date(stage.generated_at), 'PPp')}</span>
                                </div>
                                {stage.generated_by_name && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    <span>{stage.generated_by_name}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {index < lifecycle.length - 1 && (
                              <div className="flex items-center justify-center py-2">
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <UnifiedScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        scanType="dispatch"
        title="Scan Barcode"
      />
    </div>
  );
}
