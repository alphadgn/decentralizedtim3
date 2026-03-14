import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Shield, Users, Activity, Server } from "lucide-react";
import { NETWORK_NODES } from "@/hooks/useNetworkTime";

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();

  const { data: allNodes = [] } = useQuery({
    queryKey: ["admin-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("node_registrations").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <BackToDashboard />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-mono font-bold text-foreground">Admin Dashboard</h1>
          </div>
          <p className="text-sm font-mono text-muted-foreground">View-only network monitoring and user overview</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: profiles.length, icon: Users },
            { label: "Registered Nodes", value: allNodes.length, icon: Server },
            { label: "Network Nodes", value: NETWORK_NODES.length, icon: Activity },
            { label: "Active Nodes", value: allNodes.filter((n) => n.status === "active").length, icon: Activity },
          ].map((s) => (
            <div key={s.label} className="glass-panel p-4">
              <s.icon className="w-4 h-4 text-muted-foreground mb-2" />
              <div className="text-lg font-mono font-bold neon-text-cyan">{s.value}</div>
              <div className="text-xs font-mono text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Users list */}
        <div className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">Users</h2>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 px-2">Display Name</th>
                <th className="text-left py-2 px-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2 px-2 text-foreground">{p.display_name || "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Registered Nodes */}
        <div className="glass-panel p-6 overflow-x-auto">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">All Registered Nodes</h2>
          {allNodes.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">No registered nodes yet.</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Region</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {allNodes.map((n) => (
                  <tr key={n.id} className="border-b border-border/50">
                    <td className="py-2 px-2 text-foreground">{n.node_name}</td>
                    <td className="py-2 px-2 text-muted-foreground">{n.region}</td>
                    <td className="py-2 px-2">
                      <span className={n.status === "active" ? "neon-text-green" : "text-muted-foreground"}>{n.status}</span>
                    </td>
                    <td className="py-2 px-2 text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
