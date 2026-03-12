import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Activity, Clock, Zap, TrendingUp, Plus } from "lucide-react";
import { NETWORK_NODES } from "@/hooks/useNetworkTime";
import { Navigate } from "react-router-dom";

// Simulated node metrics
function generateNodeMetrics() {
  return NETWORK_NODES.map((node) => ({
    ...node,
    uptime: 99.5 + Math.random() * 0.5,
    drift: (Math.random() * 2 - 1).toFixed(3),
    consensusParticipation: 95 + Math.random() * 5,
    lastObservation: Date.now() - Math.floor(Math.random() * 5000),
    rewards: (Math.random() * 10).toFixed(4),
  }));
}

const METRICS = generateNodeMetrics();

export default function NodeOperator() {
  const { user, userId, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [nodeName, setNodeName] = useState("");
  const [region, setRegion] = useState("");
  const [endpoint, setEndpoint] = useState("");

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
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Node Operator Dashboard</h1>
          <p className="text-sm font-mono text-muted-foreground">Monitor and manage your oracle nodes</p>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Nodes", value: METRICS.length, icon: Activity, color: "neon-text-cyan" },
            { label: "Avg Uptime", value: "99.7%", icon: Clock, color: "neon-text-green" },
            { label: "Consensus Rate", value: "97.2%", icon: Zap, color: "neon-text-cyan" },
            { label: "Total Rewards", value: "42.8 DGTN", icon: TrendingUp, color: "neon-text-green" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-4"
            >
              <stat.icon className="w-4 h-4 text-muted-foreground mb-2" />
              <div className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs font-mono text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Drift Chart (simulated) */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Node Drift Distribution (ms)</h2>
          <div className="flex items-end gap-1 h-32">
            {METRICS.map((m) => {
              const h = Math.abs(parseFloat(m.drift)) * 60 + 10;
              return (
                <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${h}%`,
                      background: parseFloat(m.drift) > 0 ? "hsl(var(--neon-cyan))" : "hsl(var(--neon-green))",
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[8px] font-mono text-muted-foreground truncate w-full text-center">
                    {m.region.split(" ")[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Node Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Network Nodes</h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">Node</th>
                <th className="text-right py-2 px-2">Uptime</th>
                <th className="text-right py-2 px-2">Drift (ms)</th>
                <th className="text-right py-2 px-2">Consensus</th>
                <th className="text-right py-2 px-2">Rewards</th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="py-2 px-2 text-foreground">{m.region}</td>
                  <td className="py-2 px-2 text-right neon-text-green">{m.uptime.toFixed(2)}%</td>
                  <td className="py-2 px-2 text-right text-muted-foreground">{m.drift}</td>
                  <td className="py-2 px-2 text-right neon-text-cyan">{m.consensusParticipation.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right text-foreground">{m.rewards} DGTN</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* My Registered Nodes */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">My Registered Nodes</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-xs font-mono text-primary hover:opacity-80"
            >
              <Plus className="w-3 h-3" /> Register Node
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={(e) => { e.preventDefault(); registerNode.mutate(); }}
              className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4"
            >
              <input
                placeholder="Node Name"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                required
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="Region (e.g. US East)"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                required
                className="bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex gap-2">
                <input
                  placeholder="Endpoint URL (optional)"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={registerNode.isPending}
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-mono font-semibold hover:opacity-90 disabled:opacity-50"
                >
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
      </main>
    </div>
  );
}
