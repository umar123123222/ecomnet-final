import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ProcessingOrders = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Processing Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Orders Being Processed</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Track orders currently being processed.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingOrders;
