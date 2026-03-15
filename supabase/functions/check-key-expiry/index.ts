import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Find API keys expiring within 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: expiringKeys, error: keysError } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, user_id, expires_at, tier")
      .not("expires_at", "is", null)
      .is("revoked_at", null)
      .lte("expires_at", sevenDaysFromNow)
      .gte("expires_at", now);

    if (keysError) throw keysError;

    if (!expiringKeys || expiringKeys.length === 0) {
      return new Response(JSON.stringify({ message: "No expiring keys", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user IDs that have api_key_expiry_alerts enabled
    const userIds = [...new Set(expiringKeys.map((k) => k.user_id))];

    const { data: prefs } = await supabase
      .from("user_preferences")
      .select("user_id, api_key_expiry_alerts")
      .in("user_id", userIds)
      .eq("api_key_expiry_alerts", true);

    const alertEnabledUsers = new Set(prefs?.map((p) => p.user_id) ?? []);

    let alertsCreated = 0;

    for (const key of expiringKeys) {
      if (!alertEnabledUsers.has(key.user_id)) continue;

      const daysLeft = Math.ceil(
        (new Date(key.expires_at!).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      );

      // Check if we already created an alert for this key recently (deduplicate)
      const { data: existingAlert } = await supabase
        .from("security_alerts")
        .select("id")
        .eq("alert_type", "api_key_expiry")
        .eq("metadata->>key_id", key.id)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingAlert) continue;

      await supabase.from("security_alerts").insert({
        alert_type: "api_key_expiry",
        severity: daysLeft <= 1 ? "critical" : "warning",
        message: `API key "${key.name}" (${key.key_prefix}...) expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        metadata: { key_id: key.id, user_id: key.user_id, days_left: daysLeft, tier: key.tier },
      });

      alertsCreated++;
    }

    return new Response(
      JSON.stringify({
        message: "Expiry check complete",
        expiring_keys: expiringKeys.length,
        alerts_created: alertsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-key-expiry error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
