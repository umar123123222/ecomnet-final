import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsRoles = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Roles & Permissions</h1>
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Configure roles and permissions for your team.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsRoles;
