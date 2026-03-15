import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { ExternalLink } from "lucide-react";

interface AnchorStatus {
  blockchain: string;
  network: string;
  status: "synced" | "syncing";
  tx_hash: string | null;
  block_number: number | null;
  explorer_url: string | null;
}

const FALLBACK_ANCHORS: AnchorStatus[] = [
  { blockchain: "ethereum_sepolia", network: "Ethereum Sepolia", status: "syncing", tx_hash: null, block_number: null, explorer_url: null },
  { blockchain: "solana_devnet", network: "Solana Devnet", status: "syncing", tx_hash: null, block_number: null, explorer_url: null },
  { blockchain: "polygon_amoy", network: "Polygon Amoy", status: "syncing", tx_hash: null, block_number: null, explorer_url: null },
];

function shortHash(hash: string | null): string {
  if (!hash) return "Pending proof";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function BlockchainStatus() {
  const { syncStatus } = useNetworkTime();
  const [anchors, setAnchors] = useState<AnchorStatus[]>(FALLBACK_ANCHORS);

  useEffect(() => {
    let active = true;

    const fetchAnchors = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/api-gateway/api/anchors`);
        if (!response.ok) return;

        const payload = await response.json();
        if (!active || !Array.isArray(payload.anchors)) return;

        setAnchors(payload.anchors);
      } catch {
        // Silent fallback to last known status
      }
    };

    void fetchAnchors();
    const interval = setInterval(() => void fetchAnchors(), 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

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
        {anchors.map((anchor) => {
          const isSynced = anchor.status === "synced" || syncStatus === "synced";

          return (
            <div key={anchor.blockchain} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isSynced ? "neon-dot-green pulse-glow" : "bg-muted-foreground"}`} />
                <div>
                  <div className="text-sm font-medium text-foreground">{anchor.network}</div>
                  <div className="text-xs font-mono text-muted-foreground">{shortHash(anchor.tx_hash)}</div>
                </div>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <div className={`text-sm font-mono capitalize ${isSynced ? "neon-text-green" : "text-muted-foreground"}`}>
                    {isSynced ? "Anchored" : "Syncing..."}
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {anchor.block_number ? `Block ${anchor.block_number}` : "Awaiting testnet proof"}
                  </div>
                </div>
                {anchor.explorer_url ? (
                  <a href={anchor.explorer_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
