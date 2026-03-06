#!/usr/bin/env tsx
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, "../dist/tapes");
const MANIFEST_PATH = path.resolve(__dirname, "../dist/tapes.manifest.json");

interface ManifestEntry {
  tape_id: string;
  scope_id: string;
  version: number;
  file: string;
  sha256: string | null;
  signature: string | null;
  kid: string | null;
  built_at: string;
}

interface Manifest {
  entries: ManifestEntry[];
}

function usage(): never {
  console.error("Usage: tsx tools/sign_tape.ts <tape_id> --key <path_to_ed25519_private_key>");
  console.error("");
  console.error("Generate a keypair with:");
  console.error("  openssl genpkey -algorithm Ed25519 -out prsys_private.pem");
  console.error("  openssl pkey -in prsys_private.pem -pubout -out prsys_public.pem");
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const tapeId = args[0];
  const keyFlagIndex = args.indexOf("--key");

  if (!tapeId || keyFlagIndex === -1 || !args[keyFlagIndex + 1]) {
    usage();
  }

  const keyPath = args[keyFlagIndex + 1];

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("Manifest not found. Run build_tapes_from_db.ts first.");
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const entry = manifest.entries.find(e => e.tape_id === tapeId);
  if (!entry) {
    console.error(`Tape not found in manifest: ${tapeId}`);
    console.error(`Available tapes: ${manifest.entries.map(e => e.tape_id).join(", ")}`);
    process.exit(1);
  }

  const tapeFilePath = path.join(DIST_DIR, entry.file);
  if (!fs.existsSync(tapeFilePath)) {
    console.error(`Tape file not found: ${tapeFilePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(keyPath)) {
    console.error(`Private key not found: ${keyPath}`);
    process.exit(1);
  }

  const tapeBytes = fs.readFileSync(tapeFilePath);

  const sha256 = crypto.createHash("sha256").update(tapeBytes).digest("hex");

  const privateKeyPem = fs.readFileSync(keyPath, "utf-8");
  const privateKey = crypto.createPrivateKey(privateKeyPem);

  const keyDetails = privateKey.asymmetricKeyType;
  if (keyDetails !== "ed25519") {
    console.error(`Key type mismatch: expected ed25519, got ${keyDetails}`);
    process.exit(1);
  }

  const signature = crypto.sign(null, tapeBytes, privateKey);
  const signatureHex = signature.toString("hex");

  const publicKey = crypto.createPublicKey(privateKey);
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const kid = crypto.createHash("sha256").update(publicKeyDer).digest("hex").slice(0, 16);

  entry.sha256 = sha256;
  entry.signature = signatureHex;
  entry.kid = kid;

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`Tape signed: ${tapeId}`);
  console.log(`  sha256:    ${sha256}`);
  console.log(`  signature: ${signatureHex.slice(0, 32)}...`);
  console.log(`  kid:       ${kid}`);
  console.log(`  manifest updated`);
}

main();
