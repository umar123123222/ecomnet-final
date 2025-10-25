import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Allowed roles in the system
const ALLOWED_ROLES = [
  'super_admin',
  'super_manager', 
  'warehouse_manager',
  'store_manager',
  'dispatch_manager',
  'returns_manager',
  'staff',
  'supplier'
] as const

// Normalize role string to match database enum
function normalizeRole(role: string): string {
  return role
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
}

// Validate and normalize roles
function validateRoles(roles: string[]): { valid: string[], invalid: string[] } {
  const valid: string[] = []
  const invalid: string[] = []
  
  for (const role of roles) {
    const normalized = normalizeRole(role)
    if (ALLOWED_ROLES.includes(normalized as any)) {
      if (!valid.includes(normalized)) {
        valid.push(normalized)
      }
    } else {
      invalid.push(role)
    }
  }
  
  return { valid, invalid }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Manage user function called');
    
    // Verify environment configuration
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment configuration:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!supabaseServiceKey 
      });
      return new Response(
        JSON.stringify({ error: 'Service configuration is missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
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
        // Normalize and validate input
        const email = userData.email?.trim()
        const full_name = userData.full_name?.trim()
        const roles = Array.from(new Set(userData.roles || [])) // Deduplicate
        
        console.log('Creating user:', email);

        // Validate required fields
        if (!email || !full_name || roles.length === 0) {
          console.error('Missing required fields');
          return new Response(
            JSON.stringify({ error: 'Email, full name, and at least one role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if user already exists in profiles first (fastest check)
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle()
        
        if (existingProfile) {
          console.error('User with this email already exists in profiles');
          return new Response(
            JSON.stringify({ error: 'A user with this email already exists' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Fallback: Check auth.users
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const userExists = existingUsers?.users?.some(u => u.email === email)
        
        if (userExists) {
          console.error('User with this email already exists in auth');
          return new Response(
            JSON.stringify({ error: 'A user with this email already exists' }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Create user in auth
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: userData.password || Math.random().toString(36).slice(-12),
          email_confirm: true,
          user_metadata: {
            full_name,
          },
        })

        if (createError) {
          console.error('Error creating user:', createError);
          // Handle specific auth errors
          if (createError.message?.includes('already registered') || createError.message?.includes('email_exists')) {
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

        // Upsert profile to prevent race conditions with the auth trigger
        const primaryRole = roles[0]
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email,
            full_name,
            role: primaryRole,
            is_active: true
          }, { 
            onConflict: 'id',
            ignoreDuplicates: false 
          })

        if (profileError) {
          console.error('Error upserting profile:', profileError);
          // Try to clean up the created auth user
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
          return new Response(
            JSON.stringify({ error: 'Failed to create user profile', details: profileError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        console.log('Profile upserted successfully');

        // Add roles (deduplicated)
        const roleRecords = roles.map((role: string) => ({
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
          // Check for duplicate role errors
          if (rolesError.code === '23505') {
            console.warn('Duplicate role detected, continuing...');
          } else {
            throw rolesError;
          }
        }
        
        console.log('User created successfully');
        
        // Fetch complete user data with roles
        const { data: newUserProfile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            is_active,
            created_at,
            updated_at,
            user_roles!inner (
              role,
              is_active
            )
          `)
          .eq('id', authData.user.id)
          .single()
        
        if (fetchError) {
          console.error('Error fetching user profile:', fetchError);
          throw fetchError;
        }
        
        console.log('Fetched user profile with roles:', JSON.stringify(newUserProfile, null, 2));

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
        
        // Normalize and validate input
        const email = userData.email?.trim()
        const full_name = userData.full_name?.trim()
        const roles = Array.from(new Set(userData.roles || [])) // Deduplicate
        
        console.log('Updating user:', userId);

        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!userId || !uuidRegex.test(userId)) {
          console.error('Invalid userId format');
          return new Response(
            JSON.stringify({ error: 'Invalid user ID format' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate required fields
        if (!email || !full_name || roles.length === 0) {
          console.error('Missing required fields for update');
          return new Response(
            JSON.stringify({ error: 'Email, full name, and at least one role are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Update profile
        const primaryRole = roles[0]
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name,
            email,
            role: primaryRole,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Map specific error codes
          if (profileError.code === '42501') {
            return new Response(
              JSON.stringify({ error: 'Insufficient permissions to modify user' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw profileError;
        }
        
        console.log('Profile updated');

        // Update roles (delete all, then insert new - idempotent)
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)

        const roleRecords = roles.map((role: string) => ({
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
          // Map specific error codes
          if (rolesError.code === '23505') {
            return new Response(
              JSON.stringify({ error: 'One or more roles are already assigned to this user' }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
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
        const { data: updatedUserProfile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select(`
            id,
            email,
            full_name,
            role,
            is_active,
            created_at,
            updated_at,
            user_roles!inner (
              role,
              is_active
            )
          `)
          .eq('id', userId)
          .single()
        
        if (fetchError) {
          console.error('Error fetching updated profile:', fetchError);
          throw fetchError;
        }
        
        console.log('Fetched updated profile with roles:', JSON.stringify(updatedUserProfile, null, 2));

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
    
    // Map database errors to friendly messages
    let errorMessage = error?.message || 'An unexpected error occurred'
    let statusCode = 500
    
    // PostgreSQL error codes
    if (error?.code === '23505') {
      errorMessage = 'Duplicate entry: this record already exists'
      statusCode = 409
    } else if (error?.code === '42501') {
      errorMessage = 'Insufficient permissions to perform this action'
      statusCode = 403
    } else if (error?.code?.startsWith('23')) {
      // Other integrity constraint violations
      errorMessage = 'Database constraint violation: ' + (error?.message || 'invalid data')
      statusCode = 422
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.details || error?.hint || null
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
