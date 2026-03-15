export function extractPrivyEmail(user: unknown): string | null {
  const u: any = user;
  if (!u) return null;

  const directCandidates = [
    u?.email?.address,
    u?.email?.email,
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
