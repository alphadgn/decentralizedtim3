import { useParams, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type DailyScanStatus = "pass" | "warn" | "fail";

type AutoScanResult = {
  id: string;
  ran_at: string;
  scans: {
    id: string;
    label: string;
    status: DailyScanStatus;
    summary: string;
  }[];
};

const AUTO_SCAN_STORAGE_KEY = "dgtn_auto_scans";

function loadStoredScans(): AutoScanResult[] {
  try {
    const raw = localStorage.getItem(AUTO_SCAN_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const statusConfig = {
  pass: {
    icon: CheckCircle,
    label: "PASSED",
    color: "text-accent",
    bg: "bg-accent/10 border-accent/20",
    badgeBg: "bg-accent/20 text-accent",
  },
  warn: {
    icon: AlertTriangle,
    label: "WARNING",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/20",
    badgeBg: "bg-yellow-500/20 text-yellow-400",
  },
  fail: {
    icon: XCircle,
    label: "FAILED",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/20",
    badgeBg: "bg-destructive/20 text-destructive",
  },
};

export default function ScanDetail() {
  const { scanId } = useParams<{ scanId: string }>();
  const { user, isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [scan, setScan] = useState<AutoScanResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const scans = loadStoredScans();
    const found = scans.find((s) => s.id === scanId);
    if (found) {
      setScan(found);
    } else {
      setNotFound(true);
    }
  }, [scanId]);

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  if (notFound) {
    return (
      <div className="min-h-screen bg-background grid-bg">
        <Header />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-8">
          <BackToDashboard />
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-xl font-mono font-bold text-foreground mb-2">Scan Not Found</h1>
            <p className="text-sm font-mono text-muted-foreground mb-6">
              This scan may have been cleared from local storage.
            </p>
            <button
              onClick={() => navigate("/security")}
              className="text-sm font-mono px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Back to Security Monitor
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!scan) return null;

  const overallStatus: DailyScanStatus = scan.scans.some((s) => s.status === "fail")
    ? "fail"
    : scan.scans.some((s) => s.status === "warn")
    ? "warn"
    : "pass";

  const overallConfig = statusConfig[overallStatus];
  const OverallIcon = overallConfig.icon;

  const passCount = scan.scans.filter((s) => s.status === "pass").length;
  const warnCount = scan.scans.filter((s) => s.status === "warn").length;
  const failCount = scan.scans.filter((s) => s.status === "fail").length;

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <BackToDashboard />

        {/* Back to Security */}
        <button
          onClick={() => navigate("/security")}
          className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Security Monitor
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`glass-panel p-5 sm:p-6 border ${overallConfig.bg}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <OverallIcon className={`w-6 h-6 ${overallConfig.color}`} />
                <div>
                  <h1 className="text-lg sm:text-xl font-mono font-bold text-foreground">
                    Security Scan Report
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">
                      {new Date(scan.ran_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-lg ${overallConfig.badgeBg}`}>
                {overallConfig.label}
              </span>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-lg font-mono font-bold text-accent">{passCount}</span>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Passed</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-lg font-mono font-bold text-yellow-400">{warnCount}</span>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Warnings</p>
              </div>
              <div className="bg-background/50 rounded-lg p-3 text-center">
                <span className="text-lg font-mono font-bold text-destructive">{failCount}</span>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Failed</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Individual scan checks */}
        <div className="space-y-3">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
            Scan Checks ({scan.scans.length})
          </h2>

          {scan.scans.map((check, index) => {
            const config = statusConfig[check.status];
            const Icon = config.icon;

            return (
              <motion.div
                key={check.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`glass-panel p-4 sm:p-5 border ${config.bg}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h3 className="text-sm font-mono font-bold text-foreground break-words">
                        {check.label}
                      </h3>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${config.badgeBg}`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-muted-foreground break-words">
                      {check.summary}
                    </p>

                    {/* Extended details per check type */}
                    <div className="mt-3 pt-3 border-t border-border">
                      {check.id === "hash_chain_integrity" && (
                        <div className="space-y-1.5">
                          <DetailRow label="Check Type" value="Hash-Chain Integrity Verification" />
                          <DetailRow label="Algorithm" value="SHA-256 chained hashing" />
                          <DetailRow label="Scope" value="All security log entries" />
                          <DetailRow
                            label="Result"
                            value={check.status === "pass" ? "All entries verified — no tampering detected" : "Tampered entries detected — investigate immediately"}
                          />
                          <DetailRow label="Protection" value="Immutable append-only ledger with cryptographic linking" />
                        </div>
                      )}
                      {check.id === "blockchain_testnet_anchors" && (
                        <div className="space-y-1.5">
                          <DetailRow label="Check Type" value="Blockchain Testnet Anchor Verification" />
                          <DetailRow label="Chains Monitored" value="Ethereum Sepolia, Solana Devnet, Polygon Amoy" />
                          <DetailRow
                            label="Result"
                            value={check.status === "pass" ? "All chains anchored and synced" : "One or more chains require re-synchronization"}
                          />
                          <DetailRow label="Anchor Method" value="Merkle root commitment to on-chain smart contracts" />
                          <DetailRow label="Verification" value="Cross-chain consensus hash comparison" />
                        </div>
                      )}
                      {check.id === "daily_critical_alerts" && (
                        <div className="space-y-1.5">
                          <DetailRow label="Check Type" value="Daily Critical Alert Audit" />
                          <DetailRow label="Time Window" value="Current UTC day (00:00 — now)" />
                          <DetailRow
                            label="Result"
                            value={check.status === "pass" ? "Zero critical alerts recorded today" : "Critical alerts detected — review Security Alerts section"}
                          />
                          <DetailRow label="Alert Sources" value="Honeypot hits, hash-chain tampering, rate-limit violations" />
                          <DetailRow label="Response Protocol" value="Auto-block + real-time notification to super-admin" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Scan metadata */}
        <div className="glass-panel p-4 sm:p-5">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Scan Metadata
          </h2>
          <div className="space-y-1.5">
            <DetailRow label="Scan ID" value={scan.id} />
            <DetailRow label="Executed At" value={new Date(scan.ran_at).toISOString()} />
            <DetailRow label="Scan Type" value="Automated (8-hour interval)" />
            <DetailRow label="Checks Performed" value={String(scan.scans.length)} />
            <DetailRow label="Storage" value="Client-side (localStorage)" />
            <DetailRow label="Retention" value="Last 15 scans" />
          </div>
        </div>

        <footer className="text-center py-6 text-xs font-mono text-muted-foreground">
          DGTN Protocol — Security Scan Report
        </footer>
      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
      <span className="text-[10px] font-mono text-muted-foreground shrink-0 sm:w-36">{label}:</span>
      <span className="text-[10px] font-mono text-foreground break-all">{value}</span>
    </div>
  );
}
