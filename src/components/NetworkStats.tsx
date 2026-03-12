import { motion } from "framer-motion";
import { useNetworkTime } from "@/hooks/useNetworkTime";
import { Activity, Shield, Clock, Layers } from "lucide-react";

export function NetworkStats() {
  const { offset, nodeCount, confidence } = useNetworkTime();

  const stats = [
    {
      label: "Active Nodes",
      value: nodeCount.toString(),
      icon: Activity,
      accent: "neon-text-cyan",
    },
    {
      label: "Network Drift",
      value: `${offset > 0 ? "+" : ""}${offset.toFixed(3)}ms`,
      icon: Clock,
      accent: "neon-text-cyan",
    },
    {
      label: "Confidence",
      value: `${confidence.toFixed(2)}%`,
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
          <span className={`font-mono text-xl font-semibold ${stat.accent}`}>
            {stat.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}
