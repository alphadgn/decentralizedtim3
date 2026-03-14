import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verify Privy JWT — lightweight check (issuer + expiry)
function getPrivyUserId(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));

    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    if (!payload.iss?.includes("privy.io")) return null;

    return payload.sub || null;
  } catch {
    return null;
  }
}

async function emailToUuid(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Privy token on ALL requests
  const privyUserId = getPrivyUserId(req);
  if (!privyUserId) {
    return new Response(JSON.stringify({ error: "Unauthorized — valid Privy token required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const contentType = req.headers.get("content-type") || "";

    // Handle multipart form data (avatar upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const userId = formData.get("userId") as string;

      if (!file || !userId) {
        return new Response(JSON.stringify({ error: "Missing file or userId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate file
      if (!file.type.startsWith("image/")) {
        return new Response(JSON.stringify({ error: "Only image files allowed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (file.size > 5 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "File must be under 5MB" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${userId}/avatar.${fileExt}`;
      const arrayBuffer = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const url = `${publicUrl}?t=${Date.now()}`;

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ avatar_url: url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle JSON requests
    const body = await req.json();
    const { action, userId, ...payload } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "get_preferences": {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ preferences: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "toggle_preference": {
        const { key, value } = payload;
        const allowedKeys = ["email_notifications", "dashboard_auto_refresh", "api_key_expiry_alerts"];
        if (!allowedKeys.includes(key)) {
          return new Response(JSON.stringify({ error: "Invalid preference key" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if preferences exist
        const { data: existing } = await supabase
          .from("user_preferences")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("user_preferences")
            .update({ [key]: value, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("user_preferences")
            .insert({ user_id: userId, [key]: value });
          if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_profile": {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return new Response(JSON.stringify({ profile: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_profile": {
        const { display_name, avatar_url } = payload;
        const { error } = await supabase
          .from("profiles")
          .update({ display_name, avatar_url: avatar_url || null })
          .eq("user_id", userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "generate_api_key": {
        const { name, expires_at } = payload;

        // Generate a cryptographically secure API key
        const rawBytes = new Uint8Array(32);
        crypto.getRandomValues(rawBytes);
        const rawKey = Array.from(rawBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const fullKey = `dgtn_live_${rawKey}`;
        const prefix = fullKey.slice(0, 12);

        // Hash the key for storage using SHA-256
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(fullKey));
        const keyHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const { data, error } = await supabase
          .from("api_keys")
          .insert({
            user_id: userId,
            name: name || "Default",
            key_hash: keyHash,
            key_prefix: prefix,
            expires_at: expires_at || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Return the full key ONCE — it cannot be retrieved again
        return new Response(JSON.stringify({
          key: fullKey,
          id: data.id,
          name: data.name,
          prefix: prefix,
          expires_at: data.expires_at,
          created_at: data.created_at,
          warning: "Store this key securely. It will not be shown again.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "revoke_api_key": {
        const { keyId } = payload;
        const { error } = await supabase
          .from("api_keys")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", keyId)
          .eq("user_id", userId);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e) {
    console.error("profile-api error:", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
