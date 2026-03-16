import { useState, useEffect, useCallback, useRef } from "react";
import { BackToDashboard } from "@/components/BackToDashboard";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
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
  Shield,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type SeverityFilter = "all" | "critical" | "warning" | "error" | "info";
type DailyScanStatus = "pass" | "warn" | "fail";

type SecurityLogRow = {
  id: string;
  created_at: string;
  severity: string;
  event_type: string;
  ip_address: string | null;
  endpoint: string | null;
  response_code: number | null;
  user_agent: string | null;
};

type DailyScansResponse = {
  generated_at: string;
  scans: {
    id: string;
    label: string;
    status: DailyScanStatus;
    summary: string;
  }[];
};

type AutoScanResult = {
  id: string;
  ran_at: string;
  scans: DailyScansResponse["scans"];
};

const AUTO_SCAN_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_STORED_SCANS = 15;
const AUTO_SCAN_STORAGE_KEY = "dgtn_auto_scans";

function loadStoredScans(): AutoScanResult[] {
  try {
    const raw = localStorage.getItem(AUTO_SCAN_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw).slice(0, MAX_STORED_SCANS);
  } catch {
    return [];
  }
}

function saveStoredScans(scans: AutoScanResult[]) {
  localStorage.setItem(AUTO_SCAN_STORAGE_KEY, JSON.stringify(scans.slice(0, MAX_STORED_SCANS)));
}

export default function SecurityDashboard() {
  const { user, userId, isSuperAdmin, isAuditor, loading, getAccessToken } = useAuth();
  const canView = isSuperAdmin || isAuditor;
  const readOnly = isAuditor && !isSuperAdmin;
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoScans, setAutoScans] = useState<AutoScanResult[]>(loadStoredScans);
  const [isRunningManualScan, setIsRunningManualScan] = useState(false);
  const autoScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Security logs
  const {
    data: securityLogs = [],
    refetch: refetchLogs,
    isLoading: logsLoading,
    dataUpdatedAt: logsUpdatedAt,
  } = useQuery({
    queryKey: ["security-logs"],
    queryFn: async (): Promise<SecurityLogRow[]> => {
      const { data, error } = await supabase
        .from("security_logs")
        .select("id, created_at, severity, event_type, ip_address, endpoint, response_code, user_agent")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
    enabled: canView,
    refetchInterval: 30000,
  });

  // Blocked IPs
  const {
    data: blockedIps = [],
    refetch: refetchIps,
    dataUpdatedAt: blockedIpsUpdatedAt,
  } = useQuery({
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
    enabled: canView,
    refetchInterval: 30000,
  });

  // Honeypot hits
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
    enabled: canView,
    refetchInterval: 30000,
  });

  // Security alerts
  const { data: securityAlerts = [], refetch: refetchAlerts } = useQuery({
    queryKey: ["security-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: canView,
  });

  // Daily security scans (3 checks) surfaced inside Security Logs
  const {
    data: dailyScanLogs = [],
    refetch: refetchDailyScans,
    dataUpdatedAt: dailyScansUpdatedAt,
  } = useQuery({
    queryKey: ["security-daily-scans", userId],
    enabled: isSuperAdmin && !!userId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SecurityLogRow[]> => {
      const token = await getAccessToken();
      if (!token || !userId) return [];

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/api-gateway/api/security/daily-scans`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-user-id": userId,
        },
      });

      if (!response.ok) return [];

      const payload = (await response.json()) as DailyScansResponse;
      const generatedAt = payload.generated_at ?? new Date().toISOString();

      return (payload.scans ?? []).map((scan) => {
        const severity = scan.status === "fail" ? "critical" : scan.status === "warn" ? "warning" : "info";
        const responseCode = scan.status === "fail" ? 500 : scan.status === "warn" ? 206 : 200;

        return {
          id: `daily-scan-${generatedAt}-${scan.id}`,
          created_at: generatedAt,
          severity,
          event_type: `daily_scan: ${scan.label}`,
          ip_address: null,
          endpoint: scan.summary,
          response_code: responseCode,
          user_agent: "daily_scan",
        };
      });
    },
  });

  // ── Automatic Security Scan (every 8 hours) ──
  const runAutoScan = useCallback(async () => {
    if (!isSuperAdmin || !userId) return;
    const token = await getAccessToken();
    if (!token) return;

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/api-gateway/api/security/daily-scans`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-user-id": userId,
        },
      });

      if (!response.ok) return;

      const payload = (await response.json()) as DailyScansResponse;
      const newScan: AutoScanResult = {
        id: `auto-${Date.now()}`,
        ran_at: new Date().toISOString(),
        scans: payload.scans ?? [],
      };

      setAutoScans((prev) => {
        const updated = [newScan, ...prev].slice(0, MAX_STORED_SCANS);
        saveStoredScans(updated);
        return updated;
      });

      const hasFail = payload.scans?.some((s) => s.status === "fail");
      if (hasFail) {
        toast.error("🚨 Automated security scan detected failures");
      } else {
        toast.success("✅ Automated security scan completed — all checks passed");
      }
    } catch (e) {
      console.error("Auto scan failed:", e);
    }
  }, [isSuperAdmin, userId, getAccessToken]);

  // Run auto scan on mount if last scan > 8h ago, then set interval
  useEffect(() => {
    if (!isSuperAdmin || !userId) return;

    const lastScan = autoScans[0];
    const lastScanTime = lastScan ? new Date(lastScan.ran_at).getTime() : 0;
    const timeSinceLastScan = Date.now() - lastScanTime;

    if (timeSinceLastScan >= AUTO_SCAN_INTERVAL_MS) {
      // Run immediately
      runAutoScan();
    }

    autoScanTimerRef.current = setInterval(runAutoScan, AUTO_SCAN_INTERVAL_MS);

    return () => {
      if (autoScanTimerRef.current) clearInterval(autoScanTimerRef.current);
    };
  }, [isSuperAdmin, userId, runAutoScan]);

  // Realtime subscription for security_alerts
  useEffect(() => {
    if (!canView) return;

    const channel = supabase
      .channel("security-alerts-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "security_alerts",
        },
        (payload) => {
          const newAlert = payload.new as any;
          const icon = newAlert.severity === "critical" ? "🚨" : "⚠️";
          toast.warning(`${icon} ${newAlert.alert_type}: ${newAlert.message}`, {
            duration: 10000,
          });
          queryClient.invalidateQueries({ queryKey: ["security-alerts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canView, queryClient]);

  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from("security_alerts")
        .update({ acknowledged: true })
        .eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["security-alerts"] }),
  });

  // ── Refresh handler with feedback ──
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchLogs(),
        refetchIps(),
        refetchAlerts(),
        refetchDailyScans(),
      ]);
      toast.success("Security data refreshed");
    } catch {
      toast.error("Failed to refresh security data");
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchLogs, refetchIps, refetchAlerts, refetchDailyScans]);

  const combinedLogs = [...dailyScanLogs, ...securityLogs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const logStats = combinedLogs.reduce(
    (acc, log) => {
      if (log.severity === "critical") acc.critical += 1;
      if (log.severity === "warning") acc.warning += 1;
      if (log.event_type === "rate_limit_exceeded") acc.rateLimited += 1;
      return acc;
    },
    { critical: 0, warning: 0, rateLimited: 0 }
  );

  // Stats
  const criticalCount = logStats.critical;
  const warningCount = logStats.warning;
  const rateLimitCount = logStats.rateLimited;
  const activeBlocks = blockedIps.filter(
    (ip) => ip.blocked_until && new Date(ip.blocked_until) > new Date()
  ).length;

  const latestSyncMs = Math.max(logsUpdatedAt ?? 0, blockedIpsUpdatedAt ?? 0, dailyScansUpdatedAt ?? 0);
  const lastScanSyncLabel = latestSyncMs > 0 ? new Date(latestSyncMs).toLocaleString() : "Waiting for first sync…";

  const filteredLogs = combinedLogs.filter((log) => {
    if (severityFilter !== "all" && log.severity !== severityFilter) return false;

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
  if (!canView) return <Navigate to="/" replace />;

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

  const scanStatusIcon = (status: DailyScanStatus) => {
    switch (status) {
      case "pass": return "✅";
      case "warn": return "⚠️";
      case "fail": return "🚨";
    }
  };

  const scanStatusColor = (status: DailyScanStatus) => {
    switch (status) {
      case "pass": return "text-accent";
      case "warn": return "text-yellow-400";
      case "fail": return "text-destructive";
    }
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <BackToDashboard />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="flex flex-col items-center gap-2 mb-2">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-foreground">Security Monitor</h1>
              <span className="flex items-center gap-1 text-[10px] font-mono text-accent">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                LIVE
              </span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 bg-secondary text-foreground rounded-lg px-3 py-1.5 text-xs font-mono hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            Real-time security events, blocked IPs, and honeypot detections
          </p>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Last scan sync: <span className="text-foreground">{lastScanSyncLabel}</span>
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

        {/* Security Alerts */}
        {securityAlerts.length > 0 && (
          <div className="glass-panel p-6 border border-destructive/30">
            <h2 className="text-sm font-mono uppercase tracking-widest text-destructive mb-4 flex items-center gap-2">
              <BellRing className="w-4 h-4" /> Active Alerts ({securityAlerts.length})
            </h2>
            <div className="space-y-3">
              {securityAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start justify-between gap-3 p-3 rounded-lg ${
                    alert.severity === "critical" ? "bg-destructive/10 border border-destructive/20" : "bg-yellow-500/5 border border-yellow-500/20"
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        alert.severity === "critical" ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {alert.alert_type}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-foreground">{alert.message}</p>
                    <div className="flex gap-4 mt-1 text-[10px] font-mono text-muted-foreground">
                      {alert.ip_address && <span>IP: {alert.ip_address}</span>}
                      <span>{new Date(alert.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      onClick={() => acknowledgeAlert.mutate(alert.id)}
                      className="shrink-0 text-muted-foreground hover:text-accent transition-colors"
                      title="Acknowledge"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Automated Security Scans (every 8 hours) */}
        {isSuperAdmin && (
          <div className="glass-panel p-4 sm:p-6 border border-primary/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <h2 className="text-xs sm:text-sm font-mono uppercase tracking-widest text-primary flex items-center gap-2">
                <Shield className="w-4 h-4 shrink-0" /> Automated Scans ({autoScans.length})
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">Every 8h</span>
                <button
                  onClick={async () => {
                    setIsRunningManualScan(true);
                    try {
                      await runAutoScan();
                      toast.success("Manual security scan completed");
                    } catch {
                      toast.error("Manual scan failed");
                    } finally {
                      setIsRunningManualScan(false);
                    }
                  }}
                  disabled={isRunningManualScan}
                  className="text-[10px] font-mono px-2 py-1 bg-secondary text-foreground rounded hover:bg-secondary/80 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isRunningManualScan ? "animate-spin" : ""}`} />
                  {isRunningManualScan ? "Scanning…" : "Run Now"}
                </button>
              </div>
            </div>

            {autoScans.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground">No automated scans yet — first scan will run shortly</p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-1 sm:pr-3">
                  {autoScans.map((scan) => (
                    <div key={scan.id} className="bg-secondary/50 rounded-lg p-3 border border-border">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(scan.ran_at).toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                          scan.scans.some((s) => s.status === "fail")
                            ? "bg-destructive/20 text-destructive"
                            : scan.scans.some((s) => s.status === "warn")
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-accent/20 text-accent"
                        }`}>
                          {scan.scans.some((s) => s.status === "fail")
                            ? "FAIL"
                            : scan.scans.some((s) => s.status === "warn")
                            ? "WARN"
                            : "PASS"}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {scan.scans.map((check) => (
                          <div key={check.id} className="flex items-start gap-2">
                            <span className="text-xs shrink-0">{scanStatusIcon(check.status)}</span>
                            <div className="flex-1 min-w-0">
                              <span className={`text-[10px] font-mono font-semibold ${scanStatusColor(check.status)} break-all`}>
                                {check.label}
                              </span>
                              <p className="text-[10px] font-mono text-muted-foreground break-words">
                                {check.summary}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

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
          <div className="flex flex-col gap-3 mb-4">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" /> Security Logs ({filteredLogs.length})
            </h2>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search IP, endpoint, event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-48"
                />
              </div>
              <div className="flex flex-wrap gap-1">
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
            <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
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
