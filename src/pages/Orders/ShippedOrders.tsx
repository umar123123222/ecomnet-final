import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ShippedOrders = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Shipped Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Shipped Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p>View all shipped orders and their tracking information.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShippedOrders;
