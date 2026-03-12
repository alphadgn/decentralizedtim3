import { useState, useEffect, useCallback, useRef } from "react";

interface NetworkTimeState {
  epoch: number;
  utc: string;
  offset: number;
  confidence: number;
  nodeCount: number;
  syncStatus: "synced" | "syncing" | "drift";
  lastSync: number;
}

const SYNC_INTERVAL = 10_000;

// Simulated network nodes
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
  const offsetRef = useRef(Math.random() * 2 - 1); // ±1ms simulated offset
  
  const computeState = useCallback((): NetworkTimeState => {
    const now = Date.now();
    const networkTime = now + offsetRef.current;
    const date = new Date(networkTime);
    
    return {
      epoch: Math.floor(networkTime),
      utc: date.toISOString(),
      offset: offsetRef.current,
      confidence: 99.97 + Math.random() * 0.03,
      nodeCount: NODES.length,
      syncStatus: "synced",
      lastSync: now,
    };
  }, []);

  const [state, setState] = useState<NetworkTimeState>(computeState);

  useEffect(() => {
    // High-frequency tick for smooth clock
    const tickInterval = setInterval(() => {
      setState(computeState());
    }, 50);

    // Re-sync offset periodically
    const syncInterval = setInterval(() => {
      offsetRef.current = Math.random() * 2 - 1;
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(tickInterval);
      clearInterval(syncInterval);
    };
  }, [computeState]);

  return state;
}
