// PRSYS_INVARIANT: runtime executes tapes only. DB is authoring, not execution.
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, "../../dist/tapes");
const MANIFEST_PATH = path.resolve(__dirname, "../../dist/tapes.manifest.json");

// CANON_LAYER_INVARIANT: Interpretive layers may add obligations.
// They may never override a BLOCK from a lower layer.
// This is not a legal hierarchy. It is an architectural layer structure.
type CanonLayerId = "PRSYS_CORE_COMPLIANCE_LAYER" | "PRSYS_DOMAIN_LAW_LAYER" | "PRSYS_INTERPRETIVE_OVERLAY";
type CanonNorm = "EU_AI_ACT" | "GDPR" | "NIS2" | "BBL" | "OMNIBUS";
type CanonNormStatus = "binding" | "proposed" | "advisory";

interface CanonLayer {
  id: CanonLayerId;
  norm: CanonNorm;
  norm_status: CanonNormStatus;
  precedence: number;
  override_block_permitted: false;
}

interface ManifestEntry {
  tape_id: string;
  scope_id: string;
  version: number;
  file: string;
  sha256: string;
  signature: string;
  kid: string;
  built_at: string;
  canon_layer: CanonLayer;
}

interface Manifest {
  entries: ManifestEntry[];
}

export interface TapeModule {
  meta: {
    tape_id: string;
    version: number;
    layer: string;
    jurisdiction: string;
    precedence: number;
  };
  decide: (input: string) => {
    status: string;
    category: string;
    escalation: string | null;
    rule_id: string | null;
    layer: string | null;
    reason: string | null;
    tape_id: string;
  };
}

export interface TapeDeck {
  tapes: Map<string, TapeModule>;
  byScopeId: Map<string, TapeModule>;
  manifest: Manifest;
}

let _tapeDeck: TapeDeck | null = null;

export function getTapeDeck(): TapeDeck | null {
  return _tapeDeck;
}

export function bootstrapTapeDeck(publicKeyPath?: string): TapeDeck {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log("[TapeDeck] No manifest found at", MANIFEST_PATH, "— running without tapes.");
    _tapeDeck = { tapes: new Map(), byScopeId: new Map(), manifest: { entries: [] } };
    return _tapeDeck;
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));

  // CANON_LAYER_INVARIANT: validate ALL manifest entries before any tape loading.
  // Interpretive layers may add obligations. They may never override a BLOCK from a lower layer.
  // This is not a legal hierarchy. It is an architectural layer structure.
  const DEFAULT_CANON_LAYER: CanonLayer = {
    id: "PRSYS_CORE_COMPLIANCE_LAYER",
    norm: "EU_AI_ACT",
    norm_status: "binding",
    precedence: 0,
    override_block_permitted: false,
  };
  for (const entry of manifest.entries) {
    if (!entry.canon_layer) {
      entry.canon_layer = DEFAULT_CANON_LAYER;
      console.log(`[TapeDeck] Legacy entry ${entry.tape_id} — assigned default canon_layer (PRSYS_CORE_COMPLIANCE_LAYER).`);
    }
    if (entry.canon_layer.id === "PRSYS_INTERPRETIVE_OVERLAY" && (entry.canon_layer.override_block_permitted as unknown) === true) {
      throw new Error(
        `[TapeDeck] FAIL-FAST: CANON_LAYER_INVARIANT violated for ${entry.tape_id}.\n` +
        `  PRSYS_INTERPRETIVE_OVERLAY may NEVER have override_block_permitted: true.\n` +
        `  Interpretive layers may add obligations. They may never override a BLOCK from a lower layer.`
      );
    }
  }

  const signedEntries = manifest.entries.filter(e => e.sha256 && e.signature && e.kid);

  if (signedEntries.length === 0) {
    console.log("[TapeDeck] No signed tapes in manifest — running without tapes.");
    _tapeDeck = { tapes: new Map(), byScopeId: new Map(), manifest };
    return _tapeDeck;
  }

  let publicKey: crypto.KeyObject | null = null;
  const resolvedKeyPath = publicKeyPath || process.env.PRSYS_PUBLIC_KEY_PATH;
  if (resolvedKeyPath && fs.existsSync(resolvedKeyPath)) {
    const pem = fs.readFileSync(resolvedKeyPath, "utf-8");
    publicKey = crypto.createPublicKey(pem);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new Error(`[TapeDeck] FAIL-FAST: Public key type mismatch. Expected ed25519, got ${publicKey.asymmetricKeyType}`);
    }
  } else if (signedEntries.length > 0) {
    throw new Error(
      `[TapeDeck] FAIL-FAST: ${signedEntries.length} signed tape(s) in manifest but no public key found.\n` +
      `  Set PRSYS_PUBLIC_KEY_PATH or pass publicKeyPath to bootstrapTapeDeck().`
    );
  }

  const tapes = new Map<string, TapeModule>();
  const byScopeId = new Map<string, TapeModule>();
  let verified = 0;

  for (const entry of signedEntries) {
    const tapeFilePath = path.join(DIST_DIR, entry.file);

    if (!fs.existsSync(tapeFilePath)) {
      throw new Error(`[TapeDeck] FAIL-FAST: Tape file missing: ${entry.file} (tape_id: ${entry.tape_id})`);
    }

    const tapeBytes = fs.readFileSync(tapeFilePath);

    const computedHash = crypto.createHash("sha256").update(tapeBytes).digest("hex");
    if (computedHash !== entry.sha256) {
      throw new Error(
        `[TapeDeck] FAIL-FAST: SHA-256 mismatch for ${entry.tape_id}.\n` +
        `  Expected: ${entry.sha256}\n` +
        `  Computed: ${computedHash}`
      );
    }

    if (publicKey) {
      const signatureBuffer = Buffer.from(entry.signature, "hex");
      const valid = crypto.verify(null, tapeBytes, publicKey, signatureBuffer);
      if (!valid) {
        throw new Error(
          `[TapeDeck] FAIL-FAST: Ed25519 signature invalid for ${entry.tape_id} (kid: ${entry.kid})`
        );
      }
    }

    const require = createRequire(import.meta.url);
    const tapeModule = require(tapeFilePath) as TapeModule;

    if (!tapeModule.meta || !tapeModule.decide || typeof tapeModule.decide !== "function") {
      throw new Error(`[TapeDeck] FAIL-FAST: Tape ${entry.tape_id} missing meta or decide() export.`);
    }

    // A4: Isolated Execution — freeze tape module to prevent mutable state
    if (tapeModule.meta) Object.freeze(tapeModule.meta);
    Object.freeze(tapeModule);

    tapes.set(entry.tape_id, tapeModule);

    const existingForScope = byScopeId.get(entry.scope_id);
    if (!existingForScope || tapeModule.meta.version > existingForScope.meta.version) {
      byScopeId.set(entry.scope_id, tapeModule);
    }

    verified++;
  }

  console.log(`[TapeDeck] Loaded ${verified} verified tape(s) from manifest.`);
  _tapeDeck = { tapes, byScopeId, manifest };
  return _tapeDeck;
}
