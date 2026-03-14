import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Code, Terminal, Webhook, Copy, Check, Key, BookOpen, Zap, Shield, Globe } from "lucide-react";

// ── API Endpoints ──────────────────────────────────────────────────
const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/time",
    tier: "Free",
    description: "Returns the current Network Canonical Time with confidence score and blockchain proof.",
    response: `{
  "epoch": 1710268800000,
  "utc": "2025-03-12T12:00:00.000Z",
  "confidence": 99.97,
  "nodeCount": 12,
  "consensusMethod": "byzantine_median",
  "blockchainProof": "0x7a3b...f2e1",
  "syncStatus": "synced"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/time/precision",
    tier: "Enterprise",
    description: "High-precision time with ±5ms accuracy target, validator signatures, and full consensus metadata.",
    response: `{
  "epoch": 1710268800000,
  "utc": "2025-03-12T12:00:00.000Z",
  "accuracy": "±4.2ms",
  "confidence": 99.99,
  "consensusRound": 48291,
  "validatorSignatures": ["0xab12...","0xcd34..."],
  "blockchainAnchor": {
    "chain": "ethereum",
    "block": 19421000,
    "txHash": "0xabc...def"
  }
}`,
  },
  {
    method: "GET",
    path: "/api/v1/nodes",
    tier: "Free",
    description: "Returns active oracle nodes with drift, uptime, and trust scores.",
    response: `{
  "nodes": [
    {
      "id": "node-us-east",
      "region": "US East",
      "lat": 40.7, "lng": -74.0,
      "uptime": 99.98,
      "drift": 0.42,
      "trustScore": 98.7,
      "stakeAmount": "50000 DGTN",
      "status": "active"
    }
  ],
  "totalCount": 12
}`,
  },
  {
    method: "GET",
    path: "/api/v1/status",
    tier: "Free",
    description: "Network health, consensus metrics, and blockchain anchor status.",
    response: `{
  "status": "healthy",
  "consensusAchieved": true,
  "activePeers": 12,
  "averageDrift": 0.31,
  "blockchainAnchors": {
    "ethereum": { "block": 19421000, "confirmed": true },
    "solana": { "slot": 254100000, "confirmed": true },
    "polygon": { "block": 54210000, "confirmed": true }
  }
}`,
  },
  {
    method: "POST",
    path: "/api/v1/order-event",
    tier: "Enterprise",
    description: "Submit a trade event for canonical timestamping and deterministic sequence assignment.",
    response: `{
  "canonicalTimestamp": 1710268800123,
  "sequenceNumber": 948271039,
  "signature": "0x9f2a...b7c3",
  "verificationHash": "0xde41...8a92",
  "exchangeId": "EXCH-001",
  "blockchainProof": "pending"
}`,
  },
  {
    method: "POST",
    path: "/api/v1/mev/commit",
    tier: "Enterprise",
    description: "Submit a cryptographic commitment hash before trade execution for MEV protection.",
    response: `{
  "commitmentId": "cmt-9a3b7c",
  "commitHash": "0x7f3a...2e1b",
  "timestamp": 1710268800000,
  "expiresAt": 1710268830000,
  "status": "committed"
}`,
  },
  {
    method: "GET",
    path: "/api/v1/ledger/events",
    tier: "Enterprise",
    description: "Query the tamper-proof global event sequencing ledger for auditing.",
    response: `{
  "events": [
    {
      "eventHash": "0xab12...ef34",
      "canonicalTimestamp": 1710268800123,
      "sequenceNumber": 948271039,
      "exchangeId": "EXCH-001",
      "verificationProof": "0xcd56...gh78"
    }
  ],
  "total": 1482910
}`,
  },
  {
    method: "GET",
    path: "/api/v1/history",
    tier: "Free",
    description: "Past timestamp anchors with blockchain proofs.",
    response: `{
  "anchors": [
    {
      "epoch": 1710268770000,
      "blockNumber": 19421000,
      "chain": "ethereum",
      "txHash": "0xabc...def",
      "validatorNodeId": "node-us-east"
    }
  ]
}`,
  },
];

// ── SDK Examples ───────────────────────────────────────────────────
const SDK_EXAMPLES: Record<string, { install: string; code: string; lang: string }> = {
  JavaScript: {
    install: "npm install @dgtn/sdk",
    lang: "javascript",
    code: `import { DGTNClient } from '@dgtn/sdk';

const dgtn = new DGTNClient({
  apiKey: 'your-api-key',
  syncInterval: 10000,
});

// Get verified network time
const time = await dgtn.getTime();
console.log(time.epoch);       // 1710268800000
console.log(time.confidence);  // 99.97

// High-precision enterprise time
const precise = await dgtn.getPrecisionTime();
console.log(precise.accuracy); // "±4.2ms"

// Submit trade event for ordering
const order = await dgtn.submitOrderEvent({
  exchangeId: 'EXCH-001',
  orderData: { pair: 'BTC/USD', side: 'buy', qty: 1.5 },
});
console.log(order.sequenceNumber);

// MEV protection: commit-reveal
const commit = await dgtn.mev.commit({
  orderData: { pair: 'ETH/USD', side: 'sell', qty: 10 },
});
// ... later reveal
await dgtn.mev.reveal(commit.commitmentId, orderData);

// Subscribe to time updates
dgtn.onSync((t) => console.log(\`Offset: \${t.epoch - Date.now()}ms\`));`,
  },
  Python: {
    install: "pip install dgtn-sdk",
    lang: "python",
    code: `from dgtn import DGTNClient

client = DGTNClient(api_key="your-api-key")

# Get network canonical time
time = client.get_time()
print(f"Epoch: {time.epoch}")
print(f"Confidence: {time.confidence}%")

# High-precision enterprise time
precise = client.get_precision_time()
print(f"Accuracy: {precise.accuracy}")

# Submit trade event
order = client.submit_order_event(
    exchange_id="EXCH-001",
    order_data={"pair": "BTC/USD", "side": "buy", "qty": 1.5}
)
print(f"Sequence: {order.sequence_number}")

# MEV commit-reveal
commit = client.mev.commit(order_data={"pair": "ETH/USD", "side": "sell"})
client.mev.reveal(commit.commitment_id, order_data)

# Get node status
nodes = client.get_nodes()
for node in nodes:
    print(f"{node.region}: drift {node.drift}ms")`,
  },
  Go: {
    install: "go get github.com/dgtn/sdk-go",
    lang: "go",
    code: `package main

import (
    "fmt"
    dgtn "github.com/dgtn/sdk-go"
)

func main() {
    client := dgtn.NewClient(dgtn.Config{
        APIKey: "your-api-key",
    })

    // Get network canonical time
    time, _ := client.GetTime()
    fmt.Printf("Epoch: %d\\n", time.Epoch)
    fmt.Printf("Confidence: %.2f%%\\n", time.Confidence)

    // Submit trade event
    order, _ := client.SubmitOrderEvent(dgtn.OrderEvent{
        ExchangeID: "EXCH-001",
        OrderData:  map[string]any{"pair": "BTC/USD", "side": "buy"},
    })
    fmt.Printf("Sequence: %d\\n", order.SequenceNumber)

    // MEV commit
    commit, _ := client.MEV.Commit(orderData)
    client.MEV.Reveal(commit.CommitmentID, orderData)
}`,
  },
  Rust: {
    install: "cargo add dgtn-sdk",
    lang: "rust",
    code: `use dgtn_sdk::DGTNClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = DGTNClient::new("your-api-key");

    // Get network canonical time
    let time = client.get_time().await?;
    println!("Epoch: {}", time.epoch);
    println!("Confidence: {:.2}%", time.confidence);

    // Submit trade event
    let order = client.submit_order_event(OrderEvent {
        exchange_id: "EXCH-001".into(),
        order_data: json!({"pair": "BTC/USD", "side": "buy"}),
    }).await?;
    println!("Sequence: {}", order.sequence_number);

    // MEV commit-reveal
    let commit = client.mev().commit(&order_data).await?;
    client.mev().reveal(&commit.commitment_id, &order_data).await?;

    Ok(())
}`,
  },
};

// ── Webhook Events ─────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  { event: "time.drift.detected", description: "Network time drift exceeds ±10ms threshold.", payload: '{ "drift": 12.4, "nodeId": "node-us-east", "epoch": 1710268800000 }' },
  { event: "consensus.achieved", description: "New consensus round completed.", payload: '{ "epoch": 1710268800000, "confidence": 99.97, "participants": 12 }' },
  { event: "anchor.created", description: "New blockchain anchor stored.", payload: '{ "chain": "ethereum", "block": 19421000, "txHash": "0xabc...def" }' },
  { event: "order.sequenced", description: "Trade event assigned canonical timestamp and sequence number.", payload: '{ "sequenceNumber": 948271039, "exchangeId": "EXCH-001", "timestamp": 1710268800123 }' },
  { event: "mev.commitment.verified", description: "MEV commitment hash verified against revealed data.", payload: '{ "commitmentId": "cmt-9a3b7c", "verified": true, "exchangeId": "EXCH-001" }' },
  { event: "node.staked", description: "Node deposited stake into the protocol.", payload: '{ "nodeId": "node-new", "stakeAmount": "50000 DGTN" }' },
  { event: "node.slashed", description: "Node penalized for drift/manipulation.", payload: '{ "nodeId": "node-bad", "slashAmount": "5000 DGTN", "reason": "timestamp_manipulation" }' },
  { event: "node.joined", description: "New oracle node joined the network.", payload: '{ "nodeId": "node-new", "region": "US Central" }' },
  { event: "node.dropped", description: "Node went offline or removed.", payload: '{ "nodeId": "node-old", "reason": "timeout" }' },
  { event: "settlement.proof.generated", description: "Enterprise settlement certificate generated.", payload: '{ "settlementTimestamp": 1710268800000, "sequenceNumber": 948271039, "blockchainProof": "0xde41...8a92" }' },
];

// ── Auth Guide ─────────────────────────────────────────────────────
const AUTH_GUIDE = `# Authentication Guide

All API requests require an API key in the Authorization header:

    Authorization: Bearer YOUR_API_KEY

## Obtaining an API Key

1. Sign in to the DGTN Dashboard
2. Navigate to Settings → API Keys
3. Click "Generate New Key"
4. Copy and store securely — keys are only shown once

## Rate Limits by Tier

| Tier       | Rate Limit          | Endpoints                         |
|------------|---------------------|-----------------------------------|
| Free       | 100,000 req/month   | /time, /nodes, /status, /history  |
| Pro        | 1,000,000 req/month | All Free + analytics              |
| Enterprise | Unlimited           | All + /time/precision, /order-event, /mev/*, /ledger/* |

## Error Codes

| Code | Meaning                |
|------|------------------------|
| 401  | Missing or invalid key |
| 403  | Insufficient tier      |
| 429  | Rate limit exceeded    |
| 500  | Internal server error  |
`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === "Enterprise"
    ? "bg-primary/20 text-primary"
    : "bg-accent/20 text-accent";
  return <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${cls}`}>{tier}</span>;
}

type TabId = "api" | "sdk" | "webhooks" | "auth";

export default function Developer() {
  const [activeTab, setActiveTab] = useState<TabId>("api");
  const [sdkLang, setSdkLang] = useState("JavaScript");

  const tabs: { id: TabId; label: string; icon: typeof Terminal }[] = [
    { id: "api", label: "REST API", icon: Terminal },
    { id: "sdk", label: "SDKs", icon: Code },
    { id: "webhooks", label: "Webhooks", icon: Webhook },
    { id: "auth", label: "Auth Guide", icon: Key },
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Developer Platform</h1>
          <p className="text-sm font-mono text-muted-foreground">
            Enterprise-grade decentralized time infrastructure — APIs, SDKs, and integration guides
          </p>
        </motion.div>

        {/* Quick-links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Globe, label: "Public API", desc: "100K req/mo free", onClick: () => setActiveTab("api") },
            { icon: Zap, label: "Enterprise API", desc: "±5ms precision", onClick: () => setActiveTab("api") },
            { icon: Shield, label: "MEV Protection", desc: "Commit-reveal", onClick: () => setActiveTab("api") },
            { icon: BookOpen, label: "Auth Guide", desc: "API key setup", onClick: () => setActiveTab("auth") },
          ].map((q) => (
            <button key={q.label} onClick={q.onClick} className="glass-panel p-4 text-left hover:border-primary/50 transition-colors">
              <q.icon className="w-4 h-4 text-primary mb-2" />
              <div className="text-xs font-mono font-semibold text-foreground">{q.label}</div>
              <div className="text-[10px] font-mono text-muted-foreground">{q.desc}</div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-mono transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* API Docs */}
        {activeTab === "api" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {API_ENDPOINTS.map((ep) => (
              <div key={ep.path + ep.method} className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    ep.method === "POST" ? "bg-primary/20 text-primary" : "bg-accent/20 text-accent"
                  }`}>{ep.method}</span>
                  <code className="text-sm font-mono text-foreground">{ep.path}</code>
                  <TierBadge tier={ep.tier} />
                  <CopyButton text={ep.path} />
                </div>
                <p className="text-xs font-mono text-muted-foreground mb-3">{ep.description}</p>
                <div className="relative">
                  <div className="absolute top-2 right-2"><CopyButton text={ep.response} /></div>
                  <pre className="bg-secondary/60 rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto">
                    {ep.response}
                  </pre>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* SDKs */}
        {activeTab === "sdk" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
              {Object.keys(SDK_EXAMPLES).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSdkLang(lang)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all ${
                    sdkLang === lang
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">{sdkLang} SDK</h2>
                <CopyButton text={SDK_EXAMPLES[sdkLang].install} />
              </div>
              <div className="bg-secondary/60 rounded-lg p-3 mb-4 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <code className="text-sm font-mono text-primary">{SDK_EXAMPLES[sdkLang].install}</code>
              </div>
              <div className="relative">
                <div className="absolute top-2 right-2"><CopyButton text={SDK_EXAMPLES[sdkLang].code} /></div>
                <pre className="bg-secondary/60 rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                  {SDK_EXAMPLES[sdkLang].code}
                </pre>
              </div>
            </div>
          </motion.div>
        )}

        {/* Webhooks */}
        {activeTab === "webhooks" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="glass-panel p-5">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-2">Webhook Configuration</h2>
              <p className="text-xs font-mono text-muted-foreground mb-4">
                Register a webhook endpoint to receive real-time events from the DGTN network.
              </p>
              <div className="bg-secondary/60 rounded-lg p-3 flex items-center gap-2">
                <code className="text-xs font-mono text-foreground">POST https://api.dgtn.network/v1/webhooks/register</code>
                <CopyButton text="https://api.dgtn.network/v1/webhooks/register" />
              </div>
            </div>
            {WEBHOOK_EVENTS.map((ev) => (
              <div key={ev.event} className="glass-panel p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Webhook className="w-3.5 h-3.5 text-primary" />
                  <code className="text-sm font-mono text-primary">{ev.event}</code>
                </div>
                <p className="text-xs font-mono text-muted-foreground mb-3">{ev.description}</p>
                <pre className="bg-secondary/60 rounded-lg p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
                  {ev.payload}
                </pre>
              </div>
            ))}
          </motion.div>
        )}

        {/* Auth Guide */}
        {activeTab === "auth" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
            <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {AUTH_GUIDE}
            </pre>
          </motion.div>
        )}
      </main>
    </div>
  );
}
