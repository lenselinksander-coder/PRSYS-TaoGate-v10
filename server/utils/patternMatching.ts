// server/utils/patternMatching.ts
//
// Shared text-matching utilities used by gateSystem.ts and clinicalGate.ts.
// The WASM bundle (bundledGates.ts) keeps its own inline copies because it
// must be entirely self-contained (no imports, no host I/O).

export function normalize(input: string): string {
  return (input ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function hits(lower: string, patterns: (string | RegExp)[]): string[] {
  const matched: string[] = [];
  for (const p of patterns) {
    if (typeof p === "string") {
      if (lower.includes(p)) matched.push(p);
    } else {
      if (p.test(lower)) matched.push(String(p));
    }
  }
  return matched;
}
