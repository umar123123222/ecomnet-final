import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSupplierAccountRequest {
  supplier_id: string;
  email: string;
  contact_person: string;
  supplier_name: string;
}

function generateSecurePassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function getPortalUrl(supabase: any): Promise<string> {
  const { data: portalUrlSetting } = await supabase
    .from('api_settings')
    .select('setting_value')
    .eq('setting_key', 'portal_url')
    .maybeSingle();
  
  return portalUrlSetting?.setting_value || 'https://your-portal.com';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { supplier_id, email, contact_person, supplier_name }: CreateSupplierAccountRequest = await req.json();

    console.log('Creating supplier account for:', email);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser.users?.some(u => u.email === email);

    if (userExists) {
      console.log('User already exists:', email);
      
      // Get the existing user
      const existingAuthUser = existingUser.users?.find(u => u.email === email);
      
      if (!existingAuthUser) {
        throw new Error('Failed to retrieve existing user details');
      }
      
      // Check if supplier profile already exists for THIS supplier
      const { data: existingProfile } = await supabase
        .from('supplier_profiles')
        .select('user_id')
        .eq('supplier_id', supplier_id)
        .single();

      if (existingProfile) {
        // Resend portal access: reset password and email credentials
        const newPassword = generateSecurePassword();
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingAuthUser.id, { password: newPassword });
        if (updateError) {
          throw new Error(`Failed to reset password for existing user: ${updateError.message}`);
        }

        const portalUrl = await getPortalUrl(supabase);
        
        let emailSent = false;
        try {
          const { error: emailError } = await supabase.functions.invoke('send-user-credentials', {
            body: {
              email,
              password: newPassword,
              full_name: contact_person,
              roles: ['supplier'],
              portal_url: portalUrl,
              supplier_name,
            }
          });
          if (emailError) {
            console.error('Email sending error (resend):', emailError);
          } else {
            emailSent = true;
            console.log('Credentials email re-sent successfully');
          }
        } catch (e) {
          console.error('Failed to resend email:', e);
        }

        return new Response(
          JSON.stringify({
            success: true,
            user_id: existingAuthUser.id,
            email_sent: emailSent,
            message: emailSent ? 'Portal access re-sent successfully' : 'Password reset; failed to send credentials email'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // User exists but no supplier profile for this supplier - ADD the supplier profile
      console.log('Adding supplier profile to existing user:', existingAuthUser.id);
      
      // Ensure main profile exists (required for AuthContext)
      const { data: existingMainProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', existingAuthUser.id)
        .maybeSingle();

      if (!existingMainProfile) {
        console.log('Creating main profile for existing user');
        const { error: mainProfileError } = await supabase
          .from('profiles')
          .insert({
            id: existingAuthUser.id,
            email,
            full_name: contact_person,
            role: 'supplier',
            is_active: true,
          });

        if (mainProfileError) {
          console.error('Main profile creation error:', mainProfileError);
          throw new Error(`Failed to create main profile: ${mainProfileError.message}`);
        }
      }
      
      const { error: profileError } = await supabase
        .from('supplier_profiles')
        .insert({
          user_id: existingAuthUser.id,
          supplier_id,
          can_view_inventory: true,
          can_accept_orders: true,
          can_view_analytics: false,
        });

      if (profileError) {
        throw new Error(`Failed to create supplier profile: ${profileError.message}`);
      }
      
      // Add supplier role to user_roles
      const { error: userRoleError } = await supabase
        .from('user_roles')
        .upsert({
          user_id: existingAuthUser.id,
          role: 'supplier',
          assigned_by: existingAuthUser.id,
          is_active: true,
        }, {
          onConflict: 'user_id,role',
          ignoreDuplicates: false
        });

      if (userRoleError) {
        console.error('Failed to add supplier role:', userRoleError);
      }
      
      // Set a new password and send credentials to the existing user
      const newPassword = generateSecurePassword();
      const { error: updateError2 } = await supabase.auth.admin.updateUserById(existingAuthUser.id, { password: newPassword });
      if (updateError2) {
        throw new Error(`Failed to set password for existing user: ${updateError2.message}`);
      }

      const portalUrl = await getPortalUrl(supabase);
      
      let emailSent2 = false;
      try {
        const { error: emailError2 } = await supabase.functions.invoke('send-user-credentials', {
          body: {
            email,
            password: newPassword,
            full_name: contact_person,
            roles: ['supplier'],
            portal_url: portalUrl,
            supplier_name,
          }
        });
        if (emailError2) {
          console.error('Email sending error (existing user):', emailError2);
        } else {
          emailSent2 = true;
          console.log('Credentials email sent to existing user');
        }
      } catch (e) {
        console.error('Failed to send email to existing user:', e);
      }
      
      console.log('Supplier profile added to existing user');
      
      return new Response(
        JSON.stringify({
          success: true,
          user_id: existingAuthUser.id,
          email_sent: emailSent2,
          message: emailSent2 ? 'Supplier profile added and credentials sent' : 'Supplier profile added; failed to send credentials email',
          code: 'PROFILE_ADDED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure password
    const password = generateSecurePassword();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: contact_person,
        supplier_name,
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile record (required for AuthContext)
    const { error: mainProfileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: contact_person,
        role: 'supplier',
        is_active: true,
      });

    if (mainProfileError) {
      console.error('Main profile creation error:', mainProfileError);
      // Attempt to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create main profile: ${mainProfileError.message}`);
    }

    console.log('Main profile created');

    // Create supplier profile
    const { error: profileError } = await supabase
      .from('supplier_profiles')
      .insert({
        user_id: authData.user.id,
        supplier_id,
        can_view_inventory: true,
        can_accept_orders: true,
        can_view_analytics: false,
      });

    if (profileError) {
      console.error('Supplier profile creation error:', profileError);
      // Attempt to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create supplier profile: ${profileError.message}`);
    }

    console.log('Supplier profile created');

    // Create user_roles entry for supplier role
    const { error: userRoleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'supplier',
        assigned_by: authData.user.id,
        is_active: true,
      });

    if (userRoleError) {
      console.error('User role creation error:', userRoleError);
      console.warn('Continuing without user_roles entry - supplier may have limited access');
    } else {
      console.log('Supplier role added to user_roles');
    }

    // Send credentials email
    const portalUrl = await getPortalUrl(supabase);
    
    let emailSent = false;
    try {
      const { error: emailError } = await supabase.functions.invoke('send-user-credentials', {
        body: {
          email,
          password,
          full_name: contact_person,
          roles: ['supplier'],
          portal_url: portalUrl,
          supplier_name,
        }
      });

      if (emailError) {
        console.error('Email sending error:', emailError);
        emailSent = false;
      } else {
        emailSent = true;
        console.log('Credentials email sent successfully');
      }
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
      emailSent = false;
    }

    // Verify the supplier account was created correctly
    const { data: verificationData } = await supabase
      .from('supplier_profiles')
      .select(`
        user_id,
        supplier_id,
        can_view_inventory,
        user_roles!inner(role, is_active)
      `)
      .eq('user_id', authData.user.id)
      .eq('supplier_id', supplier_id)
      .single();

    console.log('VERIFICATION - Supplier account created:', {
      user_id: authData.user.id,
      email: email,
      has_supplier_profile: !!verificationData,
      roles: verificationData?.user_roles
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user.id,
        email_sent: emailSent,
        message: emailSent 
          ? 'Supplier account created and credentials sent'
          : 'Supplier account created but failed to send credentials email'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in create-supplier-account:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        code: 'INTERNAL_ERROR'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
