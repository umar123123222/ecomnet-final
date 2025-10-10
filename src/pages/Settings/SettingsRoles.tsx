import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsRoles = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Role Management</h1>
      <Card>
        <CardHeader>
          <CardTitle>User Roles</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Configure and manage user roles and permissions.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsRoles;
