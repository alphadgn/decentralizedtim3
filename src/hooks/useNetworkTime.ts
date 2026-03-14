import { useState, useEffect, useCallback, useRef } from "react";

interface NetworkTimeState {
  epoch: number;
  utc: string;
  offset: number;
  confidenceBand: string;
  nodeCount: number;
  syncStatus: "synced" | "syncing" | "drift";
  lastSync: number;
  accuracyBand: string;
  signalBand: string;
}

const SYNC_INTERVAL = 10_000;

// Node metadata only — no protocol logic
const NODES = [
  { id: "node-us-east", region: "US East", lat: 40.7, lng: -74.0 },
  { id: "node-us-west", region: "US West", lat: 37.8, lng: -122.4 },
  { id: "node-eu-west", region: "EU West", lat: 51.5, lng: -0.1 },
  { id: "node-eu-central", region: "EU Central", lat: 50.1, lng: 8.7 },
  { id: "node-asia-east", region: "Asia East", lat: 35.7, lng: 139.7 },
  { id: "node-asia-south", region: "Asia South", lat: 1.3, lng: 103.9 },
  { id: "node-oceania", region: "Oceania", lat: -33.9, lng: 151.2 },
  { id: "node-middle-east", region: "Middle East", lat: 25.2, lng: 55.3 },
  { id: "node-south-america", region: "South America", lat: -23.5, lng: -46.6 },
  { id: "node-africa", region: "Africa", lat: -1.3, lng: 36.8 },
  { id: "node-canada", region: "Canada", lat: 45.5, lng: -73.6 },
  { id: "node-nordic", region: "Nordic", lat: 59.3, lng: 18.1 },
];

export const NETWORK_NODES = NODES;

export function useNetworkTime() {
  const [state, setState] = useState<NetworkTimeState>({
    epoch: Date.now(),
    utc: new Date().toISOString(),
    offset: 0,
    confidenceBand: "high",
    nodeCount: NODES.length,
    syncStatus: "synced",
    lastSync: Date.now(),
    accuracyBand: "high",
    signalBand: "strong",
  });

  // Local clock tick — display only, no protocol computation
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const now = Date.now();
      setState(prev => ({
        ...prev,
        epoch: now,
        utc: new Date(now).toISOString(),
      }));
    }, 50);

    return () => clearInterval(tickInterval);
  }, []);

  // Periodic sync from server — all consensus happens server-side
  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/api-gateway/api/time`
        );
        if (res.ok && mounted) {
          const data = await res.json();
          setState(prev => ({
            ...prev,
            epoch: data.timestamp ?? Date.now(),
            utc: data.iso ?? new Date().toISOString(),
            confidenceBand: data.signal_band ?? "strong",
            accuracyBand: data.accuracy_band ?? "high",
            signalBand: data.signal_band ?? "strong",
            syncStatus: data.consensus_status === "verified" ? "synced" : "syncing",
            nodeCount: data.node_count ?? NODES.length,
            lastSync: Date.now(),
          }));
        }
      } catch {
        // Fallback to local clock — no protocol logic exposed
        if (mounted) {
          setState(prev => ({ ...prev, syncStatus: "drift" }));
        }
      }
    };

    sync();
    const interval = setInterval(sync, SYNC_INTERVAL);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  return state;
}
