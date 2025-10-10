import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DeliveredOrders = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Delivered Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Successfully Delivered</CardTitle>
        </CardHeader>
        <CardContent>
          <p>View all successfully delivered orders.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveredOrders;
