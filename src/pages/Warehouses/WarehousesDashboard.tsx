import { Card } from "@/components/ui/card";
import { Warehouse } from "lucide-react";

const WarehousesDashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Warehouse className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Warehouses</h1>
      </div>

      <Card className="p-6">
        <p className="text-muted-foreground">
          Manage your warehouse facilities and storage locations here.
        </p>
      </Card>
    </div>
  );
};

export default WarehousesDashboard;
