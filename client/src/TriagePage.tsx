import { useEffect, useMemo, useState, useCallback } from "react";
import { Eye } from "lucide-react";

type GateDecision =
  | "PASS"
  | "PASS_WITH_TRANSPARENCY"
  | "ESCALATE_HUMAN"
  | "ESCALATE_REGULATORY"
  | "BLOCK";

type ScopeLite = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  orgName?: string | null;
  ingestMeta?: any;
};

type ClassifyResponse = {
  status: GateDecision;
  olympia: string | null;
  layer: string;
  pressure: string | number;
  escalation: string | null;
  reason: string | null;
  winningRule: any | null;
  signals: any | null;
  onderbouwing?: string | null;
};

function badgeTone(decision: GateDecision) {
  switch (decision) {
    case "BLOCK":
      return { bg: "#3b0a0a", fg: "#ffb4b4", bd: "#7a1d1d", label: "STOP" };
    case "ESCALATE_REGULATORY":
      return { bg: "#22110a", fg: "#ffd2b4", bd: "#7a3a1d", label: "ESCALATE REGULATORY" };
    case "ESCALATE_HUMAN":
      return { bg: "#1b1606", fg: "#ffe7a3", bd: "#7a651d", label: "ESCALATE HUMAN" };
    case "PASS_WITH_TRANSPARENCY":
      return { bg: "#071b16", fg: "#b7ffe9", bd: "#1d7a65", label: "PASS (TRANSPARENCY)" };
    default:
      return { bg: "#07161b", fg: "#b4f0ff", bd: "#1d5f7a", label: "PASS" };
  }
}

export default function TriagePage() {
  const [scopes, setScopes] = useState<ScopeLite[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  const [loadingScope, setLoadingScope] = useState(true);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoadingScope(true);
        const r = await fetch("/api/scopes");
        if (!r.ok) throw new Error(`Scopes fetch failed (${r.status})`);
        const data = (await r.json()) as ScopeLite[];
        setScopes(data);
        if (data.length > 0) {
          const locked = data.find(s => s.status === "LOCKED");
          setSelectedScopeId(locked?.id || data[0].id);
        }
      } catch (e: any) {
        setError(e?.message ?? "Scope load error");
      } finally {
        setLoadingScope(false);
      }
    })();
  }, []);

  const selectedScope = scopes.find(s => s.id === selectedScopeId);

  async function onAnalyze() {
    setError(null);
    setResult(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Voer een observatie in.");
      return;
    }
    if (!selectedScopeId) {
      setError("Geen actieve dataset gevonden (selecteer een scope).");
      return;
    }

    try {
      setBusy(true);
      const r = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, scopeId: selectedScopeId }),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.error ? JSON.stringify(data.error) : `Classify failed (${r.status})`);
      }
      setResult(data as ClassifyResponse);
    } catch (e: any) {
      setError(e?.message ?? "Analyse fout");
    } finally {
      setBusy(false);
    }
  }

  const onAnalyzeRef = useCallback(onAnalyze, [text, selectedScopeId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        onAnalyzeRef();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onAnalyzeRef]);

  return (
    <div>
      <div className="mb-6">
        <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
          <Eye className="w-6 h-6 text-cyan-400" />
          ARGOS — TaoGate
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Pre-governance classificatie met pluggable gate-profielen. Voer een intent in en het systeem classificeert, escaleert of blokkeert.
        </p>
        <p className="text-xs text-primary/50 mt-1 font-mono">⌘Enter om te analyseren</p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs text-muted-foreground">Scope:</label>
        <select
          data-testid="select-scope"
          value={selectedScopeId}
          onChange={e => setSelectedScopeId(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs font-mono"
          disabled={loadingScope}
        >
          {scopes.filter(s => s.status === "LOCKED").map(s => (
            <option key={s.id} value={s.id}>{s.orgName ? `${s.orgName} — ` : ""}{s.name} {s.status ? `(${s.status})` : ""}</option>
          ))}
        </select>
        {selectedScope && (
          <span className="text-[10px] text-muted-foreground">
            {selectedScope.description}
          </span>
        )}
      </div>

      <section
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: 18,
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e9f3f8" }}>TaoGate — Intent Classificatie</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
              Voer een intent of observatie in. Het gate-profiel van de organisatie bepaalt welke patronen worden geblokkeerd of geëscaleerd.
            </div>
          </div>

          <button
            data-testid="button-analyze"
            onClick={onAnalyze}
            disabled={busy || loadingScope}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(180,240,255,0.35)",
              background: busy ? "rgba(180,240,255,0.10)" : "rgba(180,240,255,0.14)",
              color: "#b4f0ff",
              fontWeight: 700,
              cursor: busy ? "not-allowed" : "pointer",
              height: 42,
            }}
            title={loadingScope ? "Dataset wordt geladen" : "Analyseer intent"}
          >
            {busy ? "Analyseren…" : "Analyseer"}
          </button>
        </div>

        <div
          data-testid="handleiding-block"
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(180,240,255,0.12)",
            background: "rgba(180,240,255,0.04)",
            fontSize: 12,
            lineHeight: 1.65,
            color: "rgba(215,230,238,0.72)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#b4f0ff", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11 }}>
            Handleiding
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Typ een waarneming of intent.</li>
            <li>Het systeem past het gate-profiel toe (klinisch, financieel, juridisch, etc.)</li>
            <li>Daarna volgt scope-classificatie en OLYMPIA-regelresolutie.</li>
            <li>Als status ≠ PASS: stop, volg de escalatie-instructie.</li>
          </ul>
        </div>

        <textarea
          data-testid="input-observation"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Voorbeeld: 'Patiënt onrustig; ademhaling versnelt; saturatie daalt sinds 10 minuten.'"
          style={{
            marginTop: 14,
            width: "100%",
            minHeight: 140,
            resize: "vertical",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.25)",
            color: "#e9f3f8",
            padding: 12,
            outline: "none",
            lineHeight: 1.45,
          }}
        />

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,120,120,0.35)",
              background: "rgba(120,0,0,0.18)",
              color: "#ffb4b4",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}
      </section>

      {result && (
        <section
          style={{
            marginTop: 16,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 14,
            padding: 18,
            backdropFilter: "blur(6px)",
          }}
        >
          {(() => {
            const tone = badgeTone(result.status);
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        data-testid="status-badge"
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          fontSize: 12,
                          textTransform: "uppercase",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        }}
                      >
                        {tone.label}
                      </span>

                      <span data-testid="text-olympia" style={{ fontSize: 15, fontWeight: 800, color: "#e9f3f8" }}>{result.olympia ?? "-"}</span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                      Escalatie: <span data-testid="text-escalation" style={{ color: "#e9f3f8" }}>{result.escalation ?? "geen"}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                      opacity: 0.8,
                    }}
                  >
                    <div data-testid="text-olympia-label">OLYMPIA: {result.olympia ?? "-"}</div>
                    <div data-testid="text-layer">LAYER: {result.layer ?? "-"}</div>
                    <div data-testid="text-pressure">PRESSURE: {String(result.pressure ?? "-")}</div>
                  </div>
                </div>

                {result.reason && (
                  <div
                    data-testid="reason-block"
                    style={{
                      marginTop: 12,
                      padding: 12,
                      borderRadius: 12,
                      border: `1px solid ${tone.bd}44`,
                      background: `${tone.bg}88`,
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {result.winningRule ? "Olympia winnende regel" : "Reden"}
                    </div>
                    {result.winningRule?.title && (
                      <div style={{ marginTop: 6, fontSize: 14, fontWeight: 800, color: "#e9f3f8" }}>
                        {result.winningRule.title}
                      </div>
                    )}
                    <div data-testid="text-reason" style={{ marginTop: 6, fontSize: 13, color: tone.fg, opacity: 0.9, lineHeight: 1.45 }}>
                      {result.reason}
                    </div>
                  </div>
                )}

                {result.onderbouwing && (
                  <div
                    data-testid="onderbouwing-block"
                    style={{
                      marginTop: 10,
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(96,165,250,0.2)",
                      background: "rgba(96,165,250,0.05)",
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                      Onderbouwing (Perplexity)
                    </div>
                    <div style={{ fontSize: 13, color: "#c4dff6", lineHeight: 1.5 }}>
                      {result.onderbouwing}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}
    </div>
  );
}
