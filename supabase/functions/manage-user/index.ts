import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Manage user function called');
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verify the requesting user is authenticated and has permissions
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User authenticated:', user.id);

    // Check if user has permission (super_admin, super_manager, or store_manager)
    const allowedRoles = ['super_admin', 'super_manager', 'store_manager']

    // Prefer checking roles from user_roles; fall back to profile.role for backward compatibility
    const { data: rolesData } = await supabaseAdmin
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const effectiveRoles = [
      ...(rolesData?.map((r: any) => r.role) ?? []),
      profile?.role,
    ].filter(Boolean)

    const hasPermission = effectiveRoles.some((r: string) => allowedRoles.includes(r))
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestBody = await req.json()
    const { action, userData } = requestBody

    // Validate request payload
    if (!action || !userData) {
      console.error('Invalid request payload');
      return new Response(
        JSON.stringify({ error: 'Invalid request: action and userData are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Action:', action, 'UserData:', { ...userData, password: '***' });

    switch (action) {
      case 'create': {
        console.log('Creating user:', userData.email);

        // Validate required fields
        if (!userData.email || !userData.roles || userData.roles.length === 0) {
          console.error('Missing required fields');
          return new Response(
            JSON.stringify({ error: 'Email and at least one role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const userExists = existingUsers?.users?.some(u => u.email === userData.email)
        
        if (userExists) {
          console.error('User with this email already exists');
          return new Response(
            JSON.stringify({ error: 'A user with this email already exists' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create user in auth
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password || Math.random().toString(36).slice(-12),
          email_confirm: true,
          user_metadata: {
            full_name: userData.full_name,
          },
        })

        if (createError) {
          console.error('Error creating user:', createError);
          // Handle specific auth errors
          if (createError.message?.includes('already registered')) {
            return new Response(
              JSON.stringify({ error: 'A user with this email already exists' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          return new Response(
            JSON.stringify({ error: createError.message || 'Failed to create user' }),
            { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('User created in auth:', authData.user.id);

        // Update profile
        const primaryRole = userData.roles[0]
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: userData.full_name,
            role: primaryRole,
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw profileError;
        }
        
        console.log('Profile updated successfully');

        // Add roles
        const roleRecords = userData.roles.map((role: string) => ({
          user_id: authData.user.id,
          role: role,
          assigned_by: user.id,
          is_active: true,
        }))

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(roleRecords)

        if (rolesError) {
          console.error('Error inserting roles:', rolesError);
          throw rolesError;
        }
        
        console.log('User created successfully');
        
        // Fetch complete user data with roles
        const { data: newUserProfile } = await supabaseAdmin
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            user_roles (
              role,
              is_active
            )
          `)
          .eq('id', authData.user.id)
          .single()

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: authData.user,
            profile: newUserProfile 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        const { userId } = userData
        console.log('Updating user:', userId);

        // Validate required fields
        if (!userId || !userData.roles || userData.roles.length === 0) {
          console.error('Missing required fields for update');
          return new Response(
            JSON.stringify({ error: 'User ID and at least one role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update profile
        const primaryRole = userData.roles[0]
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: userData.full_name,
            email: userData.email,
            role: primaryRole,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw profileError;
        }
        
        console.log('Profile updated');

        // Update roles
        const { error: deleteRolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          
        if (deleteRolesError) {
          console.error('Error deleting old roles:', deleteRolesError);
        }

        const roleRecords = userData.roles.map((role: string) => ({
          user_id: userId,
          role: role,
          assigned_by: user.id,
          is_active: true,
        }))

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(roleRecords)

        if (rolesError) {
          console.error('Error inserting new roles:', rolesError);
          throw rolesError;
        }
        
        console.log('Roles updated successfully');

        // Update auth email if changed
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single()

        if (profile && userData.email !== profile.email) {
          console.log('Updating auth email');
          const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: userData.email
          })
          if (emailError) {
            console.error('Error updating email:', emailError);
          }
        }

        console.log('User updated successfully');
        
        // Fetch updated user data with roles
        const { data: updatedUserProfile } = await supabaseAdmin
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            user_roles (
              role,
              is_active
            )
          `)
          .eq('id', userId)
          .single()

        return new Response(
          JSON.stringify({ 
            success: true,
            profile: updatedUserProfile
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        const { userId } = userData
        console.log('Deleting user:', userId);

        // Validate required field
        if (!userId) {
          console.error('Missing userId for delete');
          return new Response(
            JSON.stringify({ error: 'User ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) {
          console.error('Error deleting user:', error);
          return new Response(
            JSON.stringify({ error: error.message || 'Failed to delete user' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        console.log('User deleted successfully');
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in manage-user function:', error);
    
    // Handle different error types
    const errorMessage = error?.message || 'An unexpected error occurred'
    const statusCode = error?.status || 500
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.details || null
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
