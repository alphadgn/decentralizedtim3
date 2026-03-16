// Phase 6: Merkle Event Ledger — Binary Merkle Tree

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export interface MerkleProofStep {
  hash: string;
  position: "left" | "right";
}

export interface MerkleTreeResult {
  root: string;
  leaves: string[];
  proofs: Record<string, MerkleProofStep[]>;
  depth: number;
}

/**
 * Build a binary Merkle tree from an array of leaf hashes.
 * Returns the root hash, full leaf list, and inclusion proofs for each leaf.
 */
export async function buildMerkleTree(leafHashes: string[]): Promise<MerkleTreeResult> {
  if (leafHashes.length === 0) {
    return { root: "empty_tree", leaves: [], proofs: {}, depth: 0 };
  }

  if (leafHashes.length === 1) {
    return {
      root: leafHashes[0],
      leaves: leafHashes,
      proofs: { [leafHashes[0]]: [] },
      depth: 0,
    };
  }

  // Pad to power of 2 by duplicating last leaf
  const leaves = [...leafHashes];
  while (leaves.length > 1 && (leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }

  // Build tree bottom-up, tracking layers for proof generation
  const layers: string[][] = [leaves];
  let currentLayer = leaves;

  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] ?? left;
      const parent = await sha256(`${left}:${right}`);
      nextLayer.push(parent);
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  const root = currentLayer[0];

  // Generate inclusion proofs for each original leaf
  const proofs: Record<string, MerkleProofStep[]> = {};

  for (let leafIdx = 0; leafIdx < leafHashes.length; leafIdx++) {
    const proof: MerkleProofStep[] = [];
    let idx = leafIdx;

    for (let layer = 0; layer < layers.length - 1; layer++) {
      const isRight = idx % 2 === 1;
      const siblingIdx = isRight ? idx - 1 : idx + 1;
      const sibling = layers[layer][siblingIdx] ?? layers[layer][idx];

      proof.push({
        hash: sibling,
        position: isRight ? "left" : "right",
      });

      idx = Math.floor(idx / 2);
    }

    proofs[leafHashes[leafIdx]] = proof;
  }

  return {
    root,
    leaves: leafHashes,
    proofs,
    depth: layers.length - 1,
  };
}

/**
 * Verify a Merkle inclusion proof for a given leaf hash against a root.
 */
export async function verifyMerkleProof(
  leafHash: string,
  proof: MerkleProofStep[],
  expectedRoot: string
): Promise<boolean> {
  let currentHash = leafHash;

  for (const step of proof) {
    if (step.position === "left") {
      currentHash = await sha256(`${step.hash}:${currentHash}`);
    } else {
      currentHash = await sha256(`${currentHash}:${step.hash}`);
    }
  }

  return currentHash === expectedRoot;
}
