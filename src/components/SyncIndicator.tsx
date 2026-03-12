import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";

export function SyncIndicator() {
  const { offset, syncStatus, lastSync, epoch } = useNetworkTime();
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localTime = new Date(epoch).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-panel p-6"
    >
      <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground mb-4">
        Client Synchronization
      </h2>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-muted-foreground">Your Region</span>
          <span className="text-sm font-mono text-foreground">{userTz}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-muted-foreground">Local Time</span>
          <span className="text-sm font-mono neon-text-cyan">{localTime}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-muted-foreground">Network Offset</span>
          <span className="text-sm font-mono text-foreground">{offset > 0 ? "+" : ""}{offset.toFixed(3)}ms</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-muted-foreground">Sync Status</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 neon-dot-green pulse-glow" />
            <span className="text-sm font-mono neon-text-green uppercase">{syncStatus}</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-mono text-muted-foreground">Next Sync</span>
          <span className="text-sm font-mono text-muted-foreground">
            {Math.max(0, 10 - Math.floor((epoch - lastSync) / 1000))}s
          </span>
        </div>
      </div>
    </motion.div>
  );
}
