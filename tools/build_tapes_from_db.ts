#!/usr/bin/env tsx
import { db } from "../server/db";
import { scopes } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.resolve(__dirname, "../dist/tapes");
const MANIFEST_PATH = path.resolve(__dirname, "../dist/tapes.manifest.json");

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
  sha256: string | null;
  signature: string | null;
  kid: string | null;
  built_at: string;
  canon_layer: CanonLayer;
}

interface Manifest {
  entries: ManifestEntry[];
}

function readManifest(): Manifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  }
  return { entries: [] };
}

function writeManifest(manifest: Manifest): void {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}

function nextVersion(manifest: Manifest, scopeId: string): number {
  const existing = manifest.entries.filter(e => e.scope_id === scopeId);
  if (existing.length === 0) return 1;
  return Math.max(...existing.map(e => e.version)) + 1;
}

function deriveCanonLayer(scope: any): CanonLayer {
  const rules = (scope.rules || []) as any[];
  const layers = rules.map((r: any) => r.layer?.toUpperCase());

  const hasEU = layers.includes("EU");
  const hasNational = layers.includes("NATIONAL");

  const ruleSourcesJoined = rules.map((r: any) => (r.source || "").toLowerCase()).join(" ");

  let norm: CanonNorm = "EU_AI_ACT";
  if (ruleSourcesJoined.includes("gdpr") || ruleSourcesJoined.includes("avg")) norm = "GDPR";
  else if (ruleSourcesJoined.includes("nis2")) norm = "NIS2";
  else if (ruleSourcesJoined.includes("bbl")) norm = "BBL";
  else if (ruleSourcesJoined.includes("omnibus")) norm = "OMNIBUS";

  if (hasEU) {
    return {
      id: "PRSYS_CORE_COMPLIANCE_LAYER",
      norm,
      norm_status: "binding",
      precedence: 0,
      override_block_permitted: false,
    };
  }

  if (hasNational) {
    return {
      id: "PRSYS_DOMAIN_LAW_LAYER",
      norm,
      norm_status: "binding",
      precedence: 1,
      override_block_permitted: false,
    };
  }

  return {
    id: "PRSYS_INTERPRETIVE_OVERLAY",
    norm,
    norm_status: "advisory",
    precedence: 2,
    override_block_permitted: false,
  };
}

function generateTapeSource(scope: any, version: number): string {
  const meta = {
    tape_id: `${scope.id}_v${version}`,
    version,
    layer: "SCOPE",
    jurisdiction: "MULTI",
    precedence: version,
  };

  const categories = (scope.categories || []).map((c: any) => ({
    name: c.name,
    label: c.label,
    status: c.status,
    escalation: c.escalation,
    keywords: c.keywords,
  }));

  const rules = (scope.rules || []).map((r: any) => ({
    ruleId: r.ruleId,
    layer: r.layer,
    domain: r.domain,
    title: r.title,
    action: r.action,
    overridesLowerLayers: r.overridesLowerLayers,
    description: r.description,
  }));

  const statusPriority = `{ "BLOCK": 0, "ESCALATE_HUMAN": 1, "ESCALATE_REGULATORY": 2, "PASS_WITH_TRANSPARENCY": 3, "PASS": 4 }`;

  return `// PRSYS TAPE — Auto-generated. Do not edit.
// scope: ${scope.name} (${scope.id})
// version: ${version}
// built: ${new Date().toISOString()}

"use strict";

const meta = ${JSON.stringify(meta, null, 2)};

const categories = ${JSON.stringify(categories, null, 2)};

const rules = ${JSON.stringify(rules, null, 2)};

const STATUS_PRIORITY = ${statusPriority};

const LAYER_ORDER = ["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"];

function matchesKeyword(text, keyword) {
  const pattern = new RegExp("\\\\b" + keyword.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + "\\\\b", "i");
  return pattern.test(text);
}

function classifyCategories(text) {
  const priorityOrder = ["BLOCK", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "PASS_WITH_TRANSPARENCY", "PASS"];
  for (const decision of priorityOrder) {
    const cats = categories.filter(c => c.status === decision);
    for (const cat of cats) {
      if (cat.keywords.some(kw => matchesKeyword(text, kw))) {
        return { status: cat.status, category: cat.name, escalation: cat.escalation };
      }
    }
  }
  const defaultPass = categories.find(c => c.status === "PASS");
  return { status: "PASS", category: defaultPass ? defaultPass.name : "Observation", escalation: null };
}

// CERBERUS_INVARIANT: most restrictive status across ALL matching rules wins.
// BLOCK > ESCALATE_HUMAN > ESCALATE_REGULATORY > PASS_WITH_TRANSPARENCY > PASS.
// Rules only apply when the input matches their domain via category classification.
// Global overrides (overridesLowerLayers) apply ONLY when the input also matches
// a category whose name contains the rule's domain — never blindly.
function resolveRules(matchedDomain) {
  if (!matchedDomain) return null;
  const domainRules = rules.filter(r => r.domain === matchedDomain);
  if (domainRules.length === 0) return null;
  const sorted = [...domainRules].sort((a, b) => (STATUS_PRIORITY[a.action] ?? 99) - (STATUS_PRIORITY[b.action] ?? 99));
  return sorted[0];
}

function findGlobalOverrides(input, classifiedCategory) {
  const applicable = [];
  for (const rule of rules) {
    if (!rule.overridesLowerLayers) continue;
    const domainCategories = categories.filter(c => c.name.toUpperCase().includes(rule.domain.toUpperCase()));
    const inputMatchesDomain = domainCategories.some(cat =>
      cat.keywords && cat.keywords.some(kw => matchesKeyword(input, kw))
    );
    if (inputMatchesDomain) applicable.push(rule);
  }
  if (applicable.length === 0) return null;
  applicable.sort((a, b) => (STATUS_PRIORITY[a.action] ?? 99) - (STATUS_PRIORITY[b.action] ?? 99));
  return applicable[0];
}

function decide(input) {
  const classification = classifyCategories(input);
  const domains = [...new Set(rules.map(r => r.domain))];
  const matchedDomain = domains.find(d => classification.category.toUpperCase().includes(d.toUpperCase()));
  const domainRule = resolveRules(matchedDomain);
  const globalOverride = findGlobalOverrides(input, classification.category);

  // CERBERUS: pick most restrictive between category, domain rule, and global override
  const candidates = [
    { action: classification.status, rule: null, source: "category" },
  ];
  if (domainRule) candidates.push({ action: domainRule.action, rule: domainRule, source: "domain" });
  if (globalOverride) candidates.push({ action: globalOverride.action, rule: globalOverride, source: "global_override" });

  candidates.sort((a, b) => (STATUS_PRIORITY[a.action] ?? 99) - (STATUS_PRIORITY[b.action] ?? 99));
  const winner = candidates[0];
  const winningRule = winner.rule;

  return {
    status: winner.action,
    category: classification.category,
    escalation: classification.escalation,
    rule_id: winningRule ? winningRule.ruleId : null,
    layer: winningRule ? winningRule.layer : null,
    reason: winningRule ? winningRule.description : null,
    tape_id: meta.tape_id,
  };
}

module.exports = { meta, decide };
`;
}

async function main() {
  const scopeId = process.argv[2];
  if (!scopeId) {
    console.error("Usage: tsx tools/build_tapes_from_db.ts <scopeId>");
    process.exit(1);
  }

  const [scope] = await db.select().from(scopes).where(eq(scopes.id, scopeId));
  if (!scope) {
    console.error(`Scope not found: ${scopeId}`);
    process.exit(1);
  }

  if (scope.status !== "LOCKED") {
    console.error(`Scope ${scopeId} is not LOCKED (status: ${scope.status}). Only locked scopes can be compiled to tapes.`);
    process.exit(1);
  }

  fs.mkdirSync(DIST_DIR, { recursive: true });

  const manifest = readManifest();
  const version = nextVersion(manifest, scopeId);
  const fileName = `${scopeId}_v${version}.js`;
  const filePath = path.join(DIST_DIR, fileName);

  const source = generateTapeSource(scope, version);
  fs.writeFileSync(filePath, source, "utf-8");

  const canonLayer = deriveCanonLayer(scope);

  manifest.entries.push({
    tape_id: `${scopeId}_v${version}`,
    scope_id: scopeId,
    version,
    file: fileName,
    sha256: null,
    signature: null,
    kid: null,
    built_at: new Date().toISOString(),
    canon_layer: canonLayer,
  });

  writeManifest(manifest);

  console.log(`Tape built: ${fileName}`);
  console.log(`  scope: ${scope.name} (${scopeId})`);
  console.log(`  version: ${version}`);
  console.log(`  categories: ${(scope.categories as any[]).length}`);
  console.log(`  rules: ${(scope.rules as any[]).length}`);
  console.log(`  manifest updated (unsigned)`);

  process.exit(0);
}

main().catch(err => {
  console.error("Build failed:", err);
  process.exit(1);
});
