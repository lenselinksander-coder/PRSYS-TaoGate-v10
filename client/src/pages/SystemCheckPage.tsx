// client/src/pages/SystemCheckPage.tsx
//
// Systeem Check — vogelperspectief op alle governance-lagen.
// "Ik zie door de bomen het bos niet meer" → duidelijk overzicht van de
// volledige ORFHEUSS kernel: één groen scherm als alles in orde is.

import { useState, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from "lucide-react";

// ── Typen ─────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  status: "OK" | "FAIL";
  detail: string;
}

interface SystemCheckReport {
  overall: "OK" | "FAIL";
  timestamp: string;
  checks: CheckResult[];
}

// ── Categorie-indeling ────────────────────────────────────────────────────────
// Elk check-name-prefix wordt toegewezen aan een laag-categorie.

const CATEGORY_MAP: { label: string; match: string[] }[] = [
  {
    label: "Kern-parameters",
    match: ["GateParams", "instability", "omega_capacity"],
  },
  {
    label: "Governance-invarianten",
    match: [
      "GDPR",
      "Cerberus",
      "Barbatos",
      "O36",
      "SI/TI",
      "DYMPHNA",
      "INUIT",
      "Monotone",
      "HOLD",
    ],
  },
  {
    label: "Valkyrie / Blootstelling",
    match: ["Valkyrie", "User exposure"],
  },
  {
    label: "Audit & Uitleg",
    match: ["explain_decision"],
  },
  {
    label: "Architectuur & Codes",
    match: ["Architecture"],
  },
];

function categorise(checks: CheckResult[]): { label: string; items: CheckResult[] }[] {
  const buckets: Record<string, CheckResult[]> = {};
  const assigned = new Set<string>();

  for (const cat of CATEGORY_MAP) {
    buckets[cat.label] = [];
  }
  buckets["Overig"] = [];

  for (const check of checks) {
    let placed = false;
    for (const cat of CATEGORY_MAP) {
      if (cat.match.some((prefix) => check.name.startsWith(prefix))) {
        buckets[cat.label].push(check);
        assigned.add(check.name);
        placed = true;
        break;
      }
    }
    if (!placed) {
      buckets["Overig"].push(check);
      assigned.add(check.name);
    }
  }

  return [
    ...CATEGORY_MAP.map((c) => ({ label: c.label, items: buckets[c.label] })),
    { label: "Overig", items: buckets["Overig"] },
  ].filter((g) => g.items.length > 0);
}

// ── Kleine componenten ────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: "OK" | "FAIL" }) {
  return status === "OK" ? (
    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
  ) : (
    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
  );
}

function CategoryBlock({
  label,
  items,
}: {
  label: string;
  items: CheckResult[];
}) {
  const allOk = items.every((c) => c.status === "OK");
  const failCount = items.filter((c) => c.status === "FAIL").length;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        background: "var(--bg-surface)",
        borderColor: allOk ? "var(--sr71-border)" : "rgba(239,68,68,0.4)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold font-mono tracking-wide" style={{ color: "var(--text-primary)" }}>
          {label}
        </h3>
        <span
          className={`text-xs font-mono px-2 py-0.5 rounded ${
            allOk
              ? "text-green-400 bg-green-900/20 border border-green-800"
              : "text-red-400 bg-red-900/20 border border-red-800"
          }`}
        >
          {allOk ? `${items.length}/${items.length} OK` : `${failCount} FAIL`}
        </span>
      </div>

      <div className="space-y-2">
        {items.map((check) => (
          <div key={check.name} className="flex items-start gap-2">
            <StatusIcon status={check.status} />
            <div className="min-w-0">
              <div
                className="text-xs font-mono font-medium truncate"
                style={{ color: check.status === "OK" ? "var(--text-primary)" : "var(--text-danger, #f87171)" }}
                title={check.name}
              >
                {check.name}
              </div>
              <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {check.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hoofd-component ───────────────────────────────────────────────────────────

export default function SystemCheckPage() {
  const [report, setReport] = useState<SystemCheckReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/system/check")
      .then((r) => {
        if (!r.ok) {
          return r.text().then((body) => {
            let msg = `HTTP ${r.status}`;
            try { msg = (JSON.parse(body) as { detail?: string; error?: string }).detail ?? (JSON.parse(body) as { error?: string }).error ?? msg; } catch { /* gebruik HTTP status */ }
            return Promise.reject(msg);
          });
        }
        return r.json();
      })
      .then((data: SystemCheckReport) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  const categories = report ? categorise(report.checks) : [];
  const failedCount = report ? report.checks.filter((c) => c.status === "FAIL").length : 0;
  const isOk = report?.overall === "OK";

  return (
    <div>
      {/* ── Koptekst ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1
            data-testid="text-page-title"
            className="text-3xl font-bold font-mono tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Systeem{" "}
            <span style={{ color: "var(--amber)" }}>Check</span>
          </h1>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--text-secondary)" }}>
            Vogelperspectief op alle ORFHEUSS governance-lagen — kern-parameters,
            invarianten, Valkyrie-firewalls en architectuur-integriteit.
          </p>
        </div>

        <button
          data-testid="button-recheck"
          onClick={runCheck}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm transition-all"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--sr71-border)",
            color: "var(--text-primary)",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {loading ? "Bezig…" : "Opnieuw controleren"}
        </button>
      </div>

      {/* ── Fout-banner ── */}
      {error && (
        <div
          className="mb-6 rounded-xl border p-4 flex items-center gap-3"
          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)", color: "#f87171" }}
        >
          <ShieldAlert className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-mono">Check kon niet worden uitgevoerd: {error}</span>
        </div>
      )}

      {/* ── Laad-skelet ── */}
      {loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border animate-pulse"
              style={{ background: "var(--bg-surface)", borderColor: "var(--sr71-border)" }}
            />
          ))}
        </div>
      )}

      {/* ── Rapport ── */}
      {!loading && report && (
        <>
          {/* Overall status banner */}
          <div
            className="mb-6 rounded-xl border p-5 flex items-center gap-4"
            style={{
              background: isOk ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.08)",
              borderColor: isOk ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.4)",
            }}
          >
            {isOk ? (
              <ShieldCheck className="w-8 h-8 text-green-400 flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-red-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div
                className={`text-lg font-bold font-mono ${isOk ? "text-green-400" : "text-red-400"}`}
              >
                {isOk
                  ? `✓ Alle ${report.checks.length} checks geslaagd — systeem in orde`
                  : `✗ ${failedCount} check(s) mislukt — actie vereist`}
              </div>
              <div className="flex items-center gap-1.5 mt-1" style={{ color: "var(--text-muted)" }}>
                <Clock className="w-3.5 h-3.5" />
                <span className="text-xs font-mono">{new Date(report.timestamp).toLocaleString("nl-NL")}</span>
              </div>
            </div>
            <span
              className={`text-xs font-mono px-3 py-1.5 rounded border font-bold ${
                isOk
                  ? "text-green-400 bg-green-900/20 border-green-800"
                  : "text-red-400 bg-red-900/20 border-red-800"
              }`}
            >
              {report.overall}
            </span>
          </div>

          {/* Categorie-kaarten */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <CategoryBlock key={cat.label} label={cat.label} items={cat.items} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
