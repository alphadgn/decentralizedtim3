import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  Eye,
  Ban,
  Activity,
  RefreshCw,
  Search,
  BellRing,
  CheckCircle,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type SeverityFilter = "all" | "critical" | "warning" | "error" | "info";

export default function SecurityDashboard() {
  const { user, isSuperAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Security logs
  const { data: securityLogs = [], refetch: refetchLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["security-logs", severityFilter],
    queryFn: async () => {
      let query = supabase
        .from("security_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (severityFilter !== "all") {
        query = query.eq("severity", severityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  // Blocked IPs
  const { data: blockedIps = [], refetch: refetchIps } = useQuery({
    queryKey: ["blocked-ips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ip_rate_limits")
        .select("*")
        .not("blocked_until", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  // Honeypot hits (filtered from security_logs)
  const { data: honeypotHits = [] } = useQuery({
    queryKey: ["honeypot-hits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_logs")
        .select("*")
        .eq("event_type", "honeypot_access")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
    refetchInterval: 30000,
  });

  // Stats
  const criticalCount = securityLogs.filter((l) => l.severity === "critical").length;
  const warningCount = securityLogs.filter((l) => l.severity === "warning").length;
  const rateLimitCount = securityLogs.filter((l) => l.event_type === "rate_limit_exceeded").length;
  const activeBlocks = blockedIps.filter(
    (ip) => ip.blocked_until && new Date(ip.blocked_until) > new Date()
  ).length;

  const filteredLogs = securityLogs.filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.ip_address?.toLowerCase().includes(q) ||
      log.endpoint?.toLowerCase().includes(q) ||
      log.event_type?.toLowerCase().includes(q) ||
      log.user_agent?.toLowerCase().includes(q)
    );
  });

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "text-destructive font-bold";
      case "error": return "text-destructive";
      case "warning": return "text-yellow-400";
      default: return "text-muted-foreground";
    }
  };

  const severityBg = (s: string) => {
    switch (s) {
      case "critical": return "bg-destructive/20 text-destructive";
      case "error": return "bg-destructive/10 text-destructive";
      case "warning": return "bg-yellow-500/10 text-yellow-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <h1 className="text-2xl font-mono font-bold text-foreground">Security Monitor</h1>
            </div>
            <button
              onClick={() => { refetchLogs(); refetchIps(); }}
              className="flex items-center gap-1.5 bg-secondary text-foreground rounded-lg px-3 py-1.5 text-xs font-mono hover:bg-secondary/80"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            Real-time security events, blocked IPs, and honeypot detections
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Critical Events", value: criticalCount, icon: AlertTriangle, color: "text-destructive" },
            { label: "Warnings", value: warningCount, icon: Eye, color: "text-yellow-400" },
            { label: "Rate Limited", value: rateLimitCount, icon: Activity, color: "text-primary" },
            { label: "Active Blocks", value: activeBlocks, icon: Ban, color: "text-destructive" },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs font-mono text-muted-foreground">{stat.label}</span>
              </div>
              <span className={`text-2xl font-mono font-bold ${stat.color}`}>{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Honeypot Hits */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Honeypot Hits ({honeypotHits.length})
          </h2>
          {honeypotHits.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">No honeypot access detected</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs">Time</TableHead>
                    <TableHead className="font-mono text-xs">IP Address</TableHead>
                    <TableHead className="font-mono text-xs">Path Accessed</TableHead>
                    <TableHead className="font-mono text-xs">User Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {honeypotHits.map((hit) => (
                    <TableRow key={hit.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {new Date(hit.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-destructive font-semibold">
                        {hit.ip_address || "unknown"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {hit.endpoint}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {hit.user_agent || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Blocked IPs */}
        <div className="glass-panel p-6">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Ban className="w-4 h-4 text-destructive" /> Blocked IPs ({blockedIps.length})
          </h2>
          {blockedIps.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">No blocked IPs</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs">IP Address</TableHead>
                    <TableHead className="font-mono text-xs">Endpoint</TableHead>
                    <TableHead className="font-mono text-xs">Requests</TableHead>
                    <TableHead className="font-mono text-xs">Blocked Until</TableHead>
                    <TableHead className="font-mono text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIps.map((ip) => {
                    const isActive = ip.blocked_until && new Date(ip.blocked_until) > new Date();
                    return (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono text-xs text-foreground font-semibold">
                          {ip.ip_address}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ip.endpoint}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-foreground">
                          {ip.request_count}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ip.blocked_until ? new Date(ip.blocked_until).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded ${isActive ? "bg-destructive/20 text-destructive" : "bg-accent/20 text-accent"}`}>
                            {isActive ? "BLOCKED" : "EXPIRED"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Security Logs */}
        <div className="glass-panel p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> Security Logs ({filteredLogs.length})
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search IP, endpoint, event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "critical", "warning", "error", "info"] as SeverityFilter[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={`text-[10px] font-mono px-2 py-1 rounded transition-colors ${
                      severityFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {logsLoading ? (
            <p className="text-xs font-mono text-muted-foreground">Loading...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-xs font-mono text-muted-foreground">No security events found</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-mono text-xs">Time</TableHead>
                    <TableHead className="font-mono text-xs">Severity</TableHead>
                    <TableHead className="font-mono text-xs">Event</TableHead>
                    <TableHead className="font-mono text-xs">IP</TableHead>
                    <TableHead className="font-mono text-xs">Endpoint</TableHead>
                    <TableHead className="font-mono text-xs">Code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${severityBg(log.severity)}`}>
                          {log.severity}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-foreground">
                        {log.event_type}
                      </TableCell>
                      <TableCell className={`font-mono text-xs ${severityColor(log.severity)}`}>
                        {log.ip_address || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.endpoint || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.response_code || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <footer className="text-center py-6 text-xs font-mono text-muted-foreground">
          DGTN Protocol — Security Monitoring
        </footer>
      </main>
    </div>
  );
}
