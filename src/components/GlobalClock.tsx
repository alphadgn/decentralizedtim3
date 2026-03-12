import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";

export function GlobalClock() {
  const { epoch, utc, confidence, syncStatus } = useNetworkTime();
  
  const date = new Date(epoch);
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");
  const ms = date.getUTCMilliseconds().toString().padStart(3, "0");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="glass-panel p-8 md:p-12 text-center relative overflow-hidden"
    >
      {/* Subtle glow behind clock */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${syncStatus === "synced" ? "neon-dot-green pulse-glow" : "neon-dot-cyan"}`} />
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Network Canonical Time
          </span>
        </div>

        <div className="font-mono text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight neon-text-cyan leading-none">
          {hours}:{minutes}:{seconds}
          <span className="text-3xl md:text-4xl lg:text-5xl text-muted-foreground">.{ms}</span>
        </div>

        <div className="mt-4 text-sm font-mono text-muted-foreground tracking-wide">
          UTC — {date.toISOString().split("T")[0]}
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs font-mono text-muted-foreground">
          <span>EPOCH <span className="text-foreground">{epoch}</span></span>
          <span>CONFIDENCE <span className="neon-text-green">{confidence.toFixed(2)}%</span></span>
          <span>STATUS <span className="neon-text-green uppercase">{syncStatus}</span></span>
        </div>
      </div>
    </motion.div>
  );
}
