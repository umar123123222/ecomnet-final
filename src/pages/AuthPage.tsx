import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const {
    signIn,
    isLoading,
    user,
    profile,
    isSuspended
  } = useAuth();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();

  // Redirect if already authenticated and profile loaded
  useEffect(() => {
    if (user && profile && !isLoading) {
      // Clear any cached auth state before redirecting
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => {
            if (name.includes('auth')) {
              caches.delete(name);
            }
          });
        });
      }
      navigate('/', { replace: true });
    }
  }, [user, profile, isLoading, navigate]);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all fields',
        variant: 'destructive'
      });
      return;
    }
    const {
      error
    } = await signIn(email, password);
    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive'
      });
    } else {
      toast({
        title: 'Success',
        description: 'Logged in successfully!'
      });
      // After successful login, send user to home/dashboard
      navigate('/', { replace: true });
    }
  };
  const handleResetDemoPassword = async () => {
    setResettingPassword(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('reset-demo-user');
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Demo password reset to admin123. You can now log in.'
      });
    } catch (error: any) {
      console.error('Error resetting demo password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset demo password',
        variant: 'destructive'
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail || !resetEmail.includes('@')) {
      toast({
        title: 'Error',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { email: resetEmail }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'If this email is registered, a password reset email has been sent. Please check your inbox.'
      });
      
      setShowForgotPassword(false);
      setResetEmail('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset password',
        variant: 'destructive'
      });
    } finally {
      setIsResettingPassword(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Suspension Notice */}
          {isSuspended && (
            <div className="mb-4 p-4 bg-destructive/10 border border-destructive rounded-lg">
              <div className="flex items-center gap-2 text-destructive font-semibold mb-1">
                🚫 Account Suspended
              </div>
              <p className="text-sm text-destructive/90">
                Your account has been suspended. Please contact your administrator for assistance.
              </p>
            </div>
          )}
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </> : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="link"
              className="text-sm"
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot Password?
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a new password.
              Super admins will also be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="Enter your email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleForgotPassword();
                  }
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowForgotPassword(false);
                  setResetEmail('');
                }}
                disabled={isResettingPassword}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleForgotPassword}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Email'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};
export default AuthPage;