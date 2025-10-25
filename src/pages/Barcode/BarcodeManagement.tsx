import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarcodeLifecycleTracker } from '@/components/barcode/BarcodeLifecycleTracker';
import { QrCode, Search } from 'lucide-react';

export default function BarcodeManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Barcode Management</h1>
        <p className="text-muted-foreground">
          Manage 3-level product barcodes and track lifecycle
        </p>
      </div>

      <Tabs defaultValue="tracker" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tracker" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Lifecycle Tracker
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Generate Barcodes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tracker" className="space-y-4">
          <BarcodeLifecycleTracker />
        </TabsContent>

        <TabsContent value="manage" className="space-y-4">
          <div className="text-center py-12 text-muted-foreground">
            <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Go to Product Management to generate barcodes for specific products</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
