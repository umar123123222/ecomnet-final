import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ReturnedOrders = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Returned Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Returned Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Manage orders that have been returned.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnedOrders;
