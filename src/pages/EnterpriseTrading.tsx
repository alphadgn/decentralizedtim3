import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { BackToDashboard } from "@/components/BackToDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { Navigate } from "react-router-dom";
import {
  ArrowUpDown, Shield, Activity, FileCheck, Clock,
  TrendingUp, AlertTriangle, CheckCircle, Lock, Globe, Code,
  Layers, GitBranch, Cpu, Fingerprint, HardDrive, ShieldCheck, BookOpen,
  Eye, Radio, KeyRound,
} from "lucide-react";

// ── Mock trade events ──
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
    fairnessScore: (0.85 + Math.random() * 0.15).toFixed(4),
    validatorCount: 13,
    orderingMethod: "median_receive_time_consensus",
    merkleRoot: `0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
    dilithiumSigned: true,
  }));
}

const MEV_COMMITS = [
  { id: "cmt-9a3b7c", exchange: "NYSE", status: "verified", latency: "12ms" },
  { id: "cmt-4d5e6f", exchange: "NASDAQ", status: "verified", latency: "8ms" },
  { id: "cmt-1g2h3i", exchange: "LSE", status: "pending", latency: "—" },
  { id: "cmt-7j8k9l", exchange: "TSE", status: "verified", latency: "23ms" },
  { id: "cmt-0m1n2o", exchange: "HKEX", status: "verified", latency: "15ms" },
];

const LATENCY_DATA = [
  { exchange: "NYSE", avgLatency: "4.2ms", p99: "12ms", fairness: 98.7, anomalies: 0 },
  { exchange: "NASDAQ", avgLatency: "3.8ms", p99: "9ms", fairness: 99.1, anomalies: 0 },
  { exchange: "LSE", avgLatency: "18.4ms", p99: "42ms", fairness: 96.2, anomalies: 1 },
  { exchange: "TSE", avgLatency: "22.1ms", p99: "55ms", fairness: 95.8, anomalies: 2 },
  { exchange: "HKEX", avgLatency: "19.7ms", p99: "38ms", fairness: 97.4, anomalies: 0 },
];

const VALIDATOR_REGIONS = [
  { region: "us-east", validators: 2, avgPropMs: 2.1, status: "active" },
  { region: "us-west", validators: 2, avgPropMs: 15.3, status: "active" },
  { region: "eu-west", validators: 2, avgPropMs: 45.2, status: "active" },
  { region: "eu-central", validators: 1, avgPropMs: 50.8, status: "active" },
  { region: "asia-east", validators: 2, avgPropMs: 81.4, status: "active" },
  { region: "asia-south", validators: 1, avgPropMs: 89.7, status: "active" },
  { region: "oceania", validators: 1, avgPropMs: 112.3, status: "active" },
  { region: "south-america", validators: 1, avgPropMs: 96.1, status: "active" },
];

const GMC_API_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/gmc/commit_trade",
    description: "Submit a trade commitment with post-quantum cryptographic proof and latency-neutral ordering",
    body: `{
  "exchange_id": "NYSE",
  "trade_id": "TRD-2026-001",
  "trade_hash": "sha256(trade_payload)",
  "client_signature": "0x...",
  "nonce": "unique-nonce-value"
}`,
    response: `{
  "event_hash": "a1b2c3...",
  "sequence_number": 1,
  "canonical_timestamp": 1773456789000,
  "ordering_hash": "d4e5f6...",
  "validator_signatures": [...],
  "latency_neutral": {
    "median_receive_time": 1773456789045,
    "fairness_score": 0.9234,
    "ordering_method": "median_receive_time_consensus",
    "geographic_distribution": [...]
  },
  "post_quantum": {
    "algorithm": "CRYSTALS-Dilithium3",
    "nist_level": 3,
    "attestation_count": 13
  },
  "hardware_root_of_trust": {
    "trust_chain_verified": true,
    "root_type": "TPM",
    "hsm_signing": { "algorithm": "ECDSA-P384" },
    "enclave": { "technology": "Intel SGX", "tcb_status": "UpToDate" },
    "fips_140_3_level": 3
  },
  "formal_verification": {
    "all_properties_hold": true,
    "verified_properties": 15,
    "invariants_holding": 8
  },
  "status": "committed"
}`,
  },
  {
    method: "POST",
    path: "/api/gmc/verify_timestamp",
    description: "Verify a committed trade timestamp with Merkle inclusion and blockchain anchor proof",
    body: `{
  "event_hash": "a1b2c3...",
  "timestamp": 1773456789000
}`,
    response: `{
  "verified": true,
  "integrity_valid": true,
  "timestamp_match": true,
  "merkle_verified": true,
  "merkle_root": "f7g8h9...",
  "blockchain_anchor_ref": "ethereum:19421042:0x...",
  "validator_count": 13,
  "post_quantum_verified": true
}`,
  },
  {
    method: "GET",
    path: "/api/gmc/event_proof/{event_hash}",
    description: "Retrieve full verification bundle with Merkle proof, blockchain anchor, and post-quantum attestations",
    body: null,
    response: `{
  "event_hash": "a1b2c3...",
  "verification_bundle": {
    "event_integrity": true,
    "merkle_inclusion": true,
    "blockchain_anchored": true,
    "validator_consensus": 13,
    "post_quantum_signed": true,
    "proof_complete": true
  },
  "merkle_proof": {
    "root": "...",
    "proof": [...],
    "tree_depth": 4
  },
  "blockchain_anchor": {
    "blockchain": "ethereum",
    "block_number": 19421042,
    "tx_hash": "0x..."
  },
  "post_quantum_attestations": [...]
}`,
  },
  {
    method: "GET",
    path: "/api/gmc/ledger_block/{batch_id}",
    description: "Query deterministically ordered event batches with Merkle roots",
    body: null,
    response: `{
  "batch_id": "latest",
  "merkle_root": "...",
  "tree_depth": 6,
  "event_count": 50,
  "anchored_count": 48,
  "events": [...]
}`,
  },
];

export default function EnterpriseTrading() {
  const { user, loading } = useAuth();
  const { epoch, signalBand } = useNetworkTime();
  const [activeTab, setActiveTab] = useState<"ordering" | "mev" | "latency" | "settlements" | "merkle" | "pq-crypto" | "hw-rot" | "formal-verify" | "gmc-api">("ordering");
  const [tradeEvents, setTradeEvents] = useState(generateTradeEvents(epoch));

  useEffect(() => {
    setTradeEvents(generateTradeEvents(epoch));
  }, [Math.floor(epoch / 1000)]);

  if (!loading && !user) return <Navigate to="/" replace />;

  const tabs = [
    { id: "ordering" as const, label: "Trade Ordering", icon: ArrowUpDown },
    { id: "mev" as const, label: "MEV Protection", icon: Shield },
    { id: "latency" as const, label: "Latency Fairness", icon: Activity },
    { id: "merkle" as const, label: "Merkle Ledger", icon: GitBranch },
    { id: "pq-crypto" as const, label: "Post-Quantum", icon: Fingerprint },
    { id: "hw-rot" as const, label: "Hardware RoT", icon: HardDrive },
    { id: "formal-verify" as const, label: "Formal Proofs", icon: BookOpen },
    { id: "settlements" as const, label: "Settlements", icon: FileCheck },
    { id: "gmc-api" as const, label: "GMC API", icon: Globe },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <BackToDashboard />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-2xl font-mono font-bold text-foreground text-center">Enterprise Trading</h1>
            <span className="bg-primary/20 text-primary text-[10px] font-mono font-bold px-2 py-0.5 rounded">LIVE</span>
          </div>
          <p className="text-sm font-mono text-muted-foreground text-center">
            Global Market Clock — Deterministic trade ordering with post-quantum cryptographic verification
          </p>
        </motion.div>

        {/* Live stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Clock, label: "Canonical Time", value: new Date(epoch).toISOString().slice(11, 23), accent: "neon-text-cyan" },
            { icon: TrendingUp, label: "Signal", value: signalBand, accent: "neon-text-green" },
            { icon: Fingerprint, label: "PQ Signatures", value: "Dilithium3", accent: "neon-text-green" },
            { icon: Layers, label: "Validators", value: "13 / 8 regions", accent: "neon-text-cyan" },
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Latency-Neutral Info Banner */}
            <div className="glass-panel p-4 border-l-2 border-primary">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono font-semibold text-foreground">Latency-Neutral Ordering Active</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">
                Events ordered by median receive-time consensus across 13 validators in 8 geographic regions.
                Eliminates network proximity advantage for fair global ordering.
              </p>
              <div className="flex gap-4 mt-2">
                <span className="text-[10px] font-mono text-primary">Method: median_receive_time_consensus</span>
                <span className="text-[10px] font-mono text-accent">Crypto: CRYSTALS-Dilithium3</span>
              </div>
            </div>

            <div className="glass-panel p-5 overflow-x-auto">
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
                    <th className="text-left pb-2 pr-3">Fairness</th>
                    <th className="text-left pb-2 pr-3">Validators</th>
                    <th className="text-left pb-2 pr-3">PQ Signed</th>
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
                      <td className="py-2 pr-3 text-accent">{ev.fairnessScore}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{ev.validatorCount}</td>
                      <td className="py-2 pr-3">
                        <Fingerprint className="w-3 h-3 text-primary" />
                      </td>
                      <td className="py-2">
                        <CheckCircle className="w-3.5 h-3.5 text-accent" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {/* Geographic Validator Distribution */}
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Geographic Validator Distribution — Latency-Neutral Ordering
              </h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                13 validators across 8 regions compute independent receive times. The canonical timestamp is the <span className="text-primary">median</span> of all observations, eliminating geographic proximity advantages.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {VALIDATOR_REGIONS.map((r) => (
                  <div key={r.region} className="bg-secondary/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-semibold text-foreground uppercase">{r.region}</span>
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
                      {r.validators} validator{r.validators > 1 ? "s" : ""} · {r.avgPropMs}ms avg
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 text-[10px] font-mono text-muted-foreground">
                <span className="text-primary">Ordering Algorithm:</span>{" "}
                canonical_timestamp = median(validator_receive_times) → ordering_hash → sequence_number
              </div>
            </div>

            {/* Exchange Latency Table */}
            <div className="glass-panel p-5 overflow-x-auto">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Exchange Latency Fairness Report
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
            </div>
          </motion.div>
        )}

        {/* Merkle Ledger */}
        {activeTab === "merkle" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Merkle Event Ledger — Phase 6
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Trade events are batched into binary Merkle trees. Each batch's root hash is anchored to blockchain testnets
                (Ethereum Sepolia, Solana Devnet, Polygon Amoy) for permanent public verification.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-secondary/40 rounded-lg p-4">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Batch Size</div>
                  <div className="text-lg font-mono font-semibold text-foreground">16–64 events</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Auto-batch on threshold</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-4">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Proof Type</div>
                  <div className="text-lg font-mono font-semibold text-primary">Inclusion Proof</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Per-event Merkle path</div>
                </div>
                <div className="bg-secondary/40 rounded-lg p-4">
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Anchor Chains</div>
                  <div className="text-lg font-mono font-semibold text-accent">3 Testnets</div>
                  <div className="text-[10px] font-mono text-muted-foreground">ETH + SOL + MATIC</div>
                </div>
              </div>
              <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Merkle Tree Structure</div>
                <pre className="text-[10px] font-mono text-foreground whitespace-pre overflow-x-auto">{`         [Root Hash]
        /           \\
    [H(0,1)]     [H(2,3)]
    /    \\       /    \\
  [E0]  [E1]  [E2]  [E3]`}</pre>
                <div className="text-[10px] font-mono text-muted-foreground mt-2">
                  Each leaf = SHA-256(event_hash). Internal nodes = SHA-256(left : right).
                  Inclusion proof = sibling hashes along path to root.
                </div>
              </div>
            </div>

            {/* Verification Bundle */}
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-accent" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Verification Bundle — Phase 7
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Each event can produce a complete verification bundle proving its position in the global ordering.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Event Integrity", desc: "Ordering hash re-computed", icon: CheckCircle, color: "text-accent" },
                  { label: "Merkle Inclusion", desc: "Proof verified against root", icon: GitBranch, color: "text-primary" },
                  { label: "Blockchain Anchor", desc: "Root anchored to testnet", icon: Lock, color: "text-accent" },
                  { label: "Validator Consensus", desc: "13 PQ-signed attestations", icon: Fingerprint, color: "text-primary" },
                ].map((v) => (
                  <div key={v.label} className="bg-secondary/40 rounded-lg p-3">
                    <v.icon className={`w-4 h-4 ${v.color} mb-2`} />
                    <div className="text-xs font-mono font-semibold text-foreground">{v.label}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{v.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Post-Quantum Crypto */}
        {activeTab === "pq-crypto" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <Fingerprint className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Post-Quantum Cryptographic Signatures — Phase 11
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                All validator attestations and event commitments are signed with NIST-standardized
                post-quantum algorithms, providing resilience against quantum computing attacks.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Dilithium */}
                <div className="bg-secondary/40 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span className="text-sm font-mono font-semibold text-foreground">CRYSTALS-Dilithium3</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-foreground">Lattice-based Digital Signature</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NIST Level</span>
                      <span className="text-primary font-bold">3 (128-bit quantum security)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Public Key Size</span>
                      <span className="text-foreground">6,528 bits (1,952 bytes)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Signature Size</span>
                      <span className="text-foreground">3,293 bytes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usage</span>
                      <span className="text-accent">Validator Attestations</span>
                    </div>
                  </div>
                </div>

                {/* Kyber */}
                <div className="bg-secondary/40 rounded-lg p-4 border border-accent/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-accent" />
                    <span className="text-sm font-mono font-semibold text-foreground">CRYSTALS-Kyber768</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-foreground">Lattice-based Key Encapsulation</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NIST Level</span>
                      <span className="text-primary font-bold">3 (128-bit quantum security)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ciphertext Size</span>
                      <span className="text-foreground">1,088 bytes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shared Secret</span>
                      <span className="text-foreground">32 bytes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Usage</span>
                      <span className="text-accent">Secure Validator Channels</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attestation Flow */}
              <div className="bg-secondary/30 rounded-lg p-4">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
                  Post-Quantum Attestation Flow
                </div>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">1.</span>
                    <span className="text-foreground">Trade event received by each geographic validator</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">2.</span>
                    <span className="text-foreground">Validator computes receive-time and signs with <span className="text-accent">Dilithium3</span> private key</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">3.</span>
                    <span className="text-foreground">Secure channel via <span className="text-accent">Kyber768</span> key encapsulation for attestation transmission</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">4.</span>
                    <span className="text-foreground">Median receive-time computed → canonical timestamp established</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">5.</span>
                    <span className="text-foreground">All 13 post-quantum attestations included in verification bundle</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Validators */}
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Post-Quantum Validator Network
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {VALIDATOR_REGIONS.map((r) => (
                  <div key={r.region} className="bg-secondary/40 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono font-semibold text-foreground uppercase">{r.region}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {r.validators} validator{r.validators > 1 ? "s" : ""} · Dilithium3 + Kyber768
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{r.avgPropMs}ms</span>
                      <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Hardware Root of Trust */}
        {activeTab === "hw-rot" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <HardDrive className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Hardware Root of Trust — Phase 13
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Cryptographic keys are stored in FIPS 140-3 Level 3 HSMs. Platform integrity verified via TPM 2.0
                measured boot. Critical operations execute inside Intel SGX / AMD SEV secure enclaves.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* HSM */}
                <div className="bg-secondary/40 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Lock className="w-4 h-4 text-primary" />
                    <span className="text-xs font-mono font-semibold text-foreground">HSM Signing</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-muted-foreground">Manufacturer</span><span className="text-foreground">Thales Luna 7</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">FIPS Level</span><span className="text-primary font-bold">140-3 Level 3</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Algorithm</span><span className="text-foreground">ECDSA-P384</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Key Extractable</span><span className="text-destructive font-bold">NEVER</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Ops/sec</span><span className="text-accent">20,000</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Regions</span><span className="text-foreground">3 (US, EU, AP)</span></div>
                  </div>
                </div>

                {/* TPM */}
                <div className="bg-secondary/40 rounded-lg p-4 border border-accent/20">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    <span className="text-xs font-mono font-semibold text-foreground">TPM Attestation</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="text-foreground">TPM 2.0</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Measured Boot</span><span className="text-accent font-bold">Verified</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PCR Registers</span><span className="text-foreground">8 (PCR0–PCR7)</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">AIK Signing</span><span className="text-foreground">TPM2_Quote</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Sealed Secrets</span><span className="text-primary">Per-enclave</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="text-accent">Active</span></div>
                  </div>
                </div>

                {/* Secure Enclave */}
                <div className="bg-secondary/40 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Cpu className="w-4 h-4 text-primary" />
                    <span className="text-xs font-mono font-semibold text-foreground">Secure Enclaves</span>
                  </div>
                  <div className="space-y-2 text-[10px] font-mono">
                    <div className="flex justify-between"><span className="text-muted-foreground">Technology</span><span className="text-foreground">Intel SGX / AMD SEV</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Attestation</span><span className="text-foreground">DCAP / SEV-SNP</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">TCB Status</span><span className="text-accent font-bold">UpToDate</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Debug Mode</span><span className="text-destructive font-bold">DISABLED</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Memory</span><span className="text-foreground">256 MB EPC</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Seal Policy</span><span className="text-primary">MRENCLAVE</span></div>
                  </div>
                </div>
              </div>

              {/* Trust Chain */}
              <div className="bg-secondary/30 rounded-lg p-4">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
                  Hardware Trust Chain Verification
                </div>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">1.</span>
                    <span className="text-foreground"><span className="text-accent">TPM 2.0</span> verifies platform integrity via measured boot (PCR0–PCR7)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">2.</span>
                    <span className="text-foreground"><span className="text-accent">HSM</span> stores validator signing keys (FIPS 140-3 Level 3, non-extractable)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">3.</span>
                    <span className="text-foreground"><span className="text-accent">Intel SGX</span> enclave executes consensus logic in isolated memory</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">4.</span>
                    <span className="text-foreground">Remote attestation proves code integrity (MRENCLAVE) to all parties</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-primary font-bold w-4">5.</span>
                    <span className="text-foreground">Trust chain: TPM Root → HSM Key Attestation → Enclave Quote → Event Signature</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance */}
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Hardware Security Compliance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "FIPS 140-3 Level 3", desc: "HSM certification", verified: true },
                  { label: "Common Criteria EAL4+", desc: "Hardware evaluation", verified: true },
                  { label: "PCI HSM", desc: "Payment industry standard", verified: true },
                  { label: "NIST SP 800-57", desc: "Key management", verified: true },
                ].map((c) => (
                  <div key={c.label} className="bg-secondary/40 rounded-lg p-3">
                    <div className="flex items-center gap-1 mb-1">
                      <CheckCircle className="w-3 h-3 text-accent" />
                      <span className="text-[10px] font-mono font-semibold text-foreground">{c.label}</span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Formal Verification */}
        {activeTab === "formal-verify" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Formal Verification — Phase 14
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Mathematical proofs guarantee protocol correctness, consensus safety, and liveness.
                Specifications are modeled in TLA+, Isabelle/HOL, Coq, and Lean4.
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Properties Proven", value: "15 / 15", color: "text-accent" },
                  { label: "Invariants Holding", value: "8 / 8", color: "text-accent" },
                  { label: "Model States", value: "9.4M+", color: "text-primary" },
                  { label: "Coverage", value: "94.7%", color: "text-primary" },
                ].map((s) => (
                  <div key={s.label} className="bg-secondary/40 rounded-lg p-3">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
                    <div className={`text-lg font-mono font-semibold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Formal Specs */}
              <div className="space-y-3">
                {[
                  { component: "Trade Commitment Protocol", lang: "TLA+", props: 3, proven: 3, categories: ["safety", "liveness"] },
                  { component: "Latency-Neutral Ordering", lang: "Isabelle/HOL", props: 3, proven: 3, categories: ["fairness", "correctness", "safety"] },
                  { component: "Merkle Event Ledger", lang: "Coq", props: 3, proven: 3, categories: ["integrity", "liveness"] },
                  { component: "Consensus Algorithm", lang: "Lean4", props: 3, proven: 3, categories: ["safety", "liveness", "correctness"] },
                  { component: "Hash Chain Integrity", lang: "TLA+", props: 2, proven: 2, categories: ["integrity", "safety"] },
                ].map((spec) => (
                  <div key={spec.component} className="bg-secondary/40 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-mono font-semibold text-foreground">{spec.component}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-primary/20 text-primary px-2 py-0.5 rounded">{spec.lang}</span>
                        <span className="text-[10px] font-mono text-accent">{spec.proven}/{spec.props} proven</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {spec.categories.map((cat) => (
                        <span key={cat} className="text-[9px] font-mono bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded">{cat}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Consensus Safety Proofs */}
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Consensus Safety Theorems
              </h2>
              <div className="space-y-3">
                {[
                  { theorem: "Agreement", desc: "No two correct validators decide differently", technique: "Contradiction", states: "2.8M" },
                  { theorem: "Termination", desc: "Every correct validator eventually decides", technique: "Induction", states: "1.5M" },
                  { theorem: "Validity", desc: "Decided value was proposed by a correct validator", technique: "Model checking", states: "4.2M" },
                  { theorem: "Deterministic Ordering", desc: "Total order on events is unique and reproducible", technique: "Refinement", states: "892K" },
                ].map((p) => (
                  <div key={p.theorem} className="bg-secondary/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-mono font-semibold text-foreground">{p.theorem}</span>
                      </div>
                      <span className="text-[10px] font-mono text-accent">✓ PROVEN</span>
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mb-1">{p.desc}</p>
                    <div className="flex gap-3 text-[9px] font-mono text-muted-foreground">
                      <span>Technique: <span className="text-primary">{p.technique}</span></span>
                      <span>States: <span className="text-primary">{p.states}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Protocol Invariants */}
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Protocol Invariants
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { name: "Total Order", expr: "∀ e1, e2: seq(e1) < seq(e2) ∨ seq(e1) > seq(e2) ∨ e1 = e2", cat: "safety" },
                  { name: "Nonce Uniqueness", expr: "∀ n1, n2: n1.hash = n2.hash ⟹ n1 = n2", cat: "safety" },
                  { name: "Merkle Consistency", expr: "|B.leaves| ≥ 16 ∧ depth = ⌈log₂(|leaves|)⌉", cat: "correctness" },
                  { name: "Validator Quorum", expr: "|signers(d)| ≥ 2f + 1 where f = 4", cat: "safety" },
                  { name: "Timestamp Monotonicity", expr: "canonical_ts(eᵢ) ≤ canonical_ts(eᵢ₊₁)", cat: "correctness" },
                  { name: "Anchor Durability", expr: "∃ chain: verifiable(root, chain) ≥ 1yr", cat: "liveness" },
                  { name: "Fairness Bound", expr: "|influence(v) − 1/n| ≤ ε(n), ε → 0", cat: "fairness" },
                  { name: "PQ Binding", expr: "Dilithium3.Verify(pk, msg, sig) = true", cat: "integrity" },
                ].map((inv) => (
                  <div key={inv.name} className="bg-secondary/40 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle className="w-3 h-3 text-accent mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-semibold text-foreground">{inv.name}</span>
                        <span className="text-[9px] font-mono bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded">{inv.cat}</span>
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground break-all">{inv.expr}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                Verifiable settlement proofs anchored to blockchain with Merkle inclusion and post-quantum signatures for regulatory compliance.
              </p>
            </div>
            {[
              { id: "STL-948271039", timestamp: epoch - 3000, seqNum: 948271039, exchange: "NYSE", chain: "Ethereum", block: 19421042, merkleVerified: true, pqSigned: true },
              { id: "STL-948271038", timestamp: epoch - 33000, seqNum: 948271038, exchange: "NASDAQ", chain: "Ethereum", block: 19421040, merkleVerified: true, pqSigned: true },
              { id: "STL-948271037", timestamp: epoch - 63000, seqNum: 948271037, exchange: "LSE", chain: "Polygon", block: 54210012, merkleVerified: true, pqSigned: true },
            ].map((s) => (
              <div key={s.id} className="glass-panel p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-accent" />
                    <span className="text-sm font-mono font-semibold text-foreground">{s.id}</span>
                  </div>
                  <span className="bg-accent/20 text-accent text-[10px] font-mono font-bold px-2 py-0.5 rounded">Verified</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
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
                    <div className="text-foreground">{s.chain} #{s.block}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Merkle Proof</div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-accent" />
                      <span className="text-accent">Verified</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">PQ Signature</div>
                    <div className="flex items-center gap-1">
                      <Fingerprint className="w-3 h-3 text-primary" />
                      <span className="text-primary">Dilithium3</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* GMC API Reference */}
        {activeTab === "gmc-api" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
                  Global Market Clock API
                </h2>
              </div>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Cryptographically verifiable trade ordering endpoints with post-quantum signatures, Merkle proofs, and blockchain anchoring. All requests require an Enterprise API key with HMAC-SHA256 request signing.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Latency-Neutral Ordering", icon: Globe },
                  { label: "Merkle Event Ledger", icon: GitBranch },
                  { label: "Post-Quantum Signatures", icon: Fingerprint },
                  { label: "Hardware Root of Trust", icon: HardDrive },
                  { label: "Formal Verification", icon: BookOpen },
                  { label: "Blockchain Anchoring", icon: Lock },
                ].map((f) => (
                  <div key={f.label} className="bg-secondary/40 rounded-lg p-3 flex items-center gap-2">
                    <f.icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-[10px] font-mono text-foreground">{f.label}</span>
                  </div>
                ))}
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 text-[10px] font-mono text-muted-foreground">
                <span className="text-primary">Ordering Rule:</span>{" "}
                median_receive_time_consensus → ordering_hash → sequence_number |{" "}
                <span className="text-accent">Crypto:</span> Dilithium3 + Kyber768 |{" "}
                <span className="text-accent">HW:</span> HSM + SGX |{" "}
                <span className="text-accent">Proofs:</span> 15/15 verified
              </div>
            </div>

            {GMC_API_ENDPOINTS.map((ep) => (
              <div key={ep.path} className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    ep.method === "POST" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                  }`}>
                    {ep.method}
                  </span>
                  <code className="text-xs font-mono text-foreground">{ep.path}</code>
                </div>
                <p className="text-xs font-mono text-muted-foreground mb-3">{ep.description}</p>
                {ep.body && (
                  <div className="mb-3">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Request Body</div>
                    <pre className="bg-secondary/40 rounded-lg p-3 text-[10px] font-mono text-foreground overflow-x-auto">
                      {ep.body}
                    </pre>
                  </div>
                )}
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Response</div>
                  <pre className="bg-secondary/40 rounded-lg p-3 text-[10px] font-mono text-accent overflow-x-auto">
                    {ep.response}
                  </pre>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
