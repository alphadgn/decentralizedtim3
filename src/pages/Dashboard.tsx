import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  BarChart3, Key, CreditCard, Activity, Copy, Check,
  Plus, Eye, EyeOff, Trash2, CheckCircle, AlertCircle,
} from "lucide-react";

// ── Mock data ──────────────────────────────────────────────────────
const MOCK_USAGE = [
  { day: "Mon", requests: 12400 },
  { day: "Tue", requests: 18700 },
  { day: "Wed", requests: 15300 },
  { day: "Thu", requests: 22100 },
  { day: "Fri", requests: 19800 },
  { day: "Sat", requests: 8900 },
  { day: "Sun", requests: 6200 },
];

const MOCK_LOGS = [
  { time: "14:32:01.123", method: "GET", path: "/api/v1/time", status: 200, latency: "12ms" },
  { time: "14:32:00.891", method: "GET", path: "/api/v1/time/precision", status: 200, latency: "8ms" },
  { time: "14:31:59.445", method: "POST", path: "/api/v1/order-event", status: 200, latency: "23ms" },
  { time: "14:31:58.221", method: "GET", path: "/api/v1/nodes", status: 200, latency: "15ms" },
  { time: "14:31:57.010", method: "POST", path: "/api/v1/mev/commit", status: 200, latency: "31ms" },
  { time: "14:31:55.800", method: "GET", path: "/api/v1/status", status: 200, latency: "9ms" },
  { time: "14:31:54.112", method: "GET", path: "/api/v1/time", status: 429, latency: "2ms" },
  { time: "14:31:53.001", method: "GET", path: "/api/v1/ledger/events", status: 200, latency: "45ms" },
];

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
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"usage" | "logs" | "keys" | "billing" | "integrations">("usage");
  const [showKey, setShowKey] = useState(false);

  if (!loading && !user) return <Navigate to="/" replace />;

  const maxReq = Math.max(...MOCK_USAGE.map((d) => d.requests));
  const totalReq = MOCK_USAGE.reduce((s, d) => s + d.requests, 0);

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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Developer Dashboard</h1>
          <p className="text-sm font-mono text-muted-foreground">Monitor API usage, manage keys, and view billing</p>
        </motion.div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Requests (7d)", value: totalReq.toLocaleString(), accent: "neon-text-cyan" },
            { label: "Avg Latency", value: "18ms", accent: "neon-text-green" },
            { label: "Success Rate", value: "99.87%", accent: "neon-text-green" },
            { label: "Active Keys", value: "2", accent: "neon-text-cyan" },
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
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-6">Requests — Last 7 Days</h2>
            <div className="flex items-end gap-2 h-40">
              {MOCK_USAGE.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{(d.requests / 1000).toFixed(1)}k</span>
                  <div
                    className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors"
                    style={{ height: `${(d.requests / maxReq) * 100}%` }}
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
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Recent Requests</h2>
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
                {MOCK_LOGS.map((log, i) => (
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
            <div className="glass-panel p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">API Keys</h2>
                <button className="flex items-center gap-1 text-xs font-mono text-primary hover:text-primary/80 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Generate New Key
                </button>
              </div>
              {[
                { name: "Production", key: "dgtn_live_7f3a2e1b9c4d5f6a8b0c1d2e3f4a5b6c", created: "2025-01-15", lastUsed: "2 min ago" },
                { name: "Development", key: "dgtn_test_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d", created: "2025-02-20", lastUsed: "1 hour ago" },
              ].map((k) => (
                <div key={k.name} className="border border-border/50 rounded-lg p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono font-semibold text-foreground">{k.name}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setShowKey(!showKey)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <CopyBtn text={k.key} />
                      <button className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <code className="text-xs font-mono text-muted-foreground">
                    {showKey ? k.key : k.key.slice(0, 12) + "•".repeat(32)}
                  </code>
                  <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                    <span>Created: {k.created}</span>
                    <span>Last used: {k.lastUsed}</span>
                  </div>
                </div>
              ))}
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
