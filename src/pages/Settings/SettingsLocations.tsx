import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsLocations = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Locations</h1>
      <Card>
        <CardHeader>
          <CardTitle>Location Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Manage warehouse and outlet locations.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsLocations;
