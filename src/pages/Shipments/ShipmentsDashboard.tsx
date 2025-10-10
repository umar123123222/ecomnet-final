import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ShipmentsDashboard = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Shipments Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Shipments Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Track and manage all shipments here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShipmentsDashboard;
