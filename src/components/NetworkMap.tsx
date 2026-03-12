import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { NETWORK_NODES } from "@/hooks/useNetworkTime";

function project(lat: number, lng: number, width: number, height: number) {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

interface NodeTooltipData {
  node: typeof NETWORK_NODES[0];
  x: number;
  y: number;
  drift: string;
  uptime: string;
  lastObservation: string;
}

// Generate random packets flowing between nodes
function useConsensusPackets() {
  const [packets, setPackets] = useState<{ id: string; fromIdx: number; toIdx: number; progress: number }[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPackets((prev) => {
        // Add new packet
        const fromIdx = Math.floor(Math.random() * NETWORK_NODES.length);
        let toIdx = Math.floor(Math.random() * NETWORK_NODES.length);
        if (toIdx === fromIdx) toIdx = (toIdx + 1) % NETWORK_NODES.length;

        const newPacket = {
          id: `${Date.now()}-${Math.random()}`,
          fromIdx,
          toIdx,
          progress: 0,
        };

        // Advance existing packets, remove completed
        const updated = prev
          .map((p) => ({ ...p, progress: p.progress + 0.05 }))
          .filter((p) => p.progress <= 1);

        return [...updated, newPacket].slice(-15); // max 15 active packets
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return packets;
}

// Simulated per-node metrics (stable across renders)
const NODE_METRICS = NETWORK_NODES.map(() => ({
  drift: (Math.random() * 2 - 1).toFixed(3),
  uptime: (99.5 + Math.random() * 0.5).toFixed(2),
  lastObs: Date.now() - Math.floor(Math.random() * 5000),
}));

export function NetworkMap() {
  const W = 800;
  const H = 400;
  const [hoveredNode, setHoveredNode] = useState<NodeTooltipData | null>(null);
  const packets = useConsensusPackets();

  const projectedNodes = useMemo(
    () => NETWORK_NODES.map((n) => ({ ...n, ...project(n.lat, n.lng, W, H) })),
    []
  );

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
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 neon-dot-cyan pulse-glow" />
            <span className="text-xs font-mono text-muted-foreground">
              {NETWORK_NODES.length} Active Nodes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 neon-dot-green pulse-glow" />
            <span className="text-xs font-mono text-muted-foreground">
              Live Consensus
            </span>
          </div>
        </div>
      </div>

      <div className="relative">
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
          {projectedNodes.map((a, i) =>
            projectedNodes.slice(i + 1).map((b) => {
              const dist = Math.hypot(a.x - b.x, a.y - b.y);
              if (dist > 300) return null;
              return (
                <line
                  key={`${a.id}-${b.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="hsl(var(--neon-cyan))"
                  strokeWidth={0.5}
                  opacity={0.15}
                />
              );
            })
          )}

          {/* Animated consensus packets */}
          {packets.map((pkt) => {
            const from = projectedNodes[pkt.fromIdx];
            const to = projectedNodes[pkt.toIdx];
            if (!from || !to) return null;
            const cx = from.x + (to.x - from.x) * pkt.progress;
            const cy = from.y + (to.y - from.y) * pkt.progress;
            return (
              <g key={pkt.id}>
                {/* Packet trail */}
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={cx}
                  y2={cy}
                  stroke="hsl(var(--neon-green))"
                  strokeWidth={1}
                  opacity={0.3 * (1 - pkt.progress)}
                />
                {/* Packet dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={2.5}
                  fill="hsl(var(--neon-green))"
                  opacity={0.8 * (1 - pkt.progress * 0.5)}
                >
                  <animate attributeName="r" values="2;3.5;2" dur="0.5s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          {/* Node dots */}
          {projectedNodes.map((node, idx) => (
            <g
              key={node.id}
              onMouseEnter={() =>
                setHoveredNode({
                  node,
                  x: node.x,
                  y: node.y,
                  drift: NODE_METRICS[idx].drift,
                  uptime: NODE_METRICS[idx].uptime,
                  lastObservation: new Date(NODE_METRICS[idx].lastObs).toISOString().split("T")[1].slice(0, 12),
                })
              }
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              {/* Glow ring */}
              <circle cx={node.x} cy={node.y} r={8} fill="hsl(var(--neon-cyan))" opacity={0.08}>
                <animate attributeName="r" values="6;12;6" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.08;0.15;0.08" dur="3s" repeatCount="indefinite" />
              </circle>
              {/* Hover ring */}
              <circle
                cx={node.x}
                cy={node.y}
                r={14}
                fill="transparent"
                stroke="hsl(var(--neon-cyan))"
                strokeWidth={hoveredNode?.node.id === node.id ? 1 : 0}
                opacity={0.5}
              />
              {/* Core dot */}
              <circle cx={node.x} cy={node.y} r={3} fill="hsl(var(--neon-cyan))" />
              {/* Label */}
              <text
                x={node.x}
                y={node.y - 10}
                textAnchor="middle"
                fontSize={8}
                fill="hsl(var(--muted-foreground))"
                fontFamily="'JetBrains Mono', monospace"
              >
                {node.region}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="absolute pointer-events-none z-10 glass-panel p-3 text-xs font-mono"
            style={{
              left: `${(hoveredNode.x / W) * 100}%`,
              top: `${(hoveredNode.y / H) * 100}%`,
              transform: "translate(-50%, -120%)",
              minWidth: 180,
            }}
          >
            <div className="text-foreground font-semibold mb-1">{hoveredNode.node.region}</div>
            <div className="text-muted-foreground">
              Drift: <span className="neon-text-cyan">{hoveredNode.drift}ms</span>
            </div>
            <div className="text-muted-foreground">
              Uptime: <span className="neon-text-green">{hoveredNode.uptime}%</span>
            </div>
            <div className="text-muted-foreground">
              Last obs: <span className="text-foreground">{hoveredNode.lastObservation}</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
