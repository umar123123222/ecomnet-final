import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsSecurity = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Security Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Security & Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Manage your security settings and privacy options.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsSecurity;
