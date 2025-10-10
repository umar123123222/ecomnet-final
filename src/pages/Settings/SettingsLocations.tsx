import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsLocations = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Location Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manage Locations</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Configure warehouse and store locations.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsLocations;
