import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";

interface NtpState {
  canonicalMs: number;
  localMs: number;
  roundTripMs: number;
  offsetMs: number;
  lastSync: number;
}

const SYNC_INTERVAL = 5_000;

export function NtpComparison() {
  const [state, setState] = useState<NtpState>({
    canonicalMs: Date.now(),
    localMs: Date.now(),
    roundTripMs: 0,
    offsetMs: 0,
    lastSync: 0,
  });
  const [displayCanonical, setDisplayCanonical] = useState(Date.now());
  const [displayLocal, setDisplayLocal] = useState(Date.now());
  const offsetRef = useRef(0);
  const rttRef = useRef(0);

  const syncNtp = useCallback(async () => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const t0 = performance.now();
    const sendTime = Date.now();
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/api-gateway/api/time`
      );
      const t1 = performance.now();
      if (!res.ok) return;
      const data = await res.json();
      const receiveTime = Date.now();

      const serverTs = data.ts ?? data.timestamp ?? data.epoch_ms ?? receiveTime;
      const roundTripMs = t1 - t0;
      // NTP-style offset: server time - local time adjusted for half round-trip
      const offset = serverTs - sendTime - roundTripMs / 2;

      offsetRef.current = offset;
      rttRef.current = roundTripMs;

      setState({
        canonicalMs: serverTs,
        localMs: receiveTime,
        roundTripMs,
        offsetMs: offset,
        lastSync: Date.now(),
      });
    } catch {
      // silently fail
    }
  }, []);

  // Sync on mount then every SYNC_INTERVAL
  useEffect(() => {
    syncNtp();
    const id = setInterval(syncNtp, SYNC_INTERVAL);
    return () => clearInterval(id);
  }, [syncNtp]);

  // High-frequency display tick
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const now = Date.now();
      setDisplayLocal(now);
      setDisplayCanonical(now + offsetRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    const h = d.getUTCHours().toString().padStart(2, "0");
    const m = d.getUTCMinutes().toString().padStart(2, "0");
    const s = d.getUTCSeconds().toString().padStart(2, "0");
    const frac = d.getUTCMilliseconds().toString().padStart(3, "0");
    return { time: `${h}:${m}:${s}`, frac };
  };

  const canonical = formatTime(displayCanonical);
  const local = formatTime(displayLocal);
  const drift = Math.abs(state.offsetMs);
  const rtt = rttRef.current;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel px-4 py-3 sm:px-6 sm:py-4"
    >
      <div className="flex items-center justify-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Canonical Time vs NTP Latency — Live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {/* Canonical (NCT) */}
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Network Canonical Time
          </p>
          <div className="font-mono text-xl sm:text-2xl md:text-3xl font-bold neon-text-cyan leading-none">
            {canonical.time}
            <span className="text-sm sm:text-base text-muted-foreground">.{canonical.frac}</span>
          </div>
        </div>

        {/* Local NTP */}
        <div className="text-center">
          <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            System Clock (NTP)
          </p>
          <div className="font-mono text-xl sm:text-2xl md:text-3xl font-bold text-foreground leading-none">
            {local.time}
            <span className="text-sm sm:text-base text-muted-foreground">.{local.frac}</span>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 mt-2 text-[10px] font-mono text-muted-foreground">
        <span>
          DRIFT{" "}
          <span className={drift < 15 ? "neon-text-green" : drift < 50 ? "text-yellow-400" : "text-destructive"}>
            {drift < 1 ? drift.toFixed(3) : drift.toFixed(1)}ms
          </span>
        </span>
        <span>
          RTT{" "}
          <span className="text-foreground">
            {rtt < 1 ? rtt.toFixed(3) : rtt.toFixed(1)}ms
          </span>
        </span>
        <span>
          OFFSET{" "}
          <span className="text-foreground">
            {state.offsetMs >= 0 ? "+" : ""}
            {Math.abs(state.offsetMs) < 1 ? state.offsetMs.toFixed(3) : state.offsetMs.toFixed(1)}ms
          </span>
        </span>
      </div>
    </motion.div>
  );
}
