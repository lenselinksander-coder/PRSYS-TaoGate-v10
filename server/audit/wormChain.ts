// server/audit/wormChain.ts
//
// WORM (Write Once Read Many) audit chain backed by S3 Object Lock.
//
// Every audit entry is written to S3 with COMPLIANCE-mode Object Lock
// (7-year retention). Entries are SHA-256 hash-chained: each entry
// includes the hash of the previous entry, forming a tamper-evident
// sequence that survives a server loss or database wipe.
//
// Usage:
//   - Call initWormChain() once at server startup to seed the chain tip
//     from the last S3 entry.
//   - Call appendWormEntry(params) from createIntent(). It is synchronous
//     from the caller's perspective (fire-and-forget) so it never delays
//     the API response.
//
// Configuration (env vars):
//   WORM_S3_BUCKET  — S3 bucket with Object Lock enabled (COMPLIANCE mode)
//                     If absent, the feature is silently disabled.
//   AWS_REGION      — Default: eu-west-1
//   AWS_ACCESS_KEY_ID
//   AWS_SECRET_ACCESS_KEY

import crypto from "crypto";

let S3Client: any;
let PutObjectCommand: any;
let GetObjectCommand: any;

async function loadS3SDK() {
  if (S3Client) return true;
  try {
    const sdk = await import("@aws-sdk/client-s3");
    S3Client = sdk.S3Client;
    PutObjectCommand = sdk.PutObjectCommand;
    GetObjectCommand = sdk.GetObjectCommand;
    return true;
  } catch {
    return false;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WormEntry {
  /** Schema version for future-proofing */
  v: 1;
  /** Monotonically increasing sequence number (per process, seeded from S3) */
  seq: number;
  /** ISO 8601 UTC timestamp */
  timestamp: string;
  /** SHA-256 of the previous WormEntry JSON (canonical, sorted keys) */
  prevHash: string;
  /** SHA-256 of this entry's canonical JSON (excluding the hash field itself) */
  hash: string;
  /** Organisation ID (may be null for anonymous calls) */
  orgId: string | null;
  /** Connector ID that triggered this intent */
  connectorId: string | null;
  /** SHA-256 of the raw input text — PII stays off WORM storage */
  inputHash: string;
  /** Gate decision: PASS | BLOCK | ESCALATE_HUMAN | … */
  decision: string;
  category: string | null;
  layer: string | null;
  pressure: string | null;
  processingMs: number | null;
}

export interface AppendWormParams {
  orgId: string | null;
  connectorId: string | null;
  inputText: string;
  decision: string;
  category: string | null;
  layer: string | null;
  pressure: string | null;
  processingMs: number | null;
}

// ── Module-level chain state ──────────────────────────────────────────────────
// Node.js is single-threaded, so these are safe without locks.

const GENESIS_HASH = "0".repeat(64);
const CHAIN_TIP_KEY = "audit/chain-tip.json";
const RETENTION_YEARS = 7;

let seq = 0;
let prevHash = GENESIS_HASH;
let s3Client: any = null;
let bucketName: string | null = null;

// ── Client initialisation ─────────────────────────────────────────────────────

function getS3(): { client: any; bucket: string } | null {
  const bucket = process.env.WORM_S3_BUCKET;
  if (!bucket || !S3Client) return null;

  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION ?? "eu-west-1",
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
    bucketName = bucket;
  }

  return { client: s3Client, bucket: bucketName! };
}

// ── Hashing helpers ───────────────────────────────────────────────────────────

function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

/**
 * Canonical JSON: keys sorted alphabetically, no extra whitespace.
 * Deterministic across Node.js versions and platforms.
 */
function canonical(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort() as any);
}

// ── Startup: seed chain tip from S3 ──────────────────────────────────────────

/**
 * Call once at server startup.
 * If WORM_S3_BUCKET is not set, this is a no-op.
 * If S3 contains a chain-tip record, seeds prevHash and seq from it
 * so the chain continues correctly after a server restart.
 */
export async function initWormChain(): Promise<void> {
  await loadS3SDK();
  const ctx = getS3();
  if (!ctx) return;

  try {
    const resp = await ctx.client.send(
      new GetObjectCommand({ Bucket: ctx.bucket, Key: CHAIN_TIP_KEY }),
    );
    const body = await resp.Body?.transformToString("utf8");
    if (body) {
      const tip = JSON.parse(body) as { lastHash: string; lastSeq: number };
      prevHash = tip.lastHash ?? GENESIS_HASH;
      seq = (tip.lastSeq ?? -1) + 1;
      console.log(`[worm] Chain seeded from S3 tip: seq=${seq}, prevHash=${prevHash.slice(0, 12)}…`);
    }
  } catch {
    // chain-tip.json does not exist yet — this is the first run
    console.log("[worm] No existing chain tip — starting from genesis.");
  }
}

// ── Append: fire-and-forget ───────────────────────────────────────────────────

/**
 * Append an audit entry to the WORM chain.
 * Returns void synchronously — the S3 write is fire-and-forget.
 * If WORM_S3_BUCKET is not set, this is a no-op.
 */
export function appendWormEntry(params: AppendWormParams): void {
  const ctx = getS3();
  if (!ctx) return;

  // Advance chain pointers synchronously (event-loop ordering guarantees
  // that concurrent async calls get distinct, monotone seq numbers).
  const currentSeq = seq++;
  const currentPrevHash = prevHash;

  const entryWithoutHash: Omit<WormEntry, "hash"> = {
    v: 1,
    seq: currentSeq,
    timestamp: new Date().toISOString(),
    prevHash: currentPrevHash,
    orgId: params.orgId,
    connectorId: params.connectorId,
    inputHash: sha256(params.inputText),
    decision: params.decision,
    category: params.category,
    layer: params.layer,
    pressure: params.pressure,
    processingMs: params.processingMs,
  };

  const entryHash = sha256(canonical(entryWithoutHash as Record<string, unknown>));
  // Update in-memory chain tip before the async write so subsequent calls
  // chain correctly even if the S3 write is still in-flight.
  prevHash = entryHash;

  const fullEntry: WormEntry = { ...entryWithoutHash, hash: entryHash };

  // Fire-and-forget: never awaited, never blocks the API response
  void writeEntryToS3(ctx.client, ctx.bucket, fullEntry);
}

// ── S3 write ──────────────────────────────────────────────────────────────────

async function writeEntryToS3(
  client: S3Client,
  bucket: string,
  entry: WormEntry,
): Promise<void> {
  const date = entry.timestamp.slice(0, 10); // YYYY-MM-DD
  const uuid = crypto.randomUUID();
  const key = `audit/${date}/${String(entry.seq).padStart(10, "0")}-${uuid}.json`;
  const body = JSON.stringify(entry, null, 2);

  const retainUntil = new Date(
    Date.now() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000,
  );

  try {
    // Write the immutable entry with COMPLIANCE Object Lock
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
        ObjectLockMode: "COMPLIANCE",
        ObjectLockRetainUntilDate: retainUntil,
      }),
    );

    // Update the mutable chain-tip pointer (not Object-Locked so it can
    // be overwritten by the next entry)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: CHAIN_TIP_KEY,
        Body: JSON.stringify({ lastHash: entry.hash, lastSeq: entry.seq }),
        ContentType: "application/json",
      }),
    );
  } catch (err) {
    // Never propagate — fire-and-forget must not affect the API response
    console.error(`[worm] S3 write failed for seq=${entry.seq}:`, err);
  }
}
