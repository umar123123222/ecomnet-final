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
  'senior_staff',
  'supplier',
  'finance'
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

    // Check if user has permission using security definer RPC functions
    const { data: isSuperAdmin } = await supabaseAdmin
      .rpc('is_super_admin', { _user_id: user.id })
    
    const { data: isManager } = await supabaseAdmin
      .rpc('is_manager', { _user_id: user.id })
    
    if (!isSuperAdmin && !isManager) {
      console.error('User lacks required permissions:', user.id);
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions to perform this action',
          details: 'Only super admins and managers can manage users'
        }),
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
        const inputRoles = Array.isArray(userData.roles) ? userData.roles : [userData.roles || 'staff']
        
        // ENFORCE SINGLE ROLE: Only take the first role
        const singleRole = inputRoles[0]
        
        console.log('Creating user:', email, 'with role:', singleRole);

        // Validate required fields
        if (!email || !full_name) {
          console.error('Missing required fields');
          return new Response(
            JSON.stringify({ error: 'Email and full name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate and normalize roles
        const { valid: roles, invalid: invalidRoles } = validateRoles([singleRole])
        
        if (invalidRoles.length > 0) {
          console.error('Invalid role:', invalidRoles);
          return new Response(
            JSON.stringify({ 
              error: `Invalid role: ${invalidRoles.join(', ')}`,
              validRoles: ALLOWED_ROLES 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (roles.length === 0) {
          console.error('No valid role provided');
          return new Response(
            JSON.stringify({ error: 'A valid role is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const role = roles[0] // Single role
        console.log('Validated role:', role);

        // Check if user already exists in profiles first (fastest check)
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('email', email)
          .maybeSingle()
        
        if (existingProfile) {
          // Fetch the user's role from user_roles table for more accurate info
          const { data: existingRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', existingProfile.id)
            .eq('is_active', true);
          
          const rolesList = existingRoles?.map(r => r.role) || [existingProfile.role];
          const rolesDisplay = rolesList.length > 0 ? rolesList.join(', ') : 'unknown';
          
          console.error('User with this email already exists in profiles:', {
            email,
            existingUserId: existingProfile.id,
            existingName: existingProfile.full_name,
            existingRoles: rolesList
          });
          
          return new Response(
            JSON.stringify({ 
              error: `User "${existingProfile.full_name || email}" already exists with role: ${rolesDisplay}`,
              existingUser: {
                id: existingProfile.id,
                email: existingProfile.email,
                full_name: existingProfile.full_name,
                roles: rolesList
              }
            }),
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
        const userPassword = userData.password || Math.random().toString(36).slice(-12);
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: userPassword,
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
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email,
            full_name,
            role: role,
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

        // Add role using upsert to handle potential race conditions
        const roleRecord = {
          user_id: authData.user.id,
          role: role,
          assigned_by: user.id,
          is_active: true,
        }

        console.log('🔵 CREATING ROLE FOR NEW USER:', {
          target_user_id: authData.user.id,
          target_email: email,
          role: role,
          assigned_by_user_id: user.id,
          assigned_by_email: user.email
        });

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .upsert(roleRecord, {
            onConflict: 'user_id,role',
            ignoreDuplicates: false
          })

        if (rolesError) {
          console.error('❌ Error upserting roles:', rolesError);
          throw rolesError;
        }
        
        // Verify role was assigned correctly
        const { data: verifyRole, error: verifyError } = await supabaseAdmin
          .from('user_roles')
          .select('user_id, role, is_active')
          .eq('user_id', authData.user.id)
          .eq('is_active', true)
          .maybeSingle();

        console.log('✅ ROLE CREATED - VERIFICATION:', {
          target_user_id: authData.user.id,
          target_email: email,
          assigned_role: verifyRole?.role,
          verification_passed: verifyRole?.role === role
        });

        if (verifyError) {
          console.warn('⚠️ Verification query error:', verifyError);
        }
        
        console.log('✅ User created successfully');
        
        // Wait for database transaction to commit (fixes race condition)
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Fetch complete user data
        const { data: newUserProfile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();
        
        // Fetch user roles separately
        const { data: userRolesData } = await supabaseAdmin
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', authData.user.id);

        if (fetchError || !newUserProfile) {
          console.error('Error fetching user profile:', fetchError);
          return new Response(
            JSON.stringify({ 
              error: 'User created but failed to fetch profile',
              details: fetchError?.message || 'Profile not found after creation'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Attach user_roles to the profile object
        const userWithRoles = {
          ...newUserProfile,
          user_roles: userRolesData || []
        };
        
        console.log('Fetched user profile with roles:', JSON.stringify(userWithRoles, null, 2));

        // Send credentials email
        let emailSent = false;
        let emailError = null;
        
        try {
          // Fetch portal URL from business settings
          const { data: portalUrlSetting } = await supabaseAdmin
            .from('api_settings')
            .select('setting_value')
            .eq('setting_key', 'portal_url')
            .maybeSingle();
          
          const portalUrl = portalUrlSetting?.setting_value || 'https://your-portal.com';
          
          console.log('Sending credentials email to:', email, 'with portal URL:', portalUrl);
          
          const emailResponse = await supabaseAdmin.functions.invoke('send-user-credentials', {
            body: {
              email: email,
              full_name: full_name,
              password: userPassword,
              roles: [role],
              portal_url: portalUrl,
            }
          });

          if (emailResponse.error) {
            throw emailResponse.error;
          }

          emailSent = true;
          console.log('Welcome email sent successfully to:', email);
        } catch (error: any) {
          emailError = error.message;
          console.error('Failed to send welcome email:', error);
          // Don't fail user creation if email fails
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: authData.user,
            profile: userWithRoles,
            emailSent,
            emailError,
            message: emailSent 
              ? 'User created successfully. Login credentials have been sent to their email.'
              : 'User created successfully, but email notification failed. Please provide credentials manually.'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        const { userId } = userData
        
        // Normalize and validate input
        const email = userData.email?.trim()
        const full_name = userData.full_name?.trim()
        const inputRoles = Array.isArray(userData.roles) ? userData.roles : [userData.roles || 'staff']
        
        // ENFORCE SINGLE ROLE: Only take the first role
        const singleRole = inputRoles[0]
        
        console.log('Updating user:', userId, 'with role:', singleRole);

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
        if (!email || !full_name) {
          console.error('Missing required fields for update');
          return new Response(
            JSON.stringify({ error: 'Email and full name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate and normalize roles
        const { valid: roles, invalid: invalidRoles } = validateRoles([singleRole])
        
        if (invalidRoles.length > 0) {
          console.error('Invalid role:', invalidRoles);
          return new Response(
            JSON.stringify({ 
              error: `Invalid role: ${invalidRoles.join(', ')}`,
              validRoles: ALLOWED_ROLES 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (roles.length === 0) {
          console.error('No valid role provided');
          return new Response(
            JSON.stringify({ error: 'A valid role is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const role = roles[0] // Single role
        console.log('Validated role:', role);

        // Fetch the old email to check if it's changing
        const { data: oldProfile, error: profileCheckError } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .maybeSingle();

        // If user doesn't exist, return 404
        if (profileCheckError || !oldProfile) {
          console.error('User not found:', userId, profileCheckError?.message);
          return new Response(
            JSON.stringify({ 
              error: 'User not found',
              details: 'No user exists with this ID'
            }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const oldEmail = oldProfile.email;

        // If email is changing, check for duplicates
        if (email !== oldEmail) {
          const { data: duplicateProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .neq('id', userId)
            .maybeSingle();
          
          if (duplicateProfile) {
            console.error('Email already in use by another user');
            return new Response(
              JSON.stringify({ 
                error: 'Email already in use',
                details: 'Another user is already registered with this email'
              }),
              { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Update auth email first if changed
        if (oldEmail && email !== oldEmail) {
          console.log('Updating auth email from', oldEmail, 'to', email);
          const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email
          })
          if (emailError) {
            console.error('Error updating auth email:', emailError);
            return new Response(
              JSON.stringify({ 
                error: 'Failed to update email in authentication system',
                details: emailError.message
              }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Update profile with single role
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name,
            email,
            role: role,
          })
          .eq('id', userId)

        if (profileError) {
          console.error('Error updating profile:', profileError);
          // Map specific error codes
          if (profileError.code === '42501') {
            return new Response(
              JSON.stringify({ 
                error: 'Insufficient permissions to modify user',
                details: 'You do not have permission to update this user profile'
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          throw profileError;
        }
        
        console.log('Profile updated');

        // Update role using upsert (single role per user)
        const roleRecord = {
          user_id: userId,
          role: role,
          assigned_by: user.id,
          is_active: true,
        }

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .upsert(roleRecord, {
            onConflict: 'user_id,role',
            ignoreDuplicates: false
          })

        if (rolesError) {
          console.error('Error upserting role:', rolesError);
          throw rolesError;
        }
        
        console.log('Role updated successfully');

        console.log('User updated successfully');
        
        // Fetch updated user data
        const { data: updatedUserProfile, error: fetchError } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        
        // Fetch user roles separately
        const { data: userRolesData } = await supabaseAdmin
          .from('user_roles')
          .select('role, is_active')
          .eq('user_id', userId);

        // Check if user was found
        if (fetchError || !updatedUserProfile) {
          console.error('Error fetching updated profile or user deleted:', fetchError);
          return new Response(
            JSON.stringify({ 
              error: 'Failed to fetch updated user',
              details: 'User may have been deleted during update'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Attach user_roles to the profile object
        const userWithRoles = {
          ...updatedUserProfile,
          user_roles: userRolesData || []
        };
        
        console.log('Fetched updated profile with roles:', JSON.stringify(userWithRoles, null, 2));

        return new Response(
          JSON.stringify({ 
            success: true,
            profile: userWithRoles
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
        
        // Get a system user ID to reassign records (use the first super_admin or a default)
        const { data: systemUser } = await supabaseAdmin
          .from('user_roles')
          .select('user_id')
          .eq('role', 'super_admin')
          .eq('is_active', true)
          .neq('user_id', userId)
          .limit(1)
          .single();
        
        const systemUserId = systemUser?.user_id || '00000000-0000-0000-0000-000000000000';
        console.log('Using system user for reassignment:', systemUserId);
        
        // Step 1: Reassign records that should be preserved (before deleting anything)
        console.log('Reassigning stock_movements...');
        await supabaseAdmin
          .from('stock_movements')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        
        console.log('Reassigning activity_logs...');
        await supabaseAdmin
          .from('activity_logs')
          .update({ user_id: systemUserId })
          .eq('user_id', userId);
        
        console.log('Reassigning cash_drawer_events...');
        await supabaseAdmin
          .from('cash_drawer_events')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        
        console.log('Reassigning goods_received_notes received_by...');
        await supabaseAdmin
          .from('goods_received_notes')
          .update({ received_by: systemUserId })
          .eq('received_by', userId);
        
        console.log('Reassigning goods_received_notes inspected_by...');
        await supabaseAdmin
          .from('goods_received_notes')
          .update({ inspected_by: systemUserId })
          .eq('inspected_by', userId);
        
        console.log('Reassigning dispatches.dispatched_by...');
        await supabaseAdmin
          .from('dispatches')
          .update({ dispatched_by: systemUserId })
          .eq('dispatched_by', userId);
        
        console.log('Reassigning courier_load_sheets.generated_by...');
        await supabaseAdmin
          .from('courier_load_sheets')
          .update({ generated_by: systemUserId })
          .eq('generated_by', userId);
        
        console.log('Reassigning courier_payment_uploads.uploaded_by...');
        await supabaseAdmin
          .from('courier_payment_uploads')
          .update({ uploaded_by: systemUserId })
          .eq('uploaded_by', userId);
        
        console.log('Reassigning automated_alerts...');
        await supabaseAdmin
          .from('automated_alerts')
          .update({ acknowledged_by: systemUserId })
          .eq('acknowledged_by', userId);
        await supabaseAdmin
          .from('automated_alerts')
          .update({ resolved_by: systemUserId })
          .eq('resolved_by', userId);
        
        console.log('Reassigning count_variances...');
        await supabaseAdmin
          .from('count_variances')
          .update({ assigned_to: systemUserId })
          .eq('assigned_to', userId);
        await supabaseAdmin
          .from('count_variances')
          .update({ resolved_by: systemUserId })
          .eq('resolved_by', userId);
        
        console.log('Reassigning auto_purchase_orders...');
        await supabaseAdmin
          .from('auto_purchase_orders')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        
        console.log('Reassigning conversations...');
        await supabaseAdmin
          .from('conversations')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        
        console.log('Reassigning label_print_logs...');
        await supabaseAdmin
          .from('label_print_logs')
          .update({ printed_by: systemUserId })
          .eq('printed_by', userId);
        
        console.log('Reassigning packaging_movements...');
        await supabaseAdmin
          .from('packaging_movements')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        
        console.log('Reassigning purchase_orders...');
        await supabaseAdmin
          .from('purchase_orders')
          .update({ created_by: systemUserId })
          .eq('created_by', userId);
        await supabaseAdmin
          .from('purchase_orders')
          .update({ approved_by: systemUserId })
          .eq('approved_by', userId);
        
        console.log('Reassigning returns...');
        await supabaseAdmin
          .from('returns')
          .update({ received_by: systemUserId })
          .eq('received_by', userId);
        
        console.log('Reassigning order_packaging...');
        await supabaseAdmin
          .from('order_packaging')
          .update({ selected_by: systemUserId })
          .eq('selected_by', userId);
        
        console.log('Reassigning stock_transfer_requests...');
        await supabaseAdmin
          .from('stock_transfer_requests')
          .update({ requested_by: systemUserId })
          .eq('requested_by', userId);
        await supabaseAdmin
          .from('stock_transfer_requests')
          .update({ approved_by: systemUserId })
          .eq('approved_by', userId);
        await supabaseAdmin
          .from('stock_transfer_requests')
          .update({ received_by: systemUserId })
          .eq('received_by', userId);
        
        // Step 2: Delete user-specific records that don't need to be kept
        console.log('Deleting notifications...');
        await supabaseAdmin
          .from('notifications')
          .delete()
          .eq('user_id', userId);
        
        console.log('Deleting outlet_staff...');
        await supabaseAdmin
          .from('outlet_staff')
          .delete()
          .eq('user_id', userId);
        
        console.log('Deleting supplier_profiles...');
        await supabaseAdmin
          .from('supplier_profiles')
          .delete()
          .eq('user_id', userId);
        
        console.log('Deleting user_performance...');
        await supabaseAdmin
          .from('user_performance')
          .delete()
          .eq('user_id', userId);
        
        // Step 3: Delete from user_roles
        console.log('Deleting user_roles for user:', userId);
        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId);
        
        if (rolesError) {
          console.error('Error deleting user_roles:', rolesError);
          // Continue anyway, auth user deletion might still work
        }
        
        // Step 4: Delete the auth user FIRST (this should cascade properly)
        console.log('Deleting auth user:', userId);
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (authError) {
          console.error('Error deleting auth user:', authError);
          
          // If auth user deletion fails, try to delete profile manually and retry
          console.log('Attempting to delete profile first and retry...');
          
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);
          
          if (profileError) {
            console.error('Error deleting profile:', profileError);
          }
          
          // Try deleting auth user again after profile is removed
          const { error: retryError } = await supabaseAdmin.auth.admin.deleteUser(userId);
          
          if (retryError) {
            console.error('Retry error deleting auth user:', retryError);
            // User data is partially cleaned up, profile might be gone
            // Return success if profile was deleted since that's the main goal
            return new Response(
              JSON.stringify({ 
                success: true, 
                warning: 'Auth user deletion failed but profile and related data were cleaned up. The auth user may need manual cleanup.',
                error: retryError.message 
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // Auth user deleted successfully, now delete profile if it still exists
          console.log('Auth user deleted, cleaning up profile...');
          await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);
        }

        console.log('User deleted successfully');
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'suspend': {
        const { userId, suspend } = userData;
        
        console.log(`${suspend ? 'Suspending' : 'Unsuspending'} user:`, userId);
        
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required for suspend action' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Update the profile's is_active field
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ is_active: !suspend })
          .eq('id', userId);
        
        if (updateError) {
          console.error('Error updating user status:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update user status: ' + updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        console.log(`User ${suspend ? 'suspended' : 'unsuspended'} successfully`);
        return new Response(
          JSON.stringify({ success: true, suspended: suspend }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
