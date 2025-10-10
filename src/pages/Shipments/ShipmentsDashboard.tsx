import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ShipmentsDashboard = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Shipments</h1>
      <Card>
        <CardHeader>
          <CardTitle>Shipments Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Track and manage all shipments.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipmentsDashboard;
