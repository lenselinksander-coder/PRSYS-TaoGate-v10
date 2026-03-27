// client/src/pages/LiveGateViewPage.tsx
//
// Live Gate View — visualiseert de multi-tape pipeline in real-time.
//
// Toont per tape: tapeNumber, beslissing, reden, verwerkingstijd.
// Finale beslissing via latticeMax (I2) bovenaan.
// PICU_MAXIMA demo-knop: stuurt een gefabriceerde klinische intentie.

import { useState } from "react";
import type { JSX } from "react";
import { Zap, Building2, Shield, CheckCircle, AlertTriangle, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Organization } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface TapeEvalResult {
  tapeNumber: number | null;
  scopeId: string;
  scopeName: string;
  decision: string;
  reason: string | null;
  layer: string | null;
  ruleId: string | null;
  processingMs: number;
}

interface PipelineResult {
  orgId: string;
  intent: string;
  euBlocked: boolean;
  euGround: string | null;
  tapeResults: TapeEvalResult[];
  finalDecision: string;
  finalReason: string | null;
  processingMs: number;
}

// ── PICU_MAXIMA demo-intentie ─────────────────────────────────────────────────
const PICU_MAXIMA_INTENT =
  "Geef aanbeveling voor morfine-dosering voor kind op basis van leeftijdsgroep en gewicht. " +
  "Pas de dosis aan op basis van historische patiëntdata en optimaliseer voor sedatieniveau.";

// ── Helpers ──────────────────────────────────────────────────────────────────

const DECISION_CONFIG: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  PASS: {
    label: "PASS",
    color: "text-green-400",
    bg: "bg-green-900/20 border-green-700",
    icon: <CheckCircle className="w-4 h-4 text-green-400" />,
  },
  PASS_WITH_TRANSPARENCY: {
    label: "PASS + Transparantie",
    color: "text-blue-400",
    bg: "bg-blue-900/20 border-blue-700",
    icon: <CheckCircle className="w-4 h-4 text-blue-400" />,
  },
  ESCALATE_HUMAN: {
    label: "Escalatie → Mens",
    color: "text-orange-400",
    bg: "bg-orange-900/20 border-orange-700",
    icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
  },
  ESCALATE_REGULATORY: {
    label: "Escalatie → Toezichthouder",
    color: "text-amber-400",
    bg: "bg-amber-900/20 border-amber-700",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  },
  BLOCK: {
    label: "GEBLOKKEERD",
    color: "text-red-400",
    bg: "bg-red-900/20 border-red-700",
    icon: <XCircle className="w-4 h-4 text-red-400" />,
  },
};

function decisionConfig(d: string) {
  return DECISION_CONFIG[d] ?? { label: d, color: "text-zinc-400", bg: "bg-zinc-800 border-zinc-700", icon: <Shield className="w-4 h-4 text-zinc-400" /> };
}

function DecisionBadge({ decision }: { decision: string }) {
  const cfg = decisionConfig(decision);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TapeCard({ result, index }: { result: TapeEvalResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = decisionConfig(result.decision);

  return (
    <div className={`rounded-lg border p-4 ${cfg.bg} transition-colors`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
            {result.tapeNumber ?? index}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{result.scopeName}</p>
            {result.layer && <p className="text-xs text-zinc-500">{result.layer}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DecisionBadge decision={result.decision} />
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {result.processingMs}ms
          </span>
          {result.reason && (
            <button onClick={() => setExpanded(v => !v)} className="text-zinc-500 hover:text-zinc-300">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
      {expanded && result.reason && (
        <p className="mt-3 text-xs text-zinc-400 border-t border-zinc-700 pt-3">{result.reason}</p>
      )}
      {result.ruleId && (
        <p className="mt-1 text-xs text-zinc-600">Regel: {result.ruleId}</p>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveGateViewPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [intent, setIntent] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy-load organisaties bij eerste interactie
  function ensureOrgsLoaded() {
    if (orgsLoaded) return;
    setOrgsLoaded(true);
    fetch("/api/organizations")
      .then(r => r.json())
      .then((data: Organization[]) => setOrganizations(data))
      .catch(() => setOrganizations([]));
  }

  async function runPipeline(overrideIntent?: string) {
    const text = overrideIntent ?? intent;
    if (!selectedOrgId || !text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/multi-tape/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: selectedOrgId, intent: text }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message ?? "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }

  function runPicuMaxima() {
    setIntent(PICU_MAXIMA_INTENT);
    runPipeline(PICU_MAXIMA_INTENT);
  }

  const finalCfg = result ? decisionConfig(result.finalDecision) : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Zap className="w-6 h-6 text-yellow-400" />
        <h1 className="text-2xl font-bold text-white">Live Gate View</h1>
      </div>
      <p className="text-zinc-400 text-sm">
        Voer een intentie in en bekijk hoe de multi-tape pipeline elke tape evalueert.
        De finale beslissing is de meest restrictieve uitkomst (latticeMax, I2).
      </p>

      {/* Controls */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-zinc-300 flex items-center gap-2">
            <Building2 className="w-4 h-4" /> Configuratie
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"
            value={selectedOrgId}
            onFocus={ensureOrgsLoaded}
            onChange={e => setSelectedOrgId(e.target.value)}
          >
            <option value="">-- Kies een organisatie --</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>

          <Textarea
            placeholder="Intentie beschrijving..."
            className="bg-zinc-800 border-zinc-700 text-white text-sm resize-none"
            rows={3}
            value={intent}
            onChange={e => setIntent(e.target.value)}
          />

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!selectedOrgId || !intent.trim() || loading}
              onClick={() => runPipeline()}
            >
              {loading ? "Evalueren..." : "Evalueren"}
            </Button>
            <Button
              variant="outline"
              className="border-orange-700 text-orange-400 hover:bg-orange-900/20"
              disabled={!selectedOrgId || loading}
              onClick={runPicuMaxima}
              title="PICU_MAXIMA — klinische demo-intentie"
            >
              PICU_MAXIMA
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Foutmelding */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-700 rounded-lg px-4 py-3">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Resultaat */}
      {result && finalCfg && (
        <div className="space-y-4">
          {/* EU geblokkeerd */}
          {result.euBlocked && (
            <div className="rounded-lg border border-red-700 bg-red-900/20 px-4 py-3 text-sm text-red-300">
              <p className="font-semibold">EU AI Act Art. 5 — Absolute blokkade</p>
              {result.euGround && <p className="mt-1 text-xs text-red-400">Grond: {result.euGround}</p>}
            </div>
          )}

          {/* Tape-voor-tape */}
          {result.tapeResults.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Tape-evaluatie</h2>
              {result.tapeResults
                .slice()
                .sort((a, b) => (a.tapeNumber ?? 99) - (b.tapeNumber ?? 99))
                .map((t, i) => (
                  <TapeCard key={t.scopeId} result={t} index={i} />
                ))}
            </div>
          )}

          {/* CoVe + Sandbox indicatoren */}
          <div className="flex gap-3">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">CoVe: V(G)⊥V(L)⊥V(E)</Badge>
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">Sandbox: I6</Badge>
            <Badge variant="outline" className="text-zinc-400 border-zinc-700">
              <Clock className="w-3 h-3 mr-1" /> {result.processingMs}ms
            </Badge>
          </div>

          {/* Finale beslissing */}
          <Card className={`border ${finalCfg.bg}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Finale beslissing</p>
                  <div className="flex items-center gap-2">
                    {finalCfg.icon}
                    <span className={`text-lg font-bold ${finalCfg.color}`}>{finalCfg.label}</span>
                  </div>
                  {result.finalReason && (
                    <p className="mt-2 text-xs text-zinc-400">{result.finalReason}</p>
                  )}
                </div>
                <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
                  {result.tapeResults.length} tape{result.tapeResults.length !== 1 ? "s" : ""}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
