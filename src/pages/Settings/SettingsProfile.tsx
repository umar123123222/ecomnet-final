import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SettingsProfile = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Manage your profile information and preferences.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsProfile;
