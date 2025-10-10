import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsNotifications = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Notifications</h1>
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Configure how you receive notifications.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsNotifications;
