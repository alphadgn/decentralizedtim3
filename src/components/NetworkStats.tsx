import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { Activity, Shield, Clock, Layers } from "lucide-react";

export function NetworkStats() {
  const { nodeCount, accuracyBand, signalBand, syncStatus } = useNetworkTime();

  const stats = [
    {
      label: "Active Nodes",
      value: nodeCount.toString(),
      icon: Activity,
      accent: "neon-text-cyan",
    },
    {
      label: "Accuracy",
      value: accuracyBand,
      icon: Clock,
      accent: "neon-text-cyan",
    },
    {
      label: "Signal Strength",
      value: signalBand,
      icon: Shield,
      accent: "neon-text-green",
    },
    {
      label: "Blockchain Anchors",
      value: "3",
      icon: Layers,
      accent: "neon-text-green",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-3"
    >
      {stats.map((stat) => (
        <div key={stat.label} className="glass-panel p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <stat.icon className="w-3.5 h-3.5" />
            <span className="text-xs font-mono uppercase tracking-wider">{stat.label}</span>
          </div>
          <span className={`font-mono text-xl font-semibold ${stat.accent} capitalize`}>
            {stat.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
