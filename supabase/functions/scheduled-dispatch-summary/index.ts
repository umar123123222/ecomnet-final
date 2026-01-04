import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";
import { getLocaleSettings, getTodayDateString } from "../_shared/locale.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting scheduled dispatch summary email job...");

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get locale settings from database for dynamic timezone
    const localeSettings = await getLocaleSettings(supabase);
    console.log(`Using timezone: ${localeSettings.timezone} (UTC+${localeSettings.timezoneOffset})`);

    // Get today's date in company timezone
    const todayStr = getTodayDateString(localeSettings.timezoneOffset);

    console.log(`Fetching dispatch summary for date: ${todayStr}`);

    // Fetch today's dispatch summary from the daily_dispatch_summaries table
    const { data: summary, error: summaryError } = await supabase
      .from('daily_dispatch_summaries')
      .select('*')
      .eq('summary_date', todayStr)
      .single();

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error("Error fetching dispatch summary:", summaryError);
      throw summaryError;
    }

    if (!summary) {
      console.log("No dispatch summary found for today, checking if there were any dispatches...");
      
      // Check if there were any dispatches today
      const startOfDay = `${todayStr}T00:00:00+05:00`;
      const endOfDay = `${todayStr}T23:59:59+05:00`;
      
      const { count: dispatchCount } = await supabase
        .from('dispatches')
        .select('*', { count: 'exact', head: true })
        .gte('dispatch_date', startOfDay)
        .lte('dispatch_date', endOfDay);

      if (!dispatchCount || dispatchCount === 0) {
        console.log("No dispatches today, skipping email");
        return new Response(
          JSON.stringify({ success: true, message: "No dispatches today, email skipped" }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // If there were dispatches but no summary, create a minimal one
      console.log("Dispatches found but no summary, creating minimal summary...");
    }

    const summaryData = {
      summary_date: todayStr,
      product_items: summary?.product_items || {},
      packaging_items: summary?.packaging_items || {},
      total_product_units: summary?.total_product_units || 0,
      total_packaging_units: summary?.total_packaging_units || 0,
      unique_products: summary?.unique_products || 0,
      unique_packaging: summary?.unique_packaging || 0,
      order_count: summary?.order_count || 0,
    };

    // Only send email if there were actual dispatches
    if (summaryData.order_count === 0 && summaryData.total_product_units === 0) {
      console.log("No actual dispatches in summary, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "No dispatches to report, email skipped" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending dispatch summary email: ${summaryData.order_count} orders, ${summaryData.total_product_units} units`);

    // Call the send-dispatch-summary-email function
    const { data: emailResult, error: emailError } = await supabase.functions.invoke(
      'send-dispatch-summary-email',
      { body: summaryData }
    );

    if (emailError) {
      console.error("Error sending dispatch summary email:", emailError);
      throw emailError;
    }

    console.log("Dispatch summary email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Dispatch summary email sent successfully",
        summary: {
          date: todayStr,
          orders: summaryData.order_count,
          products: summaryData.unique_products,
          units: summaryData.total_product_units
        },
        emailResult
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in scheduled dispatch summary:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
