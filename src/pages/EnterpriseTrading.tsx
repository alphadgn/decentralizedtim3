import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { Navigate } from "react-router-dom";
import {
  ArrowUpDown, Shield, Activity, FileCheck, Clock,
  TrendingUp, AlertTriangle, CheckCircle, Lock,
} from "lucide-react";

// ── Mock trade events ──────────────────────────────────────────────
function generateTradeEvents(epoch: number) {
  const exchanges = ["NYSE", "NASDAQ", "LSE", "TSE", "HKEX"];
  const pairs = ["BTC/USD", "ETH/USD", "SPY", "AAPL", "EUR/USD"];
  return Array.from({ length: 8 }, (_, i) => ({
    sequenceNumber: 948271030 + i,
    canonicalTimestamp: epoch - (i * 47),
    exchangeId: exchanges[i % exchanges.length],
    pair: pairs[i % pairs.length],
    side: i % 2 === 0 ? "BUY" : "SELL",
    signature: `0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
    verified: true,
  }));
}

// ── MEV status mock ────────────────────────────────────────────────
const MEV_COMMITS = [
  { id: "cmt-9a3b7c", exchange: "NYSE", status: "verified", latency: "12ms" },
  { id: "cmt-4d5e6f", exchange: "NASDAQ", status: "verified", latency: "8ms" },
  { id: "cmt-1g2h3i", exchange: "LSE", status: "pending", latency: "—" },
  { id: "cmt-7j8k9l", exchange: "TSE", status: "verified", latency: "23ms" },
  { id: "cmt-0m1n2o", exchange: "HKEX", status: "verified", latency: "15ms" },
];

// ── Latency fairness mock ──────────────────────────────────────────
const LATENCY_DATA = [
  { exchange: "NYSE", avgLatency: "4.2ms", p99: "12ms", fairness: 98.7, anomalies: 0 },
  { exchange: "NASDAQ", avgLatency: "3.8ms", p99: "9ms", fairness: 99.1, anomalies: 0 },
  { exchange: "LSE", avgLatency: "18.4ms", p99: "42ms", fairness: 96.2, anomalies: 1 },
  { exchange: "TSE", avgLatency: "22.1ms", p99: "55ms", fairness: 95.8, anomalies: 2 },
  { exchange: "HKEX", avgLatency: "19.7ms", p99: "38ms", fairness: 97.4, anomalies: 0 },
];

export default function EnterpriseTrading() {
  const { user, loading } = useAuth();
  const { epoch, signalBand } = useNetworkTime();
  const [activeTab, setActiveTab] = useState<"ordering" | "mev" | "latency" | "settlements">("ordering");
  const [tradeEvents, setTradeEvents] = useState(generateTradeEvents(epoch));

  useEffect(() => {
    setTradeEvents(generateTradeEvents(epoch));
  }, [Math.floor(epoch / 1000)]);

  if (!loading && !user) return <Navigate to="/" replace />;

  const tabs = [
    { id: "ordering" as const, label: "Trade Ordering", icon: ArrowUpDown },
    { id: "mev" as const, label: "MEV Protection", icon: Shield },
    { id: "latency" as const, label: "Latency Fairness", icon: Activity },
    { id: "settlements" as const, label: "Settlements", icon: FileCheck },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-mono font-bold text-foreground">Enterprise Trading</h1>
            <span className="bg-primary/20 text-primary text-[10px] font-mono font-bold px-2 py-0.5 rounded">LIVE</span>
          </div>
          <p className="text-sm font-mono text-muted-foreground">
            Deterministic trade ordering, MEV protection, and settlement proofs
          </p>
        </motion.div>

        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Clock, label: "Canonical Time", value: new Date(epoch).toISOString().slice(11, 23), accent: "neon-text-cyan" },
            { icon: TrendingUp, label: "Signal", value: signalBand, accent: "neon-text-green" },
            { icon: Shield, label: "MEV Commits", value: `${MEV_COMMITS.filter((c) => c.status === "verified").length}/${MEV_COMMITS.length}`, accent: "neon-text-green" },
            { icon: Lock, label: "Settlement Proofs", value: "1,482", accent: "neon-text-cyan" },
          ].map((s) => (
            <div key={s.label} className="glass-panel p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <s.icon className="w-3.5 h-3.5" />
                <span className="text-[10px] font-mono uppercase tracking-wider">{s.label}</span>
              </div>
              <span className={`font-mono text-lg font-semibold ${s.accent}`}>{s.value}</span>
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

        {/* Trade Ordering */}
        {activeTab === "ordering" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-5 overflow-x-auto">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Global Trade Event Ordering — Live Feed
            </h2>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-3">Seq #</th>
                  <th className="text-left pb-2 pr-3">Canonical Time</th>
                  <th className="text-left pb-2 pr-3">Exchange</th>
                  <th className="text-left pb-2 pr-3">Pair</th>
                  <th className="text-left pb-2 pr-3">Side</th>
                  <th className="text-left pb-2 pr-3">Signature</th>
                  <th className="text-left pb-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {tradeEvents.map((ev) => (
                  <tr key={ev.sequenceNumber} className="border-b border-border/30">
                    <td className="py-2 pr-3 text-primary font-semibold">{ev.sequenceNumber}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{new Date(ev.canonicalTimestamp).toISOString().slice(11, 23)}</td>
                    <td className="py-2 pr-3 text-foreground">{ev.exchangeId}</td>
                    <td className="py-2 pr-3 text-foreground">{ev.pair}</td>
                    <td className="py-2 pr-3">
                      <span className={ev.side === "BUY" ? "text-accent" : "text-destructive"}>{ev.side}</span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{ev.signature}</td>
                    <td className="py-2">
                      <CheckCircle className="w-3.5 h-3.5 text-accent" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* MEV Protection */}
        {activeTab === "mev" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Cryptographic Time Commitments
              </h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Commit-reveal protocol prevents front-running and trade reordering. Exchanges submit commitment hashes before execution.
              </p>
              <div className="bg-secondary/40 rounded-lg p-4 text-xs font-mono text-muted-foreground mb-4">
                <span className="text-primary">commitHash</span> = hash(orderData + canonicalTimestamp)
              </div>
            </div>
            {MEV_COMMITS.map((c) => (
              <div key={c.id} className="glass-panel p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {c.status === "verified" ? (
                    <CheckCircle className="w-4 h-4 text-accent" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-primary" />
                  )}
                  <div>
                    <div className="text-sm font-mono text-foreground">{c.exchange}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{c.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-muted-foreground">{c.latency}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    c.status === "verified" ? "bg-accent/20 text-accent" : "bg-primary/20 text-primary"
                  }`}>{c.status}</span>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Latency Fairness */}
        {activeTab === "latency" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-5 overflow-x-auto">
            <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Latency Fairness Report
            </h2>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left pb-2 pr-4">Exchange</th>
                  <th className="text-left pb-2 pr-4">Avg Latency</th>
                  <th className="text-left pb-2 pr-4">P99</th>
                  <th className="text-left pb-2 pr-4">Fairness Score</th>
                  <th className="text-left pb-2">Anomalies</th>
                </tr>
              </thead>
              <tbody>
                {LATENCY_DATA.map((d) => (
                  <tr key={d.exchange} className="border-b border-border/30">
                    <td className="py-2 pr-4 text-foreground font-semibold">{d.exchange}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{d.avgLatency}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{d.p99}</td>
                    <td className="py-2 pr-4">
                      <span className={d.fairness >= 97 ? "text-accent" : "text-primary"}>{d.fairness}%</span>
                    </td>
                    <td className="py-2">
                      {d.anomalies > 0 ? (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="w-3 h-3" /> {d.anomalies}
                        </span>
                      ) : (
                        <span className="text-accent">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {/* Settlement Proofs */}
        {activeTab === "settlements" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Settlement Certificates
              </h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Verifiable settlement proofs anchored to blockchain for regulatory compliance and audit trails.
              </p>
            </div>
            {[
              {
                id: "STL-948271039",
                timestamp: epoch - 3000,
                seqNum: 948271039,
                exchange: "NYSE",
                chain: "Ethereum",
                block: 19421042,
              },
              {
                id: "STL-948271038",
                timestamp: epoch - 33000,
                seqNum: 948271038,
                exchange: "NASDAQ",
                chain: "Ethereum",
                block: 19421040,
              },
              {
                id: "STL-948271037",
                timestamp: epoch - 63000,
                seqNum: 948271037,
                exchange: "LSE",
                chain: "Polygon",
                block: 54210012,
              },
            ].map((s) => (
              <div key={s.id} className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-accent" />
                    <span className="text-sm font-mono font-semibold text-foreground">{s.id}</span>
                  </div>
                  <span className="bg-accent/20 text-accent text-[10px] font-mono font-bold px-2 py-0.5 rounded">Verified</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
                  <div>
                    <div className="text-muted-foreground">Settlement Time</div>
                    <div className="text-foreground">{new Date(s.timestamp).toISOString().slice(11, 23)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Sequence #</div>
                    <div className="text-primary">{s.seqNum}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Exchange</div>
                    <div className="text-foreground">{s.exchange}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Blockchain</div>
                    <div className="text-foreground">{s.chain}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Block</div>
                    <div className="text-foreground">#{s.block}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Proof Hash</div>
                    <div className="text-muted-foreground">0x{Math.random().toString(16).slice(2, 10)}...</div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
