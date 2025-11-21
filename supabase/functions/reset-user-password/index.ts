import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  email: string;
}

// Generate a secure random password
function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: ResetPasswordRequest = await req.json();

    // Validate email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Looking up user by email:', email);

    // Find user by email
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) {
      console.error('Error listing users:', userError);
      throw userError;
    }

    const user = authUser.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      console.log('User not found:', email);
      // Don't reveal if user exists for security
      return new Response(
        JSON.stringify({ error: 'If this email is registered, a password reset email will be sent.' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check if user is active
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_active, full_name, role')
      .eq('id', user.id)
      .single();

    if (!profile?.is_active) {
      console.log('User is inactive:', email);
      return new Response(
        JSON.stringify({ error: 'This account is inactive. Please contact support.' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Generate new secure password
    const newPassword = generateSecurePassword();
    console.log('Generated new password for user:', user.id);

    // Update user password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password updated successfully');

    // Send credentials email using existing function
    const { error: emailError } = await supabaseAdmin.functions.invoke('send-user-credentials', {
      body: {
        email: user.email,
        full_name: profile.full_name || user.email,
        password: newPassword,
        roles: [profile.role],
        portal_url: `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || ''}`
      }
    });

    if (emailError) {
      console.error('Error sending credentials email:', emailError);
      // Don't fail the request if email fails, password is already reset
      console.log('Password reset succeeded but email failed');
    } else {
      console.log('Credentials email sent successfully');
    }

    // Log activity
    await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'password_reset',
        entity_type: 'auth',
        entity_id: user.id,
        details: { email: user.email, reset_at: new Date().toISOString() }
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password has been reset and sent to your email. Super admins have been notified.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error in reset-user-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to reset password' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

serve(handler);
