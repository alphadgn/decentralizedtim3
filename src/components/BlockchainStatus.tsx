import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { ExternalLink } from "lucide-react";

const CHAINS = [
  { name: "Ethereum", symbol: "ETH", color: "neon-text-cyan" },
  { name: "Solana", symbol: "SOL", color: "neon-text-green" },
  { name: "Polygon", symbol: "MATIC", color: "neon-text-cyan" },
];

export function BlockchainStatus() {
  const { syncStatus } = useNetworkTime();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="glass-panel p-6"
    >
      <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
        Blockchain Anchors
      </h2>
      <div className="space-y-3">
        {CHAINS.map((chain) => (
          <div key={chain.symbol} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${syncStatus === "synced" ? "neon-dot-green pulse-glow" : "bg-muted-foreground"}`} />
              <div>
                <div className="text-sm font-medium text-foreground">{chain.name}</div>
                <div className="text-xs font-mono text-muted-foreground">{chain.symbol}</div>
              </div>
            </div>
            <div className="text-right flex items-center gap-3">
              <div>
                <div className={`text-sm font-mono ${chain.color} capitalize`}>
                  {syncStatus === "synced" ? "Anchored" : "Syncing..."}
                </div>
                <div className="text-xs font-mono text-muted-foreground">Verified on-chain</div>
              </div>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
