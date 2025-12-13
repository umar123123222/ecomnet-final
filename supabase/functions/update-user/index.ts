import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = [
  'super_admin',
  'super_manager', 
  'warehouse_manager',
  'store_manager',
  'dispatch_manager',
  'returns_manager',
  'staff',
  'supplier',
  'finance'
] as const;

type AllowedRole = typeof ALLOWED_ROLES[number];

function normalizeRole(role: string): AllowedRole | null {
  const r = role.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return (ALLOWED_ROLES as readonly string[]).includes(r) ? (r as AllowedRole) : null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Service configuration is missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission checks
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
    const { data: isManager } = await supabase.rpc('is_manager', { _user_id: user.id });
    if (!isSuperAdmin && !isManager) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions to perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { userId, email: inputEmail, full_name: inputFullName, roles: inputRoles } = body ?? {};

    // Validate payload - single role required
    if (!Array.isArray(inputRoles) || inputRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'A role is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const singleRole = inputRoles[0]; // Only take first role
    const email = inputEmail?.trim();
    const full_name = inputFullName?.trim();

    // Resolve target user by ID or email
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let targetUserId: string | null = (typeof userId === 'string' && uuidRegex.test(userId)) ? userId : null;

    if (!targetUserId) {
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'User ID or email is required to update roles' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const { data: matches, error: matchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .limit(2);
      if (matchError) throw matchError;
      if (!matches || matches.length === 0) {
        return new Response(
          JSON.stringify({ error: 'User not found', details: 'No user exists with this email' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (matches.length > 1) {
        return new Response(
          JSON.stringify({ error: 'Multiple users found for this email', details: 'Please target by user ID' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      targetUserId = matches[0].id;
    }

    console.log('Target user resolved:', { targetUserId, email });

    // Fetch old profile
    const { data: oldProfile, error: oldProfileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    if (oldProfileError || !oldProfile) {
      return new Response(
        JSON.stringify({ error: 'User not found', details: 'No user exists with this ID' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize and validate roles
    const roles = Array.from(new Set([singleRole]))
      .map(normalizeRole)
      .filter((r): r is AllowedRole => !!r);
    if (roles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'A valid role is required', validRoles: ALLOWED_ROLES }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const role = roles[0]; // Single role

    // Update profile primary role (do not change email/full_name here unless provided)
    const profileUpdate: Record<string, any> = { role: role };
    if (typeof full_name === 'string' && full_name.length > 0) profileUpdate.full_name = full_name;
    if (typeof email === 'string' && email.length > 0 && email !== oldProfile.email) {
      // Check duplicate email
      const { data: dup, error: dupErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .neq('id', targetUserId)
        .limit(1);
      if (dupErr) throw dupErr;
      if (dup && dup.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Email already in use', details: 'Another user is already registered with this email' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Update auth email first
      const { error: emailError } = await supabase.auth.admin.updateUserById(targetUserId, { email });
      if (emailError) {
        return new Response(
          JSON.stringify({ error: 'Failed to update email in authentication system', details: emailError.message }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      profileUpdate.email = email;
    }

    console.log('Updating profile for user:', targetUserId, profileUpdate);

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', targetUserId);
    if (profileError) throw profileError;

    // Fetch target user email for logging
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', targetUserId)
      .single();

    console.log('🔵 UPDATING ROLE FOR USER:', {
      target_user_id: targetUserId,
      target_email: targetProfile?.email || 'unknown',
      new_role: role,
      updated_by_user_id: user.id,
      updated_by_email: user.email
    });

    // Upsert the single role
    const roleRecord = {
      user_id: targetUserId as string,
      role,
      assigned_by: user.id,
      is_active: true,
    };
    
    console.log(`🔸 Upserting role for user ${targetUserId}:`, role);
    
    const { error: rolesError } = await supabase
      .from('user_roles')
      .upsert(roleRecord, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      });
    if (rolesError) {
      console.error('❌ Error upserting role:', rolesError);
      throw rolesError;
    }

    // Verify role was updated correctly
    const { data: verifyRole, error: verifyError } = await supabase
      .from('user_roles')
      .select('user_id, role, is_active')
      .eq('user_id', targetUserId)
      .eq('is_active', true)
      .maybeSingle();

    console.log('✅ ROLE UPDATED - VERIFICATION:', {
      target_user_id: targetUserId,
      target_email: targetProfile?.email || 'unknown',
      assigned_role: verifyRole?.role,
      verification_passed: verifyRole?.role === role
    });

    if (verifyError) {
      console.warn('⚠️ Verification query error:', verifyError);
    }

    // Fetch updated profile with roles
    const { data: updatedUserProfile, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at,
        user_roles (
          role,
          is_active
        )
      `)
      .eq('id', targetUserId)
      .maybeSingle();
    if (fetchError || !updatedUserProfile) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch updated user', details: fetchError?.message || null }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated user:', targetUserId);

    return new Response(
      JSON.stringify({ success: true, profile: updatedUserProfile }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('update-user error:', error);
    let errorMessage = error?.message || 'An unexpected error occurred';
    let statusCode = 500;
    if (error?.code === '23505') { statusCode = 409; errorMessage = 'Duplicate entry'; }
    else if (error?.code === '42501') { statusCode = 403; errorMessage = 'Insufficient permissions'; }
    else if (error?.code?.startsWith?.('23')) { statusCode = 422; errorMessage = 'Database constraint violation'; }

    return new Response(
      JSON.stringify({ error: errorMessage, details: error?.details || error?.hint || null }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});