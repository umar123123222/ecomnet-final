import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { APISettingsCard } from "@/components/settings/APISettingsCard";
import { Navigate } from "react-router-dom";

const BusinessSettings = () => {
  const { profile } = useAuth();

  // Only super_admin can access business settings
  if (profile?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Business Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure business-wide settings and integrations
        </p>
      </div>

      <APISettingsCard isSuperAdmin={true} />
    </div>
  );
};

export default BusinessSettings;
