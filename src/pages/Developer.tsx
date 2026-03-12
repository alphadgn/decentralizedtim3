import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { Code, Terminal, Webhook, Copy, Check } from "lucide-react";

const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/time",
    description: "Returns the current Network Canonical Time with confidence score and blockchain proof.",
    response: `{
  "epoch": 1710268800000,
  "utc": "2025-03-12T12:00:00.000Z",
  "confidence": 99.97,
  "nodeCount": 12,
  "blockchainProof": "0x7a3b...f2e1",
  "syncStatus": "synced"
}`,
  },
  {
    method: "GET",
    path: "/api/nodes",
    description: "Returns the list of active oracle nodes in the network.",
    response: `{
  "nodes": [
    {
      "id": "node-us-east",
      "region": "US East",
      "lat": 40.7,
      "lng": -74.0,
      "uptime": 99.98,
      "drift": 0.42,
      "status": "active"
    }
  ],
  "totalCount": 12
}`,
  },
  {
    method: "GET",
    path: "/api/status",
    description: "Returns overall network health and consensus metrics.",
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
    method: "GET",
    path: "/api/history",
    description: "Returns past timestamp anchors with blockchain proofs.",
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

const SDK_EXAMPLE = `import { DGTNClient } from '@dgtn/sdk';

// Initialize client
const dgtn = new DGTNClient({
  apiKey: 'your-api-key',
  syncInterval: 10000, // 10s re-sync
});

// Get verified network time
const time = await dgtn.getTime();
console.log(time.epoch);  // 1710268800000
console.log(time.utc);    // "2025-03-12T12:00:00.000Z"
console.log(time.confidence); // 99.97

// Subscribe to time updates
dgtn.onSync((time) => {
  const offset = time.epoch - Date.now();
  console.log(\`Network offset: \${offset}ms\`);
});

// Get node status
const nodes = await dgtn.getNodes();
console.log(\`Active nodes: \${nodes.length}\`);

// Verify blockchain anchor
const proof = await dgtn.verifyAnchor({
  chain: 'ethereum',
  epoch: 1710268800000,
});
console.log(proof.txHash);`;

const WEBHOOK_EVENTS = [
  { event: "time.drift.detected", description: "Fired when network time drift exceeds ±10ms threshold.", payload: '{ "drift": 12.4, "nodeId": "node-us-east", "epoch": 1710268800000 }' },
  { event: "consensus.achieved", description: "Fired when a new consensus round completes.", payload: '{ "epoch": 1710268800000, "confidence": 99.97, "participants": 12 }' },
  { event: "anchor.created", description: "Fired when a new blockchain anchor is stored.", payload: '{ "chain": "ethereum", "block": 19421000, "txHash": "0xabc...def" }' },
  { event: "node.joined", description: "Fired when a new oracle node joins the network.", payload: '{ "nodeId": "node-new", "region": "US Central" }' },
  { event: "node.dropped", description: "Fired when a node goes offline or is removed.", payload: '{ "nodeId": "node-old", "reason": "timeout" }' },
];

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

export default function Developer() {
  const [activeTab, setActiveTab] = useState<"api" | "sdk" | "webhooks">("api");

  return (
    <div className="min-h-screen bg-background grid-bg">
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-mono font-bold text-foreground mb-2">Developer Platform</h1>
          <p className="text-sm font-mono text-muted-foreground">Integrate verified decentralized time into your applications</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1 w-fit">
          {[
            { id: "api" as const, label: "REST API", icon: Terminal },
            { id: "sdk" as const, label: "JavaScript SDK", icon: Code },
            { id: "webhooks" as const, label: "Webhooks", icon: Webhook },
          ].map((tab) => (
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
              <div key={ep.path} className="glass-panel p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="bg-accent/20 text-accent text-[10px] font-mono font-bold px-2 py-0.5 rounded">{ep.method}</span>
                  <code className="text-sm font-mono text-foreground">{ep.path}</code>
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

        {/* SDK */}
        {activeTab === "sdk" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">JavaScript / TypeScript SDK</h2>
              <CopyButton text="npm install @dgtn/sdk" />
            </div>
            <div className="bg-secondary/60 rounded-lg p-3 mb-4 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <code className="text-sm font-mono text-accent">npm install @dgtn/sdk</code>
            </div>
            <div className="relative">
              <div className="absolute top-2 right-2"><CopyButton text={SDK_EXAMPLE} /></div>
              <pre className="bg-secondary/60 rounded-lg p-4 text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {SDK_EXAMPLE}
              </pre>
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
                <code className="text-xs font-mono text-foreground">POST https://api.dgtn.network/webhooks/register</code>
                <CopyButton text="https://api.dgtn.network/webhooks/register" />
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
      </main>
    </div>
  );
}
