import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManageOutletStaffRequest {
  action: 'assign' | 'toggle_pos_access' | 'remove' | 'list';
  outlet_id?: string;
  user_id?: string;
  can_access_pos?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, outlet_id, user_id, can_access_pos }: ManageOutletStaffRequest = await req.json();

    console.log('Managing outlet staff:', { action, outlet_id, user_id, can_access_pos, requesting_user: user.id });

    // Check if requesting user has permission to manage this outlet
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('is_active', true);

    const isSuperAdmin = userRoles?.some(r => r.role === 'super_admin' || r.role === 'super_manager');

    if (!isSuperAdmin && outlet_id) {
      // Check if user is the manager of this outlet
      const { data: outlet } = await supabase
        .from('outlets')
        .select('manager_id')
        .eq('id', outlet_id)
        .single();

      if (!outlet || outlet.manager_id !== user.id) {
        throw new Error('You do not have permission to manage staff for this outlet');
      }
    }

    let result;

    switch (action) {
      case 'list':
        if (!outlet_id) {
          throw new Error('outlet_id is required for list action');
        }

        const { data: staffList, error: listError } = await supabase
          .from('outlet_staff')
          .select(`
            id,
            user_id,
            can_access_pos,
            created_at,
            updated_at,
            profiles!outlet_staff_user_id_fkey (
              id,
              email,
              full_name,
              role
            )
          `)
          .eq('outlet_id', outlet_id);

        if (listError) throw listError;
        result = { staff: staffList };
        break;

      case 'assign':
        if (!outlet_id || !user_id) {
          throw new Error('outlet_id and user_id are required for assign action');
        }

        const { data: assigned, error: assignError } = await supabase
          .from('outlet_staff')
          .insert({
            outlet_id,
            user_id,
            can_access_pos: can_access_pos ?? false,
            assigned_by: user.id,
          })
          .select()
          .single();

        if (assignError) {
          if (assignError.code === '23505') {
            throw new Error('Staff member is already assigned to this outlet');
          }
          throw assignError;
        }

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'outlet_staff_assigned',
          entity_type: 'outlet_staff',
          entity_id: assigned.id,
          details: {
            outlet_id,
            assigned_user_id: user_id,
            can_access_pos: can_access_pos ?? false,
          },
        });

        result = { success: true, assignment: assigned };
        break;

      case 'toggle_pos_access':
        if (!outlet_id || !user_id || can_access_pos === undefined) {
          throw new Error('outlet_id, user_id, and can_access_pos are required for toggle action');
        }

        const { data: toggled, error: toggleError } = await supabase
          .from('outlet_staff')
          .update({ can_access_pos })
          .eq('outlet_id', outlet_id)
          .eq('user_id', user_id)
          .select()
          .single();

        if (toggleError) throw toggleError;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'pos_access_toggled',
          entity_type: 'outlet_staff',
          entity_id: toggled.id,
          details: {
            outlet_id,
            target_user_id: user_id,
            can_access_pos,
          },
        });

        result = { success: true, assignment: toggled };
        break;

      case 'remove':
        if (!outlet_id || !user_id) {
          throw new Error('outlet_id and user_id are required for remove action');
        }

        const { data: removed, error: removeError } = await supabase
          .from('outlet_staff')
          .delete()
          .eq('outlet_id', outlet_id)
          .eq('user_id', user_id)
          .select()
          .single();

        if (removeError) throw removeError;

        // Log activity
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          action: 'outlet_staff_removed',
          entity_type: 'outlet_staff',
          entity_id: removed.id,
          details: {
            outlet_id,
            removed_user_id: user_id,
          },
        });

        result = { success: true };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error managing outlet staff:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
