import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const DEMO_EMAIL = 'umaridmpakistan@gmail.com';
    const DEMO_PASSWORD = 'admin123';
    
    console.log('Resetting demo user password...');

    // Get the user by email
    const { data: users, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Error fetching users:', getUserError);
      throw getUserError;
    }

    const demoUser = users.users.find(u => u.email === DEMO_EMAIL);
    
    if (!demoUser) {
      throw new Error(`Demo user with email ${DEMO_EMAIL} not found`);
    }

    console.log('Found demo user:', demoUser.id);

    // Reset password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      demoUser.id,
      { password: DEMO_PASSWORD }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    console.log('Password reset successful');

    // Ensure super_admin role exists in user_roles
    const { data: existingRole, error: roleCheckError } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', demoUser.id)
      .eq('role', 'super_admin')
      .single();

    if (roleCheckError && roleCheckError.code !== 'PGRST116') {
      console.error('Error checking roles:', roleCheckError);
    }

    if (!existingRole) {
      console.log('Adding super_admin role...');
      const { error: insertRoleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: demoUser.id,
          role: 'super_admin',
          is_active: true
        });

      if (insertRoleError) {
        console.error('Error inserting role:', insertRoleError);
        throw insertRoleError;
      }
      console.log('Super admin role added');
    } else {
      console.log('Super admin role already exists');
    }

    // Update profile to ensure super_admin role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', demoUser.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Demo user password reset to admin123 and super_admin role confirmed',
        user_id: demoUser.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in reset-demo-user function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
