import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AddInventory = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Add Inventory</h1>
      <Card>
        <CardHeader>
          <CardTitle>Add New Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Add new items to your inventory.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddInventory;
