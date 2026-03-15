import { useState, useEffect, useRef } from "react";

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

// ── Shared singleton state to prevent duplicate API calls ──
let sharedState: NetworkTimeState = {
  epoch: Date.now(),
  utc: new Date().toISOString(),
  offset: 0,
  confidenceBand: "high",
  nodeCount: NODES.length,
  syncStatus: "syncing",
  lastSync: 0,
  accuracyBand: "high",
  signalBand: "strong",
};

let subscriberCount = 0;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let tickIntervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

async function syncFromServer() {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/api-gateway/api/time`
    );
    if (res.ok) {
      const data = await res.json();
      const timestamp = data.timestamp ?? data.epoch_ms ?? data.ts ?? Date.now();
      const accuracyBand = data.accuracy_band ?? data.acc_tier ?? data.precision_level ?? "high";
      const signalBand = data.signal_band ?? data.sig_tier ?? data.signal_quality ?? "strong";
      const consensusStatus = data.consensus_status ?? "syncing";

      sharedState = {
        ...sharedState,
        epoch: timestamp,
        utc: data.iso ?? new Date(timestamp).toISOString(),
        confidenceBand: signalBand,
        accuracyBand,
        signalBand,
        syncStatus: consensusStatus === "verified" || consensusStatus === "synced" ? "synced" : "syncing",
        nodeCount: data.node_count ?? data.n_nodes ?? data.validator_count ?? NODES.length,
        lastSync: Date.now(),
      };
    } else {
      sharedState = { ...sharedState, syncStatus: "drift" };
    }
  } catch {
    sharedState = { ...sharedState, syncStatus: "drift" };
  }
  notifyListeners();
}

function startSharedSync() {
  if (syncIntervalId) return; // already running

  // Local clock tick for smooth display
  tickIntervalId = setInterval(() => {
    const now = Date.now();
    sharedState = { ...sharedState, epoch: now, utc: new Date(now).toISOString() };
    notifyListeners();
  }, 50);

  // Single API call every SYNC_INTERVAL
  syncFromServer();
  syncIntervalId = setInterval(syncFromServer, SYNC_INTERVAL);
}

function stopSharedSync() {
  if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
  if (tickIntervalId) { clearInterval(tickIntervalId); tickIntervalId = null; }
}

export function useNetworkTime() {
  const [, forceUpdate] = useState(0);
  const listenerRef = useRef<() => void>();

  useEffect(() => {
    subscriberCount++;
    const listener = () => forceUpdate((n) => n + 1);
    listenerRef.current = listener;
    listeners.add(listener);
    startSharedSync();

    return () => {
      listeners.delete(listener);
      subscriberCount--;
      if (subscriberCount <= 0) {
        subscriberCount = 0;
        stopSharedSync();
      }
    };
  }, []);

  return sharedState;
}
