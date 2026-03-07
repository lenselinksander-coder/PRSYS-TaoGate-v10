import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Settings } from "lucide-react";

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

function computeOversight(result: ClassifyResponse, scopeOrgName?: string | null) {
  const oversightRequired = ["ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"].includes(result.status);
  const responsibleActor = scopeOrgName ?? "BIG-geregistreerde arts";
  const clinicalRisk = (() => {
    if (result.status === "BLOCK" && String(result.pressure) === "CRITICAL") return "KRITISCH";
    if (result.status === "BLOCK" || result.status === "ESCALATE_REGULATORY") return "HOOG";
    if (result.status === "ESCALATE_HUMAN") return "MIDDEL";
    return "LAAG";
  })();
  const aiReliability = ({ PASS: 95, PASS_WITH_TRANSPARENCY: 88, ESCALATE_HUMAN: 72, ESCALATE_REGULATORY: 65, BLOCK: 82 } as Record<string, number>)[result.status] ?? 75;
  return { oversightRequired, responsibleActor, clinicalRisk, aiReliability };
}

function OversightBanner({ oversight }: { oversight: ReturnType<typeof computeOversight> }) {
  const { oversightRequired, responsibleActor, clinicalRisk, aiReliability } = oversight;
  const riskColor = { LAAG: "#86efac", MIDDEL: "#fbbf24", HOOG: "#f87171", KRITISCH: "#ef4444" }[clinicalRisk] ?? "#e9f3f8";
  const borderColor = oversightRequired ? "rgba(251,191,36,0.35)" : "rgba(96,165,250,0.2)";
  const bg = oversightRequired ? "rgba(120,80,0,0.10)" : "rgba(30,60,100,0.10)";

  return (
    <div
      style={{
        marginBottom: 14,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: bg,
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        display: "flex",
        flexWrap: "wrap",
        gap: "10px 20px",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>Human Oversight</span>
        <span style={{ fontWeight: 700, color: oversightRequired ? "#fbbf24" : "#86efac", letterSpacing: "0.06em" }}>
          {oversightRequired ? "VEREIST" : "NIET VEREIST"}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>Responsible Actor</span>
        <span style={{ fontWeight: 600, color: "#c4dff6" }}>{responsibleActor}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>Clinical Risk</span>
        <span style={{ fontWeight: 700, color: riskColor }}>{clinicalRisk}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>AI Reliability</span>
        <span style={{ fontWeight: 700, color: aiReliability >= 88 ? "#86efac" : aiReliability >= 72 ? "#fbbf24" : "#f87171" }}>{aiReliability}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ opacity: 0.5, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 9 }}>Human Review</span>
        <span style={{ fontWeight: 700, color: oversightRequired ? "#fbbf24" : "#86efac" }}>
          {oversightRequired ? "REQUIRED" : "NOT REQUIRED"}
        </span>
      </div>
    </div>
  );
}

function badgeTone(decision: GateDecision) {
  switch (decision) {
    case "BLOCK":
      return { bg: "#3b0a0a", fg: "#ffb4b4", bd: "#7a1d1d", label: "STOP", glow: "rgba(239,68,68,0.15)" };
    case "ESCALATE_REGULATORY":
      return { bg: "#22110a", fg: "#ffd2b4", bd: "#7a3a1d", label: "ESCALATE REGULATORY", glow: "rgba(245,158,11,0.15)" };
    case "ESCALATE_HUMAN":
      return { bg: "#1b1606", fg: "#ffe7a3", bd: "#7a651d", label: "ESCALATE HUMAN", glow: "rgba(251,146,60,0.15)" };
    case "PASS_WITH_TRANSPARENCY":
      return { bg: "#071b16", fg: "#b7ffe9", bd: "#1d7a65", label: "PASS (TRANSPARENCY)", glow: "rgba(34,197,94,0.1)" };
    default:
      return { bg: "#07161b", fg: "#b4f0ff", bd: "#1d5f7a", label: "PASS", glow: "rgba(96,165,250,0.1)" };
  }
}

export default function CVIPage() {
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
      setError("Geen actieve dataset gevonden.");
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0a0e14 0%, #0d1520 40%, #0a0e14 100%)",
        color: "#d7e6ee",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <header
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(180,240,255,0.08)",
              border: "1px solid rgba(180,240,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldAlert style={{ width: 18, height: 18, color: "#5eead4" }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, fontFamily: "ui-monospace, monospace", letterSpacing: "-0.02em" }}>
              ORFHEUSS
            </div>
            <div style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", color: "rgba(180,240,255,0.4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              GOVERNANCE CONSOLE
            </div>
          </div>
        </div>
        <Link
          to="/admin"
          data-testid="link-admin"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(180,240,255,0.4)",
            textDecoration: "none",
          }}
          title="Admin Console"
        >
          <Settings style={{ width: 16, height: 16 }} />
        </Link>
      </header>

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px 40px" }}>
        <section
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "#e9f3f8" }}>
            TaoGate — {selectedScope?.name || "Classificatie"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, lineHeight: 1.5 }}>
            Alleen observaties. Opdrachten/imperatieven worden geblokt of geëscaleerd volgens de actieve band.
          </div>

          {scopes.filter(s => s.status === "LOCKED").length > 1 && (
            <div style={{ marginTop: 12 }}>
              <select
                data-testid="select-scope"
                value={selectedScopeId}
                onChange={e => setSelectedScopeId(e.target.value)}
                style={{
                  width: "100%",
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.3)",
                  color: "#d7e6ee",
                  padding: "0 10px",
                  fontSize: 13,
                  fontFamily: "ui-monospace, monospace",
                  outline: "none",
                }}
                disabled={loadingScope}
              >
                {scopes.filter(s => s.status === "LOCKED").map(s => (
                  <option key={s.id} value={s.id}>{s.orgName ? `${s.orgName} — ` : ""}{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <button
            data-testid="button-analyze"
            onClick={onAnalyze}
            disabled={busy || loadingScope}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 10,
              border: "1px solid rgba(180,240,255,0.35)",
              background: busy ? "rgba(180,240,255,0.06)" : "rgba(180,240,255,0.12)",
              color: "#b4f0ff",
              fontWeight: 700,
              fontSize: 14,
              cursor: busy ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {busy ? "Analyseren…" : "Analyseer"}
          </button>

          <textarea
            data-testid="input-observation"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Voer hier een observatie of intent in…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onAnalyze();
              }
            }}
            style={{
              marginTop: 14,
              width: "100%",
              minHeight: 120,
              resize: "vertical",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.25)",
              color: "#e9f3f8",
              padding: 14,
              outline: "none",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          />

          {error && (
            <div
              data-testid="text-error"
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,120,120,0.35)",
                background: "rgba(120,0,0,0.18)",
                color: "#ffb4b4",
                fontSize: 13,
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
              borderRadius: 16,
              padding: 20,
            }}
          >
            {(() => {
              const tone = badgeTone(result.status);
              const selectedScope = scopes.find(s => s.id === selectedScopeId);
              return (
                <>
                  <OversightBanner oversight={computeOversight(result, selectedScope?.orgName)} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <span
                        data-testid="status-badge"
                        style={{
                          display: "inline-block",
                          padding: "6px 12px",
                          borderRadius: 999,
                          border: `1px solid ${tone.bd}`,
                          background: tone.bg,
                          color: tone.fg,
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          fontSize: 12,
                          textTransform: "uppercase",
                          fontFamily: "ui-monospace, monospace",
                          boxShadow: `0 0 20px ${tone.glow}`,
                        }}
                      >
                        {tone.label}
                      </span>

                      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                        Escalatie: <span data-testid="text-escalation" style={{ color: "#e9f3f8", fontWeight: 600 }}>{result.escalation ?? "geen"}</span>
                      </div>
                    </div>

                    <div
                      style={{
                        textAlign: "right",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: 11,
                        opacity: 0.7,
                        lineHeight: 1.8,
                      }}
                    >
                      <div data-testid="text-olympia-label">OLYMPIA: {result.olympia ?? "—"}</div>
                      <div data-testid="text-layer">LAYER: {result.layer ?? "—"}</div>
                      <div data-testid="text-pressure">PRESSURE: {String(result.pressure ?? "—")}</div>
                    </div>
                  </div>

                  {result.reason && (
                    <div
                      data-testid="reason-block"
                      style={{
                        marginTop: 14,
                        padding: 14,
                        borderRadius: 12,
                        border: `1px solid ${tone.bd}44`,
                        background: `${tone.bg}88`,
                      }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.6, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                        {result.winningRule ? "Olympia winnende regel" : "Reden"}
                      </div>
                      {result.winningRule?.title && (
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#e9f3f8", marginBottom: 4 }}>
                          {result.winningRule.title}
                        </div>
                      )}
                      <div data-testid="text-reason" style={{ fontSize: 13, color: tone.fg, opacity: 0.9, lineHeight: 1.5 }}>
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
                      <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                        Onderbouwing (Perplexity)
                      </div>
                      <div style={{ fontSize: 13, color: "#c4dff6", lineHeight: 1.5 }}>
                        {result.onderbouwing}
                      </div>
                    </div>
                  )}

                  {(result.status === "BLOCK" || result.status === "ESCALATE_HUMAN" || result.status === "ESCALATE_REGULATORY") && result.winningRule && (result.winningRule.article || result.winningRule.sourceUrl) && (
                    <div
                      data-testid="evidence-block"
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid rgba(255,200,80,0.2)",
                        background: "rgba(255,200,80,0.04)",
                      }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                        Juridische Grondslag
                      </div>
                      {result.winningRule.source && (
                        <div style={{ fontSize: 12, color: "#d4a63a", fontWeight: 600, marginBottom: 2 }}>
                          {result.winningRule.source}
                        </div>
                      )}
                      {result.winningRule.article && (
                        <div style={{ fontSize: 13, color: "#e9f3f8", marginBottom: 4 }}>
                          {result.winningRule.article}
                        </div>
                      )}
                      {result.winningRule.citation && (
                        <div style={{ fontSize: 12, color: "rgba(180,240,255,0.6)", fontStyle: "italic", marginBottom: 6, lineHeight: 1.5 }}>
                          "{result.winningRule.citation}"
                        </div>
                      )}
                      {result.winningRule.sourceUrl && (
                        <a
                          href={result.winningRule.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            color: "#60a5fa",
                            textDecoration: "none",
                            borderBottom: "1px solid rgba(96,165,250,0.3)",
                            paddingBottom: 1,
                          }}
                        >
                          ↗ Bekijk bron
                        </a>
                      )}
                    </div>
                  )}

                  {result.signals && Object.keys(result.signals).length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.02)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                        Signalen
                      </div>
                      <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "rgba(180,240,255,0.6)", wordBreak: "break-all" }}>
                        {JSON.stringify(result.signals)}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        )}

        <div style={{ textAlign: "center", marginTop: 32, fontSize: 10, fontFamily: "ui-monospace, monospace", color: "rgba(180,240,255,0.2)", letterSpacing: "0.1em" }}>
          PRSYS — TaoGate classificeert · OLYMPIA verdeelt kracht · De mens autoriseert
        </div>
      </main>
    </div>
  );
}
