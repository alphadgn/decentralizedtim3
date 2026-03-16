// Phases 9-10: Latency-Neutral Ordering
// Geographic validator distribution with median receive-time consensus

export interface ValidatorObservation {
  validator_id: string;
  region: string;
  receive_time: number;
  propagation_delay_ms: number;
  signature: string;
  verified: boolean;
}

export interface LatencyNeutralResult {
  canonical_timestamp: number;
  median_receive_time: number;
  validator_observations: ValidatorObservation[];
  geographic_distribution: {
    region: string;
    validator_count: number;
    avg_propagation_ms: number;
  }[];
  fairness_score: number;
  ordering_method: string;
}

// Geographic validator regions with simulated propagation delays (ms)
const VALIDATOR_REGIONS = [
  { region: "us-east", validators: ["us-east-1", "us-east-2"], base_delay: 2 },
  { region: "us-west", validators: ["us-west-1", "us-west-2"], base_delay: 15 },
  { region: "eu-west", validators: ["eu-west-1", "eu-west-2"], base_delay: 45 },
  { region: "eu-central", validators: ["eu-central-1"], base_delay: 50 },
  { region: "asia-east", validators: ["asia-east-1", "asia-east-2"], base_delay: 80 },
  { region: "asia-south", validators: ["asia-south-1"], base_delay: 90 },
  { region: "oceania", validators: ["oceania-1"], base_delay: 110 },
  { region: "south-america", validators: ["sa-east-1"], base_delay: 95 },
] as const;

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Compute a latency-neutral canonical timestamp using median receive-time consensus.
 * 
 * Instead of using the server's local time, we simulate each geographic validator
 * receiving the event at different times due to network propagation. The canonical
 * timestamp is the MEDIAN of all validator receive times, which eliminates the
 * advantage of geographic proximity to any single validator.
 */
export async function computeLatencyNeutralTimestamp(
  submissionTime: number,
  eventHash: string
): Promise<LatencyNeutralResult> {
  const observations: ValidatorObservation[] = [];

  // Each validator "receives" the event at submission_time + propagation_delay + jitter
  for (const region of VALIDATOR_REGIONS) {
    for (const validatorId of region.validators) {
      // Jitter simulates real network variance (±20% of base delay)
      const jitter = (Math.random() - 0.5) * 2 * region.base_delay * 0.2;
      const propagationDelay = Math.max(0, region.base_delay + jitter);
      const receiveTime = submissionTime + propagationDelay;

      const sigData = `${validatorId}:${eventHash}:${Math.round(receiveTime)}`;
      const signature = await sha256(sigData);

      observations.push({
        validator_id: validatorId,
        region: region.region,
        receive_time: Math.round(receiveTime),
        propagation_delay_ms: Math.round(propagationDelay * 100) / 100,
        signature: `0x${signature.slice(0, 40)}`,
        verified: true,
      });
    }
  }

  // Sort by receive_time for median computation
  const sortedTimes = observations.map(o => o.receive_time).sort((a, b) => a - b);
  
  // Median receive time — this is the latency-neutral canonical timestamp
  const mid = Math.floor(sortedTimes.length / 2);
  const medianReceiveTime = sortedTimes.length % 2 === 0
    ? Math.round((sortedTimes[mid - 1] + sortedTimes[mid]) / 2)
    : sortedTimes[mid];

  // Compute geographic distribution summary
  const regionMap = new Map<string, { count: number; totalDelay: number }>();
  for (const obs of observations) {
    const existing = regionMap.get(obs.region) ?? { count: 0, totalDelay: 0 };
    existing.count += 1;
    existing.totalDelay += obs.propagation_delay_ms;
    regionMap.set(obs.region, existing);
  }

  const geoDist = Array.from(regionMap.entries()).map(([region, data]) => ({
    region,
    validator_count: data.count,
    avg_propagation_ms: Math.round((data.totalDelay / data.count) * 100) / 100,
  }));

  // Fairness score: how evenly distributed are the receive times?
  // Lower variance = higher fairness (median consensus reduces advantage)
  const mean = sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length;
  const variance = sortedTimes.reduce((sum, t) => sum + (t - mean) ** 2, 0) / sortedTimes.length;
  const stdDev = Math.sqrt(variance);
  // Normalize: stdDev of 0 = perfect fairness (1.0), stdDev of 100+ = low fairness
  const fairnessScore = Math.max(0, Math.min(1, 1 - stdDev / 150));

  return {
    canonical_timestamp: medianReceiveTime,
    median_receive_time: medianReceiveTime,
    validator_observations: observations,
    geographic_distribution: geoDist,
    fairness_score: Math.round(fairnessScore * 10000) / 10000,
    ordering_method: "median_receive_time_consensus",
  };
}
