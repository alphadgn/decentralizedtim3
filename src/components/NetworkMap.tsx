import { motion } from "framer-motion";
import { NETWORK_NODES } from "@/hooks/useNetworkTime";

// Simple mercator projection
function project(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

export function NetworkMap() {
  const W = 800;
  const H = 400;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-panel p-6 relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">
          Oracle Node Network
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 neon-dot-cyan pulse-glow" />
          <span className="text-xs font-mono text-muted-foreground">
            {NETWORK_NODES.length} Active Nodes
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 320 }}>
        {/* Grid dots */}
        {Array.from({ length: 20 }).map((_, i) =>
          Array.from({ length: 10 }).map((_, j) => (
            <circle
              key={`${i}-${j}`}
              cx={(i / 19) * W}
              cy={(j / 9) * H}
              r={0.8}
              fill="hsl(var(--border))"
              opacity={0.4}
            />
          ))
        )}

        {/* Connections between nearby nodes */}
        {NETWORK_NODES.map((a, i) =>
          NETWORK_NODES.slice(i + 1).map((b) => {
            const pa = project(a.lat, a.lng, W, H);
            const pb = project(b.lat, b.lng, W, H);
            const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
            if (dist > 300) return null;
            return (
              <line
                key={`${a.id}-${b.id}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
                stroke="hsl(var(--neon-cyan))"
                strokeWidth={0.5}
                opacity={0.15}
              />
            );
          })
        )}

        {/* Node dots */}
        {NETWORK_NODES.map((node) => {
          const { x, y } = project(node.lat, node.lng, W, H);
          return (
            <g key={node.id}>
              {/* Glow ring */}
              <circle cx={x} cy={y} r={8} fill="hsl(var(--neon-cyan))" opacity={0.08}>
                <animate attributeName="r" values="6;12;6" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.08;0.15;0.08" dur="3s" repeatCount="indefinite" />
              </circle>
              {/* Core dot */}
              <circle cx={x} cy={y} r={3} fill="hsl(var(--neon-cyan))" />
              {/* Label */}
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fontSize={8}
                fill="hsl(var(--muted-foreground))"
                fontFamily="'JetBrains Mono', monospace"
              >
                {node.region}
              </text>
            </g>
          );
        })}
      </svg>
    </motion.div>
  );
}
