
import React, { useState } from 'react';
import { ModernButton } from "@/components/ui/modern-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState("");
  
  const [formData, setFormData] = useState({
    name: "Admin User",
    email: "admin@ecomnet.com",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

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
      reader.onload = (e) => {
        setProfileImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    toast({
      title: "Profile Updated",
      description: "Your profile information has been updated successfully.",
    });
  };

  const handleChangePassword = () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirm password do not match.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Password Changed",
      description: "Your password has been updated successfully.",
    });
    
    setFormData(prev => ({
      ...prev,
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }));
  };

  return (
    <div className="container-md spacing-md">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Account Settings</h1>
        <p className="page-description">
          Manage your account settings and preferences to personalize your experience
        </p>
      </div>

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
                <input
                  id="profile-image"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <ModernButton 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => document.getElementById('profile-image')?.click()}
                >
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
                <Input
                  id="name"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>
              <div className="form-group">
                <Label htmlFor="email" className="form-label">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email address"
                />
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
                <Input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  className="form-input pr-10"
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                  placeholder="Enter your current password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password Fields */}
            <div className="grid-2-col">
              <div className="form-group">
                <Label htmlFor="new-password" className="form-label">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  className="form-input"
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                  placeholder="Enter new password"
                />
                <p className="form-helper">
                  Password must be at least 8 characters long
                </p>
              </div>
              <div className="form-group">
                <Label htmlFor="confirm-password" className="form-label">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    className="form-input pr-10"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Confirm your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <ModernButton 
                onClick={handleChangePassword}
                variant="secondary"
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Update Password
              </ModernButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
