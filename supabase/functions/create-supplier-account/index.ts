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
      
      // Check if supplier profile exists
      const { data: existingProfile } = await supabase
        .from('supplier_profiles')
        .select('user_id')
        .eq('supplier_id', supplier_id)
        .single();

      if (existingProfile) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Supplier already has portal access',
            code: 'ACCOUNT_EXISTS'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      throw new Error('Email already in use by another account');
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
      console.error('Profile creation error:', profileError);
      // Attempt to delete the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create supplier profile: ${profileError.message}`);
    }

    console.log('Supplier profile created');

    // Send credentials email
    let emailSent = false;
    try {
      const { error: emailError } = await supabase.functions.invoke('send-user-credentials', {
        body: {
          email,
          password,
          full_name: contact_person,
          role: 'supplier',
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
