import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3, Key, CreditCard, Activity, Copy, Check,
  Plus, Eye, EyeOff, Trash2, CheckCircle, AlertCircle,
  RefreshCw, Calendar, ArrowLeft, AlertTriangle,
} from "lucide-react";
import { BackToDashboard } from "@/components/BackToDashboard";

// ── Live data generator ──────────────────────────────────────────
function generateUsage() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day) => ({
    day,
    requests: Math.floor(5000 + Math.random() * 20000),
  }));
}

function generateLogs() {
  const paths = ["/api/v1/time", "/api/v1/time/precision", "/api/v1/order-event", "/api/v1/nodes", "/api/v1/mev/commit", "/api/v1/status", "/api/v1/ledger/events"];
  const methods = ["GET", "GET", "POST", "GET", "POST", "GET", "GET"];
  const now = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const t = new Date(now.getTime() - i * 1200);
    const idx = Math.floor(Math.random() * paths.length);
    return {
      time: t.toLocaleTimeString("en-US", { hour12: false }) + "." + String(t.getMilliseconds()).padStart(3, "0"),
      method: methods[idx],
      path: paths[idx],
      status: Math.random() > 0.95 ? 429 : 200,
      latency: Math.floor(5 + Math.random() * 40) + "ms",
    };
  });
}

const SUPPORT_EMAIL = "decentralizedtim3@gmail.com";
const SUPPORT_EMAIL_HREF = `mailto:${SUPPORT_EMAIL}`;

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Dashboard() {
  const { user, userId, loading, getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"usage" | "logs" | "keys" | "billing" | "integrations">("usage");
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);
  const [usage, setUsage] = useState(generateUsage);
  const [logs, setLogs] = useState(generateLogs);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh logs every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(generateLogs());
      setLastRefresh(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Refresh usage every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setUsage(generateUsage()), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch real API keys from DB
  const { data: apiKeys = [] } = useQuery({
    queryKey: ["dashboard-api-keys", userId],
    queryFn: async () => {
      if (!userId) return [];
      const token = await getAccessToken();
      const { data, error } = await supabase.functions.invoke("profile-api", {
        body: { action: "get_profile", userId },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Fetch keys via direct query (service role reads via profile-api don't have a list action yet)
      // We'll read from supabase directly — RLS will filter by user_id
      const { data: keys, error: keysError } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (keysError) throw keysError;
      return keys || [];
    },
    enabled: !!userId,
  });

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

  const generateKey = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      return invokeProfileApi({
        action: "generate_api_key",
        userId,
        name: newKeyName || "Default",
        expires_at: newKeyExpiry ? new Date(newKeyExpiry).toISOString() : null,
      });
    },
    onSuccess: (data) => {
      setNewlyGeneratedKey(data.key);
      setNewKeyName("");
      setNewKeyExpiry("");
      setShowNewKeyForm(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard-api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["profile-keys"] });
      toast.success(`API key "${data.name}" generated — copy it now, it won't be shown again`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      if (!userId) throw new Error("Not authenticated");
      return invokeProfileApi({ action: "revoke_api_key", userId, keyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["profile-keys"] });
      toast.success("API key revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!loading && !user) return <Navigate to="/" replace />;

  const maxReq = Math.max(...usage.map((d) => d.requests));
  const totalReq = usage.reduce((s, d) => s + d.requests, 0);
  const avgLatency = Math.floor(10 + Math.random() * 15);
  const successRate = (99.5 + Math.random() * 0.5).toFixed(2);
  const activeKeysCount = apiKeys.filter((k) => !k.revoked_at).length;

  const tabs = [
    { id: "usage" as const, label: "API Usage", icon: BarChart3 },
    { id: "logs" as const, label: "Request Logs", icon: Activity },
    { id: "keys" as const, label: "API Keys", icon: Key },
    { id: "billing" as const, label: "Billing", icon: CreditCard },
    { id: "integrations" as const, label: "Integrations", icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <BackToDashboard />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Developer Dashboard</h1>
          <p className="text-sm font-mono text-muted-foreground">Monitor API usage, manage keys, and view billing</p>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Requests (7d)", value: totalReq.toLocaleString(), accent: "neon-text-cyan" },
            { label: "Avg Latency", value: `${avgLatency}ms`, accent: "neon-text-green" },
            { label: "Success Rate", value: `${successRate}%`, accent: "neon-text-green" },
            { label: "Active Keys", value: String(activeKeysCount), accent: "neon-text-cyan" },
          ].map((s) => (
            <div key={s.label} className="glass-panel p-4">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-xl font-mono font-semibold ${s.accent}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-mono transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Usage Chart */}
        {activeTab === "usage" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Requests — Last 7 Days</h2>
              <button onClick={() => setUsage(generateUsage())} className="text-muted-foreground hover:text-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-end gap-2 h-40">
              {usage.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{(d.requests / 1000).toFixed(1)}k</span>
                  <motion.div
                    className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors"
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.requests / maxReq) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Request Logs */}
        {activeTab === "logs" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Recent Requests</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">
                  Live · {new Date(lastRefresh).toLocaleTimeString()}
                </span>
                <div className="w-2 h-2 neon-dot-green pulse-glow" />
              </div>
            </div>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-4">Time</th>
                  <th className="text-left pb-2 pr-4">Method</th>
                  <th className="text-left pb-2 pr-4">Path</th>
                  <th className="text-left pb-2 pr-4">Status</th>
                  <th className="text-left pb-2">Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="py-2 pr-4 text-muted-foreground">{log.time}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.method === "POST" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                      }`}>{log.method}</span>
                    </td>
                    <td className="py-2 pr-4 text-foreground">{log.path}</td>
                    <td className="py-2 pr-4">
                      <span className={log.status === 200 ? "text-accent" : "text-destructive"}>{log.status}</span>
                    </td>
                    <td className="py-2 text-muted-foreground">{log.latency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* API Keys */}
        {activeTab === "keys" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Newly generated key warning */}
            {newlyGeneratedKey && (
              <div className="border border-primary/50 rounded-lg p-4 bg-primary/10 space-y-2">
                <div className="flex items-center gap-2 text-primary text-sm font-mono font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  Copy your new API key — it won't be shown again
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-foreground bg-secondary rounded px-2 py-1 flex-1 break-all">
                    {newlyGeneratedKey}
                  </code>
                  <CopyBtn text={newlyGeneratedKey} />
                </div>
                <button
                  onClick={() => setNewlyGeneratedKey(null)}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">API Keys</h2>
                <button
                  onClick={() => setShowNewKeyForm(!showNewKeyForm)}
                  className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Generate New Key
                </button>
              </div>

              {/* New Key Form */}
              {showNewKeyForm && (
                <div className="border border-primary/30 rounded-lg p-4 mb-4 bg-primary/5 space-y-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">Key Name</label>
                    <input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production, Staging"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1 block">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Expiration Date (optional)
                    </label>
                    <input
                      type="date"
                      value={newKeyExpiry}
                      onChange={(e) => setNewKeyExpiry(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">
                      Leave empty for no expiration. You'll be alerted 7 days before expiry.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => generateKey.mutate()}
                      disabled={generateKey.isPending}
                      className="flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-xs font-mono font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {generateKey.isPending ? "Generating..." : "Generate Key"}
                    </button>
                    <button
                      onClick={() => setShowNewKeyForm(false)}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground px-3 py-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Real keys from DB */}
              {apiKeys.length === 0 && (
                <p className="text-xs font-mono text-muted-foreground py-4 text-center">No API keys yet. Generate one above.</p>
              )}
              {apiKeys.map((k) => {
                const isRevoked = !!k.revoked_at;
                const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
                return (
                  <div key={k.id} className={`border rounded-lg p-4 mb-3 ${isRevoked || isExpired ? "border-destructive/30 opacity-60" : "border-border/50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-foreground">{k.name}</span>
                        {isRevoked && <span className="text-[10px] font-mono bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Revoked</span>}
                        {isExpired && !isRevoked && <span className="text-[10px] font-mono bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">Expired</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyBtn text={k.key_prefix + "••••••••"} />
                        {!isRevoked && (
                          <button
                            onClick={() => revokeKey.mutate(k.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Revoke key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <code className="text-xs font-mono text-muted-foreground">
                      {k.key_prefix}{"•".repeat(32)}
                    </code>
                    <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted-foreground flex-wrap">
                      <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                      {k.expires_at && <span>Expires: {new Date(k.expires_at).toLocaleDateString()}</span>}
                      {k.last_request_at && <span>Last used: {new Date(k.last_request_at).toLocaleString()}</span>}
                      <span>Requests: {k.requests_month}/mo</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Billing */}
        {activeTab === "billing" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Current Plan</h2>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-mono font-bold neon-text-cyan">Enterprise</span>
                <span className="bg-primary/20 text-primary text-[10px] font-mono font-bold px-2 py-0.5 rounded">Active</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                {[
                  { label: "Monthly Cost", value: "$2,499/mo" },
                  { label: "API Requests", value: "Unlimited" },
                  { label: "Precision", value: "±5ms" },
                  { label: "Trade Ordering", value: "Enabled" },
                  { label: "MEV Protection", value: "Enabled" },
                  { label: "Next Invoice", value: "Apr 1, 2026" },
                ].map((b) => (
                  <div key={b.label} className="bg-secondary/40 rounded-lg p-3">
                    <div className="text-muted-foreground mb-1">{b.label}</div>
                    <div className="text-foreground font-semibold">{b.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Integrations */}
        {activeTab === "integrations" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {[
              { name: "Time API", status: "connected", endpoint: "/api/v1/time" },
              { name: "Precision Time", status: "connected", endpoint: "/api/v1/time/precision" },
              { name: "Trade Ordering", status: "connected", endpoint: "/api/v1/order-event" },
              { name: "MEV Protection", status: "connected", endpoint: "/api/v1/mev/*" },
              { name: "Event Ledger", status: "connected", endpoint: "/api/v1/ledger/*" },
              { name: "Webhooks", status: "configured", endpoint: "3 active hooks" },
            ].map((int) => (
              <div key={int.name} className="glass-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {int.status === "connected" ? (
                    <CheckCircle className="w-4 h-4 text-accent" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-primary" />
                  )}
                  <div>
                    <div className="text-sm font-mono font-semibold text-foreground">{int.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{int.endpoint}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  int.status === "connected" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                }`}>{int.status}</span>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
