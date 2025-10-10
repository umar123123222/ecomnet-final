import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TransferInventory = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Transfer Inventory</h1>
      <Card>
        <CardHeader>
          <CardTitle>Transfer Between Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Transfer inventory items between outlets or warehouses.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransferInventory;
