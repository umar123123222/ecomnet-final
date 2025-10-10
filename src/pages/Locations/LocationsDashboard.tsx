import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const LocationsDashboard = () => {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <MapPin className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Locations</h1>
      </div>

      <Card className="p-6">
        <p className="text-muted-foreground">
          Manage your business locations and delivery zones here.
        </p>
      </Card>
    </div>
  );
};

export default LocationsDashboard;
