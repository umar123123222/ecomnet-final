import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsNotifications = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Manage Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Configure your notification preferences.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsNotifications;
