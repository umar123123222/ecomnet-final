import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ModernButton } from "@/components/ui/modern-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Eye, EyeOff, Settings as SettingsIcon, Calendar, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/layout";
import { Switch } from "@/components/ui/switch";

// PostEx Delivery Date Backfill Component
const PostExBackfillSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runBackfill = async () => {
    if (!dryRun) {
      const ok = confirm(
        'This will UPDATE delivered_at for PostEx delivered orders based on tracking history. Continue?'
      );
      if (!ok) return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('backfill-postex-delivery-dates', {
        body: {
          dryRun,
          batchSize: 500,
          maxBatches: 50,
        },
      });

      if (error) throw error;

      setResult(data);

      if (!dryRun) {
        await queryClient.invalidateQueries({
          predicate: (q) => {
            const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
            return (
              typeof key0 === 'string' &&
              (key0.startsWith('finance-') || key0 === 'courier-performance')
            );
          },
        });
      }

      toast({
        title: dryRun ? 'Dry Run Complete' : 'Backfill Complete',
        description: `${dryRun ? 'Would update' : 'Updated'} ${data?.updated || 0} orders. Scanned ${data?.scannedRecords || 0} tracking records.${
          dryRun ? '' : ' Finance Analytics has been refreshed.'
        }`,
      });
    } catch (error: any) {
      console.error('Backfill error:', error);
      toast({
        title: 'Backfill Failed',
        description: error.message || 'Failed to run backfill',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">Backfill PostEx Delivery Dates</Label>
      <p className="text-sm text-muted-foreground mb-3">
        Updates delivered_at for PostEx orders using actual courier delivery timestamps from tracking history.
        This fixes date range filtering issues where orders show up on incorrect dates.
      </p>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Switch
            id="dry-run"
            checked={dryRun}
            onCheckedChange={setDryRun}
          />
          <Label htmlFor="dry-run" className="text-sm cursor-pointer">
            Dry Run (preview only)
          </Label>
        </div>
      </div>

      <ModernButton 
        variant={dryRun ? "outline" : "default"}
        onClick={runBackfill}
        disabled={isRunning}
        className="gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Calendar className="h-4 w-4" />
            {dryRun ? "Preview Changes" : "Run Backfill"}
          </>
        )}
      </ModernButton>

      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>Scanned Records:</div>
            <div className="font-medium">{result.scannedRecords?.toLocaleString()}</div>
            <div>Unique Orders:</div>
            <div className="font-medium">{result.uniqueOrders?.toLocaleString()}</div>
            <div>{dryRun ? 'Would Update:' : 'Updated:'}</div>
            <div className="font-medium text-green-600">{result.updated?.toLocaleString()}</div>
            <div>Skipped (same date):</div>
            <div className="font-medium">{result.skipped?.toLocaleString()}</div>
            {result.errors > 0 && (
              <>
                <div>Errors:</div>
                <div className="font-medium text-destructive">{result.errors}</div>
              </>
            )}
          </div>
          
          {result.updates && result.updates.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2">Sample Updates:</div>
              <div className="max-h-40 overflow-auto space-y-1 text-xs">
                {result.updates.slice(0, 10).map((u: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono">{u.order_number}</span>
                    <span className="text-muted-foreground">{u.old_delivered_at?.split('T')[0]} → {u.new_delivered_at?.split('T')[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Fix Delivery Dates from PostEx API - calls PostEx API directly for each order
const FixDeliveryDatesFromAPISection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [batchSize, setBatchSize] = useState(50);
  const [maxBatches, setMaxBatches] = useState(10);

  const runFix = async () => {
    if (!dryRun) {
      const ok = confirm(
        'This will UPDATE delivered_at for PostEx orders by calling the PostEx API directly to get actual delivery dates. Continue?'
      );
      if (!ok) return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('fix-delivery-dates-from-api', {
        body: {
          dryRun,
          batchSize,
          maxBatches,
        },
      });

      if (error) throw error;

      setResult(data);

      if (!dryRun && data?.updated > 0) {
        await queryClient.invalidateQueries({
          predicate: (q) => {
            const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
            return (
              typeof key0 === 'string' &&
              (key0.startsWith('finance-') || key0 === 'courier-performance' || key0 === 'orders')
            );
          },
        });
      }

      toast({
        title: dryRun ? 'Dry Run Complete' : 'Fix Complete',
        description: `${dryRun ? 'Would update' : 'Updated'} ${data?.updated || 0} orders. Processed ${data?.processed || 0} orders.`,
      });
    } catch (error: any) {
      console.error('Fix error:', error);
      toast({
        title: 'Fix Failed',
        description: error.message || 'Failed to fix delivery dates',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">Fix Delivery Dates from PostEx API</Label>
      <p className="text-sm text-muted-foreground mb-3">
        Calls the PostEx API directly for each delivered order to get the actual delivery timestamp,
        then updates delivered_at accordingly. This is more accurate than the tracking history backfill.
      </p>
      
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Switch
            id="api-dry-run"
            checked={dryRun}
            onCheckedChange={setDryRun}
          />
          <Label htmlFor="api-dry-run" className="text-sm cursor-pointer">
            Dry Run (preview only)
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="api-batch-size" className="text-sm">
            Batch Size:
          </Label>
          <Input
            id="api-batch-size"
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
            className="w-20 h-8"
            min={1}
            max={100}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="api-max-batches" className="text-sm">
            Max Batches:
          </Label>
          <Input
            id="api-max-batches"
            type="number"
            value={maxBatches}
            onChange={(e) => setMaxBatches(Math.min(50, Math.max(1, parseInt(e.target.value) || 10)))}
            className="w-20 h-8"
            min={1}
            max={50}
          />
        </div>
      </div>

      <ModernButton 
        variant={dryRun ? "outline" : "default"}
        onClick={runFix}
        disabled={isRunning}
        className="gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Calendar className="h-4 w-4" />
            {dryRun ? "Preview Changes" : "Fix Delivery Dates"}
          </>
        )}
      </ModernButton>

      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>Processed:</div>
            <div className="font-medium">{result.processed?.toLocaleString()}</div>
            <div>{dryRun ? 'Would Update:' : 'Updated:'}</div>
            <div className="font-medium text-green-600">{result.updated?.toLocaleString()}</div>
            <div>Skipped (same date):</div>
            <div className="font-medium">{result.skipped?.toLocaleString()}</div>
            {result.errors > 0 && (
              <>
                <div>Errors:</div>
                <div className="font-medium text-destructive">{result.errors}</div>
              </>
            )}
          </div>
          
          {result.updates && result.updates.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2">Sample Updates:</div>
              <div className="max-h-40 overflow-auto space-y-1 text-xs">
                {result.updates.slice(0, 15).map((u: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono">{u.order_number}</span>
                    <span className="text-muted-foreground">
                      {u.old_value?.split('T')[0] || 'null'} → {u.new_value?.split('T')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errorDetails && result.errorDetails.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2 text-destructive">Errors:</div>
              <div className="max-h-40 overflow-auto space-y-1 text-xs">
                {result.errorDetails.slice(0, 10).map((e: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono">{e.order_number}</span>
                    <span className="text-destructive">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Verify Untracked PostEx Orders Component
const VerifyUntrackedPostExSection = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [batchSize, setBatchSize] = useState(50);

  const runVerification = async () => {
    const ok = confirm(
      'This will check PostEx orders marked as "delivered" that have NO tracking history, and downgrade any that are NOT actually delivered. Continue?'
    );
    if (!ok) return;

    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-postex-orders', {
        body: {
          batchSize,
          includeUntracked: true,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data?.downgraded > 0) {
        await queryClient.invalidateQueries({
          predicate: (q) => {
            const key0 = Array.isArray(q.queryKey) ? q.queryKey[0] : undefined;
            return (
              typeof key0 === 'string' &&
              (key0.startsWith('finance-') || key0 === 'courier-performance' || key0 === 'orders')
            );
          },
        });
      }

      toast({
        title: 'Verification Complete',
        description: `Processed ${data?.processed || 0} orders. ${data?.verified || 0} confirmed delivered, ${data?.downgraded || 0} corrected.`,
        variant: data?.downgraded > 0 ? 'default' : 'default',
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify orders',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-2 block">Verify Untracked PostEx Orders</Label>
      <p className="text-sm text-muted-foreground mb-3">
        Finds PostEx orders marked as "delivered" but with NO tracking history, calls PostEx API to verify
        their actual status, and corrects any that aren't actually delivered.
      </p>
      
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="batch-size" className="text-sm">
            Batch Size:
          </Label>
          <Input
            id="batch-size"
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(200, Math.max(1, parseInt(e.target.value) || 50)))}
            className="w-20 h-8"
            min={1}
            max={200}
          />
        </div>
      </div>

      <ModernButton 
        variant="default"
        onClick={runVerification}
        disabled={isRunning}
        className="gap-2"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying...
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" />
            Verify Untracked Orders
          </>
        )}
      </ModernButton>

      {result && (
        <div className="mt-4 p-4 bg-muted rounded-lg text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>Processed:</div>
            <div className="font-medium">{result.processed?.toLocaleString()}</div>
            <div>Confirmed Delivered:</div>
            <div className="font-medium text-green-600">{result.verified?.toLocaleString()}</div>
            <div>Corrected (Downgraded):</div>
            <div className="font-medium text-amber-600">{result.downgraded?.toLocaleString()}</div>
            {result.errors > 0 && (
              <>
                <div>Errors:</div>
                <div className="font-medium text-destructive">{result.errors}</div>
              </>
            )}
          </div>
          
          {result.downgradedOrders && result.downgradedOrders.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2">Corrected Orders:</div>
              <div className="max-h-40 overflow-auto space-y-1 text-xs">
                {result.downgradedOrders.map((o: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono">{o.order_number}</span>
                    <span className="text-muted-foreground">PostEx: {o.postex_status} → {o.new_status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errorDetails && result.errorDetails.length > 0 && (
            <div className="mt-4">
              <div className="font-medium mb-2 text-destructive">Errors:</div>
              <div className="max-h-40 overflow-auto space-y-1 text-xs">
                {result.errorDetails.slice(0, 10).map((e: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-mono">{e.order_number}</span>
                    <span className="text-destructive">{e.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


const Settings = () => {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.full_name || "",
        email: profile.email || ""
      }));
    }
  }, [profile]);
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleSaveProfile = async () => {
    if (!profile) return;
    try {
      const {
        error
      } = await supabase.from('profiles').update({
        full_name: formData.name,
        email: formData.email
      }).eq('id', profile.id);
      if (error) throw error;
      toast({
        title: "Profile Updated",
        description: "Your profile information has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
  };
  const handleChangePassword = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive"
      });
      return;
    }
    if (formData.newPassword.length < 8) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.auth.updateUser({
        password: formData.newPassword
      });
      if (error) throw error;
      toast({
        title: "Password Changed",
        description: "Your password has been updated successfully."
      });
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      }));
    } catch (error) {
      toast({
        title: "Password Change Failed",
        description: "Failed to change password. Please try again.",
        variant: "destructive"
      });
    }
  };
  return (
    <PageContainer>
      <PageHeader
        title="Account Settings"
        description="Manage your account settings and preferences to personalize your experience"
        icon={SettingsIcon}
      />

      <div className="space-y-8">
        {/* Profile Information Card */}
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">Profile Information</CardTitle>
            <CardDescription className="card-description">
              Update your personal information and profile picture to keep your account current
            </CardDescription>
          </CardHeader>
          <CardContent className="card-content space-y-8">
            {/* Profile Picture Section */}
            <div className="flex items-center gap-6">
              <Avatar className="w-24 h-24 ring-4 ring-purple-100 dark:ring-purple-800">
                <AvatarImage src={profileImage} alt="Profile Picture" />
                <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-2xl font-semibold">
                  {formData.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <input id="profile-image" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <ModernButton variant="outline" size="sm" className="gap-2" onClick={() => document.getElementById('profile-image')?.click()}>
                  <Camera className="h-4 w-4" />
                  Change Photo
                </ModernButton>
                <p className="form-helper">
                  Upload JPG, PNG or GIF files (max 5MB)
                </p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="grid-2-col">
              <div className="form-group">
                <Label htmlFor="name" className="form-label">Full Name</Label>
                <Input id="name" className="form-input" value={formData.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="Enter your full name" />
              </div>
              <div className="form-group">
                <Label htmlFor="email" className="form-label">Email Address</Label>
                <Input id="email" type="email" className="form-input" value={formData.email} onChange={e => handleInputChange('email', e.target.value)} placeholder="Enter your email address" />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <ModernButton onClick={handleSaveProfile} className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </ModernButton>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings Card */}
        <Card className="modern-card">
          <CardHeader className="card-header">
            <CardTitle className="card-title">Security Settings</CardTitle>
            <CardDescription className="card-description">
              Update your password to keep your account secure and protected
            </CardDescription>
          </CardHeader>
          <CardContent className="card-content space-y-6">
            {/* Current Password */}
            <div className="form-group">
              <Label htmlFor="current-password" className="form-label">Current Password</Label>
              <div className="relative">
                <Input id="current-password" type={showPassword ? "text" : "password"} className="form-input pr-10" value={formData.currentPassword} onChange={e => handleInputChange('currentPassword', e.target.value)} placeholder="Enter your current password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password Fields */}
            <div className="grid-2-col">
              <div className="form-group">
                <Label htmlFor="new-password" className="form-label">New Password</Label>
                <Input id="new-password" type="password" className="form-input" value={formData.newPassword} onChange={e => handleInputChange('newPassword', e.target.value)} placeholder="Enter new password" />
                <p className="form-helper">
                  Password must be at least 8 characters long
                </p>
              </div>
              <div className="form-group">
                <Label htmlFor="confirm-password" className="form-label">Confirm New Password</Label>
                <div className="relative">
                  <Input id="confirm-password" type={showConfirmPassword ? "text" : "password"} className="form-input pr-10" value={formData.confirmPassword} onChange={e => handleInputChange('confirmPassword', e.target.value)} placeholder="Confirm your new password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <ModernButton onClick={handleChangePassword} variant="secondary" className="gap-2">
                <Save className="h-4 w-4" />
                Update Password
              </ModernButton>
            </div>
          </CardContent>
        </Card>

        {/* Shopify Integration Card */}
        

        {/* System Operations - Super Admin Only */}
        {profile?.role === 'super_admin' && <Card className="card">
            <CardHeader className="card-header">
              <CardTitle className="card-title">System Operations</CardTitle>
              <CardDescription className="card-description">
                System-wide administrative operations (Super Admin only)
              </CardDescription>
            </CardHeader>
            <CardContent className="card-content">
              <div className="space-y-6">
                {/* PostEx Delivery Date Backfill (from tracking history) */}
                <PostExBackfillSection />

                <div className="border-t border-border pt-4">
                  {/* Fix Delivery Dates from PostEx API (direct API calls) */}
                  <FixDeliveryDatesFromAPISection />
                </div>

                <div className="border-t border-border pt-4">
                  {/* Verify Untracked PostEx Orders */}
                  <VerifyUntrackedPostExSection />
                </div>

                <div className="border-t border-border pt-4">
                  <Label className="text-sm font-medium mb-2 block">Reset All Orders Status</Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    This will update all orders in the system to "pending" status. This action cannot be undone.
                  </p>
                  <ModernButton variant="destructive" onClick={async () => {
                if (confirm('Are you sure you want to reset ALL orders to pending status? This cannot be undone.')) {
                  try {
                    const {
                      updateAllOrdersPending
                    } = await import('@/integrations/supabase/functions');
                    const {
                      data,
                      error
                    } = await updateAllOrdersPending();
                    if (error) throw error;
                    toast({
                      title: "System Update Complete",
                      description: `Successfully updated ${data?.ordersUpdated || 0} orders to pending status.`
                    });
                  } catch (error: any) {
                    toast({
                      title: "Update Failed",
                      description: error.message || "Failed to update orders",
                      variant: "destructive"
                    });
                  }
                }
              }}>
                    Reset All Orders to Pending
                  </ModernButton>
                </div>
              </div>
            </CardContent>
          </Card>}
      </div>
    </PageContainer>
  );
};
export default Settings;