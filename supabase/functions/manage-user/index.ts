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
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const { action, userData } = await req.json()

    switch (action) {
      case 'create': {
        // Create user in auth
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password || Math.random().toString(36).slice(-12),
          email_confirm: true,
          user_metadata: {
            full_name: userData.full_name,
          },
        })

        if (createError) throw createError

        // Update profile
        const primaryRole = userData.roles[0]
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: userData.full_name,
            role: primaryRole,
          })
          .eq('id', authData.user.id)

        if (profileError) throw profileError

        // Add roles with outlet assignment if provided
        const roleRecords = userData.roles.map((role: string) => ({
          user_id: authData.user.id,
          role: role,
          assigned_by: user.id,
          is_active: true,
          outlet_id: userData.outlet_id || null,
        }))

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(roleRecords)

        if (rolesError) throw rolesError

        return new Response(
          JSON.stringify({ success: true, user: authData.user }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'update': {
        const { userId } = userData

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

        if (profileError) throw profileError

        // Update roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', userId)

        const roleRecords = userData.roles.map((role: string) => ({
          user_id: userId,
          role: role,
          assigned_by: user.id,
          is_active: true,
          outlet_id: userData.outlet_id || null,
        }))

        const { error: rolesError } = await supabaseAdmin
          .from('user_roles')
          .insert(roleRecords)

        if (rolesError) throw rolesError

        // Update auth email if changed
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single()

        if (profile && userData.email !== profile.email) {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: userData.email
          })
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'delete': {
        const { userId } = userData
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (error) throw error

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
