import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, Clock, Zap, TrendingUp, Plus, Shield, AlertTriangle,
  Coins, Lock, Unlock, Slash, CheckCircle, XCircle,
} from "lucide-react";
import { NETWORK_NODES } from "@/hooks/useNetworkTime";
import { Navigate } from "react-router-dom";

// Simulated node metrics with staking data
function generateNodeMetrics() {
  return NETWORK_NODES.map((node, i) => {
    const drift = Math.random() * 8 - 2;
    const absDrift = Math.abs(drift);
    let reputation: "trusted" | "acceptable" | "penalized" = "trusted";
    if (absDrift > 20) reputation = "penalized";
    else if (absDrift > 5) reputation = "acceptable";
    else if (absDrift > 1) reputation = "acceptable";

    return {
      ...node,
      uptime: 99.5 + Math.random() * 0.5,
      drift: drift.toFixed(3),
      absDrift,
      consensusParticipation: 95 + Math.random() * 5,
      lastObservation: Date.now() - Math.floor(Math.random() * 5000),
      rewards: (Math.random() * 10).toFixed(4),
      trustScore: Math.max(0, 100 - absDrift * 5).toFixed(1),
      reputation,
      staked: (1000 + Math.random() * 9000).toFixed(0),
      slashed: reputation === "penalized" ? (Math.random() * 500).toFixed(0) : "0",
    };
  });
}

// Use state for live-refreshing metrics

// Reputation badge component
function ReputationBadge({ reputation }: { reputation: string }) {
  const config = {
    trusted: { icon: CheckCircle, label: "Trusted", className: "bg-accent/20 text-accent" },
    acceptable: { icon: AlertTriangle, label: "Acceptable", className: "bg-primary/20 text-primary" },
    penalized: { icon: XCircle, label: "Penalized", className: "bg-destructive/20 text-destructive" },
  }[reputation] ?? { icon: AlertTriangle, label: reputation, className: "bg-muted text-muted-foreground" };

  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${config.className}`}>
      <Icon className="w-3 h-3" /> {config.label}
    </span>
  );
}

export default function NodeOperator() {
  const { user, userId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [region, setRegion] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "staking" | "reputation" | "drift">("overview");
  const [metrics, setMetrics] = useState(generateNodeMetrics);

  // Auto-refresh metrics every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => setMetrics(generateNodeMetrics()), 3000);
    return () => clearInterval(interval);
  }, []);

  const { data: myNodes = [] } = useQuery({
    queryKey: ["my-nodes", userId],
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

  const registerNode = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("node_registrations").insert({
        user_id: userId,
        node_name: nodeName,
        region,
        endpoint_url: endpoint || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Node registered successfully");
      queryClient.invalidateQueries({ queryKey: ["my-nodes"] });
      setShowForm(false);
      setNodeName("");
      setRegion("");
      setEndpoint("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return null;
  if (!user) return <Navigate to="/" replace />;

  const trustedCount = metrics.filter((m) => m.reputation === "trusted").length;
  const penalizedCount = metrics.filter((m) => m.reputation === "penalized").length;
  const totalStaked = metrics.reduce((s, m) => s + parseFloat(m.staked), 0);
  const totalSlashed = metrics.reduce((s, m) => s + parseFloat(m.slashed), 0);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Activity },
    { id: "staking" as const, label: "Staking", icon: Coins },
    { id: "reputation" as const, label: "Reputation", icon: Shield },
    { id: "drift" as const, label: "Drift Tracking", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Node Operator Dashboard</h1>
          <p className="text-sm font-mono text-muted-foreground">Monitor nodes, manage stakes, and track reputation</p>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Nodes", value: metrics.length, icon: Activity, color: "neon-text-cyan" },
            { label: "Total Staked", value: `${(totalStaked / 1000).toFixed(1)}k DGTN`, icon: Coins, color: "neon-text-cyan" },
            { label: "Trusted Nodes", value: `${trustedCount}/${metrics.length}`, icon: Shield, color: "neon-text-green" },
            { label: "Total Slashed", value: `${totalSlashed.toFixed(0)} DGTN`, icon: Slash, color: penalizedCount > 0 ? "text-destructive" : "neon-text-green" },
          ].map((stat) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4">
              <stat.icon className="w-4 h-4 text-muted-foreground mb-2" />
              <div className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs font-mono text-muted-foreground">{stat.label}</div>
            </motion.div>
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

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* Node Table */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6 overflow-x-auto">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Network Nodes</h2>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">Node</th>
                    <th className="text-right py-2 px-2">Uptime</th>
                    <th className="text-right py-2 px-2">Drift (ms)</th>
                    <th className="text-right py-2 px-2">Trust</th>
                    <th className="text-center py-2 px-2">Status</th>
                    <th className="text-right py-2 px-2">Rewards</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-2 text-foreground">{m.region}</td>
                      <td className="py-2 px-2 text-right neon-text-green">{m.uptime.toFixed(2)}%</td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{m.drift}</td>
                      <td className="py-2 px-2 text-right neon-text-cyan">{m.trustScore}</td>
                      <td className="py-2 px-2 text-center"><ReputationBadge reputation={m.reputation} /></td>
                      <td className="py-2 px-2 text-right text-foreground">{m.rewards} DGTN</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {/* My Registered Nodes */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">My Registered Nodes</h2>
                <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 text-xs font-mono text-primary hover:opacity-80">
                  <Plus className="w-3 h-3" /> Register Node
                </button>
              </div>
              {showForm && (
                <form onSubmit={(e) => { e.preventDefault(); registerNode.mutate(); }} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <input placeholder="Node Name" value={nodeName} onChange={(e) => setNodeName(e.target.value)} required
                    className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input placeholder="Region (e.g. US East)" value={region} onChange={(e) => setRegion(e.target.value)} required
                    className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <div className="flex gap-2">
                    <input placeholder="Endpoint URL (optional)" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
                      className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                    <button type="submit" disabled={registerNode.isPending}
                      className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50">
                      {registerNode.isPending ? "..." : "Add"}
                    </button>
                  </div>
                </form>
              )}
              {myNodes.length === 0 ? (
                <p className="text-xs font-mono text-muted-foreground">No nodes registered yet.</p>
              ) : (
                <div className="space-y-2">
                  {myNodes.map((n) => (
                    <div key={n.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                      <div>
                        <span className="text-sm font-mono text-foreground">{n.node_name}</span>
                        <span className="text-xs font-mono text-muted-foreground ml-2">{n.region}</span>
                      </div>
                      <span className={`text-xs font-mono ${n.status === "active" ? "neon-text-green" : "text-muted-foreground"}`}>
                        {n.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Staking Tab */}
        {activeTab === "staking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">Staking Protocol</h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Nodes must stake DGTN tokens to participate in the oracle network. Manipulated timestamps result in stake slashing and network removal.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-[10px] font-mono text-muted-foreground">Min Stake</div>
                  <div className="text-sm font-mono font-bold text-foreground">1,000 DGTN</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-[10px] font-mono text-muted-foreground">Slash Penalty</div>
                  <div className="text-sm font-mono font-bold text-destructive">10-50%</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-[10px] font-mono text-muted-foreground">APY (est.)</div>
                  <div className="text-sm font-mono font-bold neon-text-green">8.4%</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-3">
                  <div className="text-[10px] font-mono text-muted-foreground">Lock Period</div>
                  <div className="text-sm font-mono font-bold text-foreground">30 days</div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 overflow-x-auto">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Node Stakes</h2>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">Node</th>
                    <th className="text-right py-2 px-2">Staked (DGTN)</th>
                    <th className="text-right py-2 px-2">Slashed</th>
                    <th className="text-right py-2 px-2">Effective</th>
                    <th className="text-center py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const effective = parseFloat(m.staked) - parseFloat(m.slashed);
                    return (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2 px-2 text-foreground">{m.region}</td>
                        <td className="py-2 px-2 text-right neon-text-cyan">{parseFloat(m.staked).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right text-destructive">{parseFloat(m.slashed) > 0 ? `-${m.slashed}` : "—"}</td>
                        <td className="py-2 px-2 text-right text-foreground">{effective.toLocaleString()}</td>
                        <td className="py-2 px-2 text-center">
                          {effective >= 1000 ? (
                            <span className="inline-flex items-center gap-1 text-accent"><Lock className="w-3 h-3" /> Active</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive"><Unlock className="w-3 h-3" /> At Risk</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Reputation Tab */}
        {activeTab === "reputation" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">Trust Score System</h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Nodes receive trust scores based on time drift accuracy. Consistently accurate nodes earn higher rewards.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-mono font-bold text-accent">Trusted</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">Drift {"<"} 1ms</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Full rewards + bonus</div>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-mono font-bold text-primary">Acceptable</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">Drift {"<"} 5ms</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Standard rewards</div>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-xs font-mono font-bold text-destructive">Penalized</span>
                  </div>
                  <div className="text-[10px] font-mono text-muted-foreground">Drift {">"} 20ms</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Stake slashed + removed</div>
                </div>
              </div>
            </div>

            <div className="glass-panel p-5 overflow-x-auto">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Node Reputation Scores</h2>
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">Node</th>
                    <th className="text-right py-2 px-2">Trust Score</th>
                    <th className="text-right py-2 px-2">Avg Drift</th>
                    <th className="text-center py-2 px-2">Reputation</th>
                    <th className="text-right py-2 px-2">Consensus %</th>
                  </tr>
                </thead>
                <tbody>
                  {[...metrics].sort((a, b) => parseFloat(b.trustScore) - parseFloat(a.trustScore)).map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2 px-2 text-foreground">{m.region}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={parseFloat(m.trustScore) >= 90 ? "neon-text-green" : parseFloat(m.trustScore) >= 50 ? "neon-text-cyan" : "text-destructive"}>
                          {m.trustScore}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{m.drift}ms</td>
                      <td className="py-2 px-2 text-center"><ReputationBadge reputation={m.reputation} /></td>
                      <td className="py-2 px-2 text-right neon-text-cyan">{m.consensusParticipation.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Drift Tracking Tab */}
        {activeTab === "drift" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Node Drift Distribution (ms)</h2>
              <div className="flex items-end gap-1 h-40">
                {metrics.map((m) => {
                  const h = Math.min(100, Math.abs(parseFloat(m.drift)) * 15 + 10);
                  const color = m.reputation === "trusted"
                    ? "hsl(var(--neon-green))"
                    : m.reputation === "acceptable"
                    ? "hsl(var(--neon-cyan))"
                    : "hsl(var(--destructive))";
                  return (
                    <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[8px] font-mono text-muted-foreground">{m.drift}</span>
                      <div className="w-full rounded-t" style={{ height: `${h}%`, background: color, opacity: 0.7 }} />
                      <span className="text-[8px] font-mono text-muted-foreground truncate w-full text-center">
                        {m.region.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel p-6">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Drift Thresholds</h2>
              <div className="space-y-3">
                {[
                  { threshold: "< 1ms", status: "Trusted", color: "bg-accent", width: "10%" },
                  { threshold: "1-5ms", status: "Acceptable", color: "bg-primary", width: "40%" },
                  { threshold: "5-20ms", status: "Warning", color: "bg-primary/60", width: "70%" },
                  { threshold: "> 20ms", status: "Penalized", color: "bg-destructive", width: "100%" },
                ].map((t) => (
                  <div key={t.threshold} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-16">{t.threshold}</span>
                    <div className="flex-1 bg-secondary/40 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${t.color}`} style={{ width: t.width }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-20 text-right">{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
