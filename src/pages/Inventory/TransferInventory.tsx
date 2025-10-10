import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const TransferInventory = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Transfer Stock</h1>
      <Card>
        <CardHeader>
          <CardTitle>Stock Transfer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Transfer stock between locations.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TransferInventory;
