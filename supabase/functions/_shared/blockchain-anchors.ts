interface AnchorFetchResult {
  blockchain: string;
  network: string;
  tx_hash: string | null;
  block_number: number | null;
  source_rpc: string;
}

interface AnchorStatus {
  blockchain: string;
  network: string;
  status: "synced" | "syncing";
  tx_hash: string | null;
  block_number: number | null;
  created_at: string | null;
  explorer_url: string | null;
}

const ETH_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const SOLANA_DEVNET_RPC = "https://api.devnet.solana.com";
const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";

const BLOCKCHAIN_NETWORKS = [
  { blockchain: "ethereum_sepolia", network: "Ethereum Sepolia", rpc: ETH_SEPOLIA_RPC },
  { blockchain: "solana_devnet", network: "Solana Devnet", rpc: SOLANA_DEVNET_RPC },
  { blockchain: "polygon_amoy", network: "Polygon Amoy", rpc: POLYGON_AMOY_RPC },
] as const;

let inFlightAnchorRefresh: Promise<void> | null = null;

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callJsonRpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  const resp = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    },
    9000,
  );

  if (!resp.ok) throw new Error(`${method} failed with status ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(`${method} rpc error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function fetchEthereumSepoliaAnchor(): Promise<AnchorFetchResult> {
  const latestHex = await callJsonRpc(ETH_SEPOLIA_RPC, "eth_blockNumber", []);
  const block = await callJsonRpc(ETH_SEPOLIA_RPC, "eth_getBlockByNumber", [latestHex, false]);
  return {
    blockchain: "ethereum_sepolia",
    network: "Ethereum Sepolia",
    tx_hash: block?.hash ?? null,
    block_number: latestHex ? parseInt(latestHex, 16) : null,
    source_rpc: ETH_SEPOLIA_RPC,
  };
}

async function fetchSolanaDevnetAnchor(): Promise<AnchorFetchResult> {
  const slot = await callJsonRpc(SOLANA_DEVNET_RPC, "getSlot", [{ commitment: "confirmed" }]);
  const latestBlockhash = await callJsonRpc(SOLANA_DEVNET_RPC, "getLatestBlockhash", [{ commitment: "confirmed" }]);
  return {
    blockchain: "solana_devnet",
    network: "Solana Devnet",
    tx_hash: latestBlockhash?.value?.blockhash ?? null,
    block_number: typeof slot === "number" ? slot : null,
    source_rpc: SOLANA_DEVNET_RPC,
  };
}

async function fetchPolygonAmoyAnchor(): Promise<AnchorFetchResult> {
  const latestHex = await callJsonRpc(POLYGON_AMOY_RPC, "eth_blockNumber", []);
  const block = await callJsonRpc(POLYGON_AMOY_RPC, "eth_getBlockByNumber", [latestHex, false]);
  return {
    blockchain: "polygon_amoy",
    network: "Polygon Amoy",
    tx_hash: block?.hash ?? null,
    block_number: latestHex ? parseInt(latestHex, 16) : null,
    source_rpc: POLYGON_AMOY_RPC,
  };
}

function explorerUrl(blockchain: string, txHash: string | null, blockNumber: number | null): string | null {
  switch (blockchain) {
    case "ethereum_sepolia":
      return txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : null;
    case "solana_devnet":
      return blockNumber ? `https://explorer.solana.com/block/${blockNumber}?cluster=devnet` : null;
    case "polygon_amoy":
      return txHash ? `https://amoy.polygonscan.com/tx/${txHash}` : null;
    default:
      return null;
  }
}

async function fetchAnchorByNetwork(blockchain: string): Promise<AnchorFetchResult> {
  switch (blockchain) {
    case "ethereum_sepolia":
      return fetchEthereumSepoliaAnchor();
    case "solana_devnet":
      return fetchSolanaDevnetAnchor();
    case "polygon_amoy":
      return fetchPolygonAmoyAnchor();
    default:
      throw new Error(`Unsupported blockchain ${blockchain}`);
  }
}

export async function getAnchorStatuses(supabase: any, staleAfterMs = 90_000): Promise<AnchorStatus[]> {
  const now = Date.now();

  const rows = await Promise.all(
    BLOCKCHAIN_NETWORKS.map(async (networkDef) => {
      const { data } = await supabase
        .from("time_anchors")
        .select("blockchain, tx_hash, block_number, created_at")
        .eq("blockchain", networkDef.blockchain)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) {
        return {
          blockchain: networkDef.blockchain,
          network: networkDef.network,
          status: "syncing" as const,
          tx_hash: null,
          block_number: null,
          created_at: null,
          explorer_url: null,
        };
      }

      const createdAtMs = new Date(data.created_at).getTime();
      const isFresh = now - createdAtMs <= staleAfterMs;
      const hasProof = Boolean(data.tx_hash && data.block_number !== null);

      return {
        blockchain: networkDef.blockchain,
        network: networkDef.network,
        status: isFresh && hasProof ? "synced" as const : "syncing" as const,
        tx_hash: data.tx_hash,
        block_number: data.block_number,
        created_at: data.created_at,
        explorer_url: explorerUrl(networkDef.blockchain, data.tx_hash, data.block_number),
      };
    }),
  );

  return rows;
}

export async function ensureRecentAnchors(
  supabase: any,
  consensusHash: string,
  epoch: number,
  staleAfterMs = 30_000,
): Promise<void> {
  if (inFlightAnchorRefresh) {
    return inFlightAnchorRefresh;
  }

  inFlightAnchorRefresh = (async () => {
    const statuses = await getAnchorStatuses(supabase, staleAfterMs);
    const chainsToRefresh = statuses.filter((s) => s.status !== "synced").map((s) => s.blockchain);

    if (chainsToRefresh.length === 0) return;

    const anchorResults = await Promise.allSettled(chainsToRefresh.map((chain) => fetchAnchorByNetwork(chain)));
    const successfulAnchors = anchorResults
      .filter((result): result is PromiseFulfilledResult<AnchorFetchResult> => result.status === "fulfilled")
      .map((result) => result.value);

    if (successfulAnchors.length === 0) return;

    const rowsToInsert = successfulAnchors.map((anchor) => ({
      blockchain: anchor.blockchain,
      tx_hash: anchor.tx_hash,
      block_number: anchor.block_number,
      consensus_hash: consensusHash,
      epoch,
      validator_signatures: [
        {
          network: anchor.network,
          source_rpc: anchor.source_rpc,
          proof_hash: anchor.tx_hash,
          anchored_at: new Date().toISOString(),
        },
      ],
    }));

    await supabase.from("time_anchors").insert(rowsToInsert);
  })().finally(() => {
    inFlightAnchorRefresh = null;
  });

  await inFlightAnchorRefresh;
}
