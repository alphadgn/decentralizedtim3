export function extractPrivyEmail(user: unknown): string | null {
  const u: any = user;
  if (!u) return null;

  const directCandidates = [
    // Some Privy user objects expose email as a string
    u?.email,
    u?.emailAddress,
    u?.email_address,

    // Common structured shapes
    u?.email?.address,
    u?.email?.email,

    // Provider-specific
    u?.google?.email,
    u?.google?.emailAddress,
    u?.apple?.email,
    u?.github?.email,
  ];

  for (const c of directCandidates) {
    if (typeof c === "string" && c.includes("@")) return c;
  }

  const linked = u?.linkedAccounts ?? u?.linked_accounts;
  if (Array.isArray(linked)) {
    for (const a of linked) {
      const candidates = [
        a?.email,
        a?.emailAddress,
        a?.email_address,
        a?.address,
        a?.details?.email,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && c.includes("@")) return c;
      }
    }
  }

  return null;
}
