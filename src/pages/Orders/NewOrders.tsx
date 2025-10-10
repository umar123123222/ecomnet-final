import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NewOrders = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">New Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Orders List</CardTitle>
        </CardHeader>
        <CardContent>
          <p>View and process new orders here.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewOrders;
