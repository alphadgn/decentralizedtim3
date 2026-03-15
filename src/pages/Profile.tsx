import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  User, Mail, Clock, Shield, Save, Key, Bell, Monitor, Upload, Camera, ArrowLeft,
} from "lucide-react";

export default function Profile() {
  const { user, userId, role, loading, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: invoke profile-api with Privy token
  const invokeProfileApi = async (body: Record<string, unknown>) => {
    const token = await getAccessToken();
    const { data, error } = await supabase.functions.invoke("profile-api", {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  // Use edge function for profile data
  const { data: profile } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: () => invokeProfileApi({ action: "get_profile", userId }).then((d) => d?.profile),
    enabled: !!userId,
  });

  const { data: myNodes = [] } = useQuery({
    queryKey: ["profile-nodes", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("node_registrations")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: myKeys = [] } = useQuery({
    queryKey: ["profile-keys", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Preferences via edge function
  const { data: preferences } = useQuery({
    queryKey: ["user-preferences", userId],
    queryFn: () => invokeProfileApi({ action: "get_preferences", userId }).then((d) => d?.preferences),
    enabled: !!userId,
  });

  const [prefs, setPrefs] = useState({
    email_notifications: false,
    dashboard_auto_refresh: true,
    api_key_expiry_alerts: false,
  });

  useEffect(() => {
    if (preferences) {
      setPrefs({
        email_notifications: preferences.email_notifications,
        dashboard_auto_refresh: preferences.dashboard_auto_refresh,
        api_key_expiry_alerts: preferences.api_key_expiry_alerts,
      });
    }
  }, [preferences]);

  const togglePref = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!userId) throw new Error("Not authenticated");
      await invokeProfileApi({ action: "toggle_preference", userId, key, value });
      setPrefs((prev) => ({ ...prev, [key]: value }));
    },
    onSuccess: (_, { key, value }) => {
      queryClient.invalidateQueries({ queryKey: ["user-preferences"] });
      const label = key.replace(/_/g, " ");
      toast.success(`${label} ${value ? "enabled" : "disabled"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploading(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/profile-api`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Upload failed");

      setAvatarUrl(result.avatar_url);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile picture updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = useMutation({
    mutationFn: () => invokeProfileApi({ action: "update_profile", userId, display_name: displayName, avatar_url: avatarUrl || null }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  const email = (user as any)?.email?.address ?? (user as any)?.google?.email ?? (user as any)?.linkedAccounts?.find((a: any) => a.type === "google_oauth")?.email ?? "—";
  const SUPER_ADMIN_EMAIL = "a1cust0msenterprises@gmail.com";
  const SUPER_ADMIN_USER_ID = "a7069b27-a45c-4712-8a06-6c87a29bcfbf";
  const isSuperAdminAccount = (email !== "—" && email?.toLowerCase() === SUPER_ADMIN_EMAIL) || (userId === SUPER_ADMIN_USER_ID);
  const effectiveRole = isSuperAdminAccount ? "super_admin" : (role === "super_admin" ? "super_admin" : role);
  const joinDate = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—";
  const initials = (displayName || email)
    .split(/[@.\s]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join("");

  const prefItems = [
    { key: "email_notifications", icon: Bell, label: "Email Notifications", desc: "Receive alerts for honeypot hits, rate limit violations, and node drift warnings" },
    { key: "dashboard_auto_refresh", icon: Monitor, label: "Dashboard Auto-refresh", desc: "Automatically refresh dashboard data every 30 seconds" },
    { key: "api_key_expiry_alerts", icon: Key, label: "API Key Expiry Alerts", desc: "Get notified 7 days before API keys expire" },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Back to Dashboard */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Profile & Settings</h1>
          <p className="text-sm font-mono text-muted-foreground">Manage your account and preferences</p>
        </motion.div>

        {/* Profile Card */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
          <div className="flex items-start gap-5">
            <div className="relative group">
              <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50 flex items-center justify-center shrink-0 overflow-hidden">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-xl font-mono font-bold text-primary">{initials}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {uploading ? (
                  <Upload className="w-5 h-5 text-primary animate-pulse" />
                ) : (
                  <Camera className="w-5 h-5 text-primary" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Your display name"
                />
              </div>
              <button
                onClick={() => updateProfile.mutate()}
                disabled={updateProfile.isPending}
                className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {updateProfile.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Account Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-panel p-5">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Account Details</h2>
            <div className="space-y-3">
              {[
                { icon: Mail, label: "Email", value: email },
                { icon: Shield, label: "Role", value: effectiveRole === "super_admin" ? "Super Administrator" : effectiveRole === "admin" ? "Administrator" : effectiveRole || "User" },
                { icon: Clock, label: "Joined", value: joinDate },
                { icon: User, label: "User ID", value: userId?.slice(0, 8) + "..." },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground w-16">{item.label}</span>
                  <span className="text-xs font-mono text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Activity Summary</h2>
            <div className="space-y-3">
              {[
                { label: "Registered Nodes", value: myNodes.length.toString(), color: "neon-text-cyan" },
                { label: "Active Nodes", value: myNodes.filter((n) => n.status === "active").length.toString(), color: "neon-text-green" },
                { label: "API Keys", value: myKeys.length.toString(), color: "neon-text-cyan" },
                { label: "Active Keys", value: myKeys.filter((k) => !k.revoked_at).length.toString(), color: "neon-text-green" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass-panel p-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Preferences</h2>
          <div className="space-y-4">
            {prefItems.map((pref) => {
              const isOn = prefs[pref.key as keyof typeof prefs];
              return (
                <div key={pref.key} className="flex items-start gap-3">
                  <pref.icon className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-semibold text-foreground">{pref.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{pref.desc}</div>
                  </div>
                  <button
                    onClick={() => togglePref.mutate({ key: pref.key, value: !isOn })}
                    disabled={togglePref.isPending}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${isOn ? "bg-primary" : "bg-secondary"}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-foreground absolute top-0.5 transition-transform ${isOn ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
