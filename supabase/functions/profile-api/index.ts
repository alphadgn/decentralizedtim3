import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyPrivyJWT, verifyPrivyTokenLightweight, extractBearerToken, emailToUuid } from "../_shared/verify-privy-jwt.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; privySub: string | null }> {
  const token = extractBearerToken(req);
  if (!token) return { authenticated: false, privySub: null };

  const payload = await verifyPrivyJWT(token);
  if (payload) return { authenticated: true, privySub: payload.sub };

  const lightweight = verifyPrivyTokenLightweight(token);
  return { authenticated: lightweight.valid, privySub: lightweight.sub };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate Privy token on ALL requests
  const { authenticated, privySub } = await authenticateRequest(req);
  if (!authenticated) {
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

      // Validate file type (whitelist approach)
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        return new Response(JSON.stringify({ error: "Only JPEG, PNG, GIF, or WebP images allowed" }), {
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

      // Sanitize file extension
      const allowedExts = ["jpg", "jpeg", "png", "gif", "webp"];
      const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = allowedExts.includes(fileExt) ? fileExt : "jpg";
      const filePath = `${userId}/avatar.${safeExt}`;
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

    if (!userId || typeof userId !== "string" || userId.length > 100) {
      return new Response(JSON.stringify({ error: "Invalid userId" }), {
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

        if (typeof value !== "boolean") {
          return new Response(JSON.stringify({ error: "Value must be boolean" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
        // Input validation
        if (display_name && (typeof display_name !== "string" || display_name.length > 100)) {
          return new Response(JSON.stringify({ error: "Invalid display name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

        // Validate name
        const keyName = (typeof name === "string" && name.length <= 50) ? name : "Default";

        // Validate expires_at
        if (expires_at) {
          const expDate = new Date(expires_at);
          if (isNaN(expDate.getTime()) || expDate <= new Date()) {
            return new Response(JSON.stringify({ error: "Expiration must be in the future" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Generate a cryptographically secure API key
        const rawBytes = new Uint8Array(32);
        crypto.getRandomValues(rawBytes);
        const rawKey = Array.from(rawBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const fullKey = `dgtn_live_${rawKey}`;
        const prefix = fullKey.slice(0, 12);

        // Hash the key for storage using SHA-256
        const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fullKey));
        const keyHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const { data, error } = await supabase
          .from("api_keys")
          .insert({
            user_id: userId,
            name: keyName,
            key_hash: keyHash,
            key_prefix: prefix,
            expires_at: expires_at || null,
          })
          .select()
          .single();

        if (error) throw error;

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
        if (!keyId || typeof keyId !== "string") {
          return new Response(JSON.stringify({ error: "Invalid keyId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
