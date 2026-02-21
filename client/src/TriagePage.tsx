import { useEffect, useMemo, useState } from "react";

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
  status?: string | null; // DRAFT / LOCKED etc
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
  const [scope, setScope] = useState<ScopeLite | null>(null);
  const [loadingScope, setLoadingScope] = useState(true);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ClassifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const releaseSerial = useMemo(() => {
    // fallback: toon iets bruikbaars, ook als scope nog geen serial heeft
    // (later vullen we releaseSerial/checksum echt in bij LOCK)
    const base = "IC-ERAS-2026-02";
    return base;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingScope(true);
        const r = await fetch("/api/scopes/default");
        if (!r.ok) throw new Error(`Default scope fetch failed (${r.status})`);
        const data = (await r.json()) as ScopeLite;
        if (!cancelled) setScope(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Scope load error");
      } finally {
        if (!cancelled) setLoadingScope(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onAnalyze() {
    setError(null);
    setResult(null);

    const trimmed = text.trim();
    if (!trimmed) {
      setError("Voer een observatie in.");
      return;
    }
    if (!scope?.id) {
      setError("Geen actieve dataset gevonden (default scope ontbreekt).");
      return;
    }

    try {
      setBusy(true);
      const r = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, scopeId: scope.id }),
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

  const watermarkUrl = "/resonance-bg.png"; // staat al in client/public/assets/, maar in je index.html zie ik /assets/...
  // Als jouw file echt op /assets/resonance-bg.png staat, zet hem dan op: "/assets/resonance-bg.png"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#071018",
        color: "#d7e6ee",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Watermark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${watermarkUrl})`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 55%",
          backgroundSize: "min(900px, 85vw)",
          opacity: 0.05,
          filter: "grayscale(100%) contrast(120%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", maxWidth: 980, margin: "0 auto", padding: "28px 18px 44px" }}>
        {/* CVI-style header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: 14,
            marginBottom: 22,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: 12,
            color: "rgba(215,230,238,0.78)",
          }}
        >
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ color: "#e9f3f8", fontWeight: 700 }}>ORFHEUSS</span>
            <span>C.V.I. NODE: Erasmus MC — IC</span>
            <span>SYS: PRSYS Console</span>
          </div>

          <div style={{ textAlign: "right" }}>
            <div>RELEASE: {releaseSerial}</div>
            <div style={{ opacity: 0.7 }}>
              DATASET:{" "}
              {loadingScope ? "loading..." : scope ? `${scope.name}${scope.status ? ` (${scope.status})` : ""}` : "none"}
            </div>
          </div>
        </header>

        {/* Input card */}
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
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e9f3f8" }}>TaoGate — Klinische Observatie</div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                Alleen observaties. Opdrachten/imperatieven worden geblokt of geëscaleerd volgens de actieve band.
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
              title={loadingScope ? "Dataset wordt geladen" : "Analyseer observatie"}
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
              Handleiding (Operator)
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Typ een waarneming (feitelijk). Geen opdrachten.</li>
              <li>Voorbeeld PASS: <span style={{ color: "#b7ffe9" }}>"Patiënt is onrustig, ademhaling versnelt."</span></li>
              <li>Voorbeeld ESCALATE: <span style={{ color: "#ffe7a3" }}>"Patiëntgegevens aan ouders meegeven."</span> (privacy)</li>
              <li>Als status ≠ PASS: stop, volg escalatie (DPO / Behandelaar).</li>
              <li>Deze console voert geen acties uit; het classificeert en routeert.</li>
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

        {/* Result card */}
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
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
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
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
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
                </>
              );
            })()}
          </section>
        )}
      </div>
    </div>
  );
}