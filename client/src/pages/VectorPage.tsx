import { useState } from "react";
import { Triangle, AlertTriangle, CheckCircle, XCircle, Activity, Play } from "lucide-react";

const STABILITY_NO_GO = 0.4;
const STABILITY_HOLD = 0.7;

function calcMean(m: number, i: number, l: number) {
  return (m + i + l) / 3;
}

function calcVariance(m: number, i: number, l: number) {
  const mean = calcMean(m, i, l);
  return ((m - mean) ** 2 + (i - mean) ** 2 + (l - mean) ** 2) / 3;
}

function calcStability(variance: number) {
  return 1 - Math.sqrt(Math.max(0, variance));
}

function calcRisk(stability: number, mean: number) {
  return (1 - stability) * mean;
}

function getDecision(stability: number): "GO" | "HOLD" | "NO_GO" {
  if (stability < STABILITY_NO_GO) return "NO_GO";
  if (stability < STABILITY_HOLD) return "HOLD";
  return "GO";
}

function decisionColor(d: string) {
  switch (d) {
    case "GO":
      return { color: "#00ff41", bg: "rgba(0,255,65,0.08)", border: "rgba(0,255,65,0.40)" };
    case "HOLD":
      return { color: "#ffaa00", bg: "rgba(255,170,0,0.08)", border: "rgba(255,170,0,0.40)" };
    case "NO_GO":
      return { color: "#ff4444", bg: "rgba(255,68,68,0.08)", border: "rgba(255,68,68,0.40)" };
    default:
      return { color: "#888", bg: "rgba(128,128,128,0.08)", border: "rgba(128,128,128,0.25)" };
  }
}

function decisionExplanation(d: string) {
  switch (d) {
    case "GO":
      return "Governance-vector stabiel — uitvoering toegestaan.";
    case "HOLD":
      return "Governance-vector matig stabiel — menselijke review vereist vóór uitvoering.";
    case "NO_GO":
      return "Governance-vector instabiel — uitvoering geblokkeerd.";
    default:
      return "";
  }
}

type TraceVectorStep = {
  name: string;
  symbol: string;
  role: string;
  decision: string;
  detail: string;
  durationMs: number;
};

export default function VectorPage() {
  const [mandate, setMandate] = useState(0.8);
  const [integrity, setIntegrity] = useState(0.7);
  const [load, setLoad] = useState(0.6);

  const [traceInput, setTraceInput] = useState("");
  const [traceBusy, setTraceBusy] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [traceVectorStep, setTraceVectorStep] = useState<TraceVectorStep | null>(null);

  const mean = calcMean(mandate, integrity, load);
  const variance = calcVariance(mandate, integrity, load);
  const stability = calcStability(variance);
  const risk = calcRisk(stability, mean);
  const decision = getDecision(stability);
  const dc = decisionColor(decision);

  async function runTrace() {
    if (!traceInput.trim()) return;
    setTraceBusy(true);
    setTraceError(null);
    setTraceVectorStep(null);
    try {
      const r = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: traceInput }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Trace fout (${r.status}): ${text.slice(0, 200)}`);
      }
      const data = await r.json();
      const vectorStep = (data.steps || []).find((s: any) => s.name === "Vector");
      if (vectorStep) {
        setTraceVectorStep(vectorStep);
      } else {
        setTraceError("Geen Vector-stap gevonden in trace-resultaat.");
      }
    } catch (e: any) {
      setTraceError(e?.message ?? "Fout bij trace");
    } finally {
      setTraceBusy(false);
    }
  }

  const sliderStyle: React.CSSProperties = {
    width: "100%",
    accentColor: "#00ff41",
    cursor: "pointer",
    background: "transparent",
  };

  return (
    <div style={{ fontFamily: "monospace", color: "#b8ffb8" }}>
      <div className="mb-6">
        <h1
          data-testid="text-page-title"
          className="text-2xl font-bold font-mono flex items-center gap-3"
        >
          <Triangle className="w-6 h-6 text-primary" />
          VECTOR ENGINE — Legitimacy Simulator
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Interactieve vector-simulator: evalueer de governance-stabiliteit van drie dimensies (mandate × integrity × load).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div
          style={{
            background: "rgba(0,255,65,0.03)",
            border: "1px solid rgba(0,255,65,0.15)",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.12em", marginBottom: 16, textTransform: "uppercase" }}>
            Dimensie-sliders
          </div>

          {[
            { label: "Mandate", value: mandate, setter: setMandate, desc: "Governance-bevoegdheid" },
            { label: "Integrity", value: integrity, setter: setIntegrity, desc: "Systeemcoherentie" },
            { label: "Load", value: load, setter: setLoad, desc: "Organisationele draagkracht" },
          ].map((dim) => (
            <div key={dim.label} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {dim.label}
                  <span style={{ fontWeight: 400, opacity: 0.5, marginLeft: 8, fontSize: 10 }}>{dim.desc}</span>
                </span>
                <span
                  data-testid={`text-${dim.label.toLowerCase()}-value`}
                  style={{ fontSize: 14, fontWeight: 700, color: "#00ff41" }}
                >
                  {dim.value.toFixed(2)}
                </span>
              </div>
              <input
                data-testid={`slider-${dim.label.toLowerCase()}`}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={dim.value}
                onChange={(e) => dim.setter(parseFloat(e.target.value))}
                style={sliderStyle}
              />
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background: `linear-gradient(to right, rgba(0,255,65,0.15), rgba(0,255,65,${0.15 + dim.value * 0.5}))`,
                  width: `${dim.value * 100}%`,
                  marginTop: 4,
                  transition: "width 0.15s",
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            data-testid="card-stability"
            style={{
              background: dc.bg,
              border: `1px solid ${dc.border}`,
              borderRadius: 8,
              padding: 20,
              flex: 1,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>
              Stabiliteits-indicator
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ position: "relative", width: "100%", height: 24, background: "rgba(0,0,0,0.3)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    position: "absolute",
                    left: `${STABILITY_NO_GO * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(255,68,68,0.5)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: `${STABILITY_HOLD * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    background: "rgba(255,170,0,0.5)",
                  }}
                />
                <div
                  style={{
                    width: `${Math.min(100, stability * 100)}%`,
                    height: "100%",
                    background: dc.color,
                    opacity: 0.6,
                    borderRadius: 4,
                    transition: "width 0.2s, background 0.2s",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    left: `${STABILITY_NO_GO * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: 9,
                    color: "#ff4444",
                    opacity: 0.7,
                  }}
                >
                  0.4
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    left: `${STABILITY_HOLD * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: 9,
                    color: "#ffaa00",
                    opacity: 0.7,
                  }}
                >
                  0.7
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 24, fontSize: 10, marginBottom: 8, marginTop: 24 }}>
              <span style={{ color: "#ff4444" }}>■ NO_GO (&lt;0.4)</span>
              <span style={{ color: "#ffaa00" }}>■ HOLD (&lt;0.7)</span>
              <span style={{ color: "#00ff41" }}>■ GO (≥0.7)</span>
            </div>

            <div style={{ fontSize: 13, marginTop: 8 }}>
              <span style={{ opacity: 0.5 }}>Stabiliteit:</span>{" "}
              <strong data-testid="text-stability" style={{ color: dc.color, fontSize: 18 }}>{stability.toFixed(4)}</strong>
            </div>
          </div>

          <div
            data-testid="card-risk"
            style={{
              background: "rgba(0,200,255,0.03)",
              border: "1px solid rgba(0,200,255,0.20)",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 11, color: "rgba(0,200,255,0.7)", letterSpacing: "0.1em", marginBottom: 8, textTransform: "uppercase" }}>
              Risicometer
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <strong data-testid="text-risk" style={{ color: "#00ccff", fontSize: 22 }}>{risk.toFixed(4)}</strong>
              <span style={{ fontSize: 11, opacity: 0.5 }}>risk = (1 − stability) × mean</span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: "rgba(0,0,0,0.3)",
                marginTop: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, risk * 100)}%`,
                  height: "100%",
                  background: risk > 0.3 ? "#ff4444" : risk > 0.15 ? "#ffaa00" : "#00ccff",
                  borderRadius: 3,
                  transition: "width 0.2s",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        data-testid="card-decision"
        style={{
          border: `2px solid ${dc.border}`,
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
          background: dc.bg,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        {decision === "GO" && <CheckCircle style={{ width: 28, height: 28, color: dc.color, flexShrink: 0 }} />}
        {decision === "HOLD" && <AlertTriangle style={{ width: 28, height: 28, color: dc.color, flexShrink: 0 }} />}
        {decision === "NO_GO" && <XCircle style={{ width: 28, height: 28, color: dc.color, flexShrink: 0 }} />}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <span
              data-testid="text-decision"
              style={{
                padding: "4px 14px",
                borderRadius: 4,
                border: `1px solid ${dc.border}`,
                background: dc.bg,
                color: dc.color,
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "0.12em",
              }}
            >
              {decision}
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            {decisionExplanation(decision)}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "rgba(0,255,65,0.03)",
          border: "1px solid rgba(0,255,65,0.15)",
          borderRadius: 8,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.12em", marginBottom: 12, textTransform: "uppercase" }}>
          Wiskundige formules
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 12 }}>
          <div>
            <span style={{ opacity: 0.5 }}>mean</span> = (m + i + l) / 3 ={" "}
            <strong data-testid="text-mean" style={{ color: "#00ff41" }}>{mean.toFixed(4)}</strong>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>variance</span> = Σ(x − mean)² / 3 ={" "}
            <strong data-testid="text-variance" style={{ color: "#00ff41" }}>{variance.toFixed(4)}</strong>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>stability</span> = 1 − √variance ={" "}
            <strong style={{ color: dc.color }}>{stability.toFixed(4)}</strong>
          </div>
          <div>
            <span style={{ opacity: 0.5 }}>risk</span> = (1 − stability) × mean ={" "}
            <strong style={{ color: "#00ccff" }}>{risk.toFixed(4)}</strong>
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 10, opacity: 0.4, lineHeight: 1.6 }}>
          Drempels: stability &lt; {STABILITY_NO_GO} → NO_GO | stability &lt; {STABILITY_HOLD} → HOLD | stability ≥ {STABILITY_HOLD} → GO
        </div>
      </div>

      <div
        style={{
          background: "rgba(0,200,255,0.03)",
          border: "1px solid rgba(0,200,255,0.20)",
          borderRadius: 8,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 11, color: "rgba(0,200,255,0.7)", letterSpacing: "0.1em", marginBottom: 12, textTransform: "uppercase" }}>
          <Activity style={{ width: 14, height: 14, display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          Trace-integratie — Vector-stap uit pipeline
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            data-testid="input-trace-intent"
            type="text"
            value={traceInput}
            onChange={(e) => setTraceInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runTrace()}
            placeholder="Voer een intent in om via /api/trace te evalueren…"
            style={{
              flex: 1,
              padding: "8px 12px",
              background: "#050505",
              border: "1px solid rgba(0,200,255,0.20)",
              color: "#b8ffb8",
              borderRadius: 4,
              fontSize: 12,
              fontFamily: "monospace",
              outline: "none",
            }}
          />
          <button
            data-testid="button-run-trace"
            onClick={runTrace}
            disabled={traceBusy || !traceInput.trim()}
            style={{
              padding: "8px 16px",
              borderRadius: 4,
              border: "1px solid rgba(0,200,255,0.50)",
              background: traceBusy ? "rgba(0,200,255,0.05)" : "rgba(0,200,255,0.12)",
              color: "#00ccff",
              fontWeight: 700,
              cursor: traceBusy || !traceInput.trim() ? "not-allowed" : "pointer",
              fontFamily: "monospace",
              fontSize: 12,
              letterSpacing: "0.1em",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: traceBusy || !traceInput.trim() ? 0.5 : 1,
            }}
          >
            <Play style={{ width: 12, height: 12 }} />
            {traceBusy ? "EVALUEREN…" : "EVALUEER"}
          </button>
        </div>

        {traceError && (
          <div style={{ padding: 10, borderRadius: 6, background: "rgba(255,40,40,0.08)", border: "1px solid rgba(255,40,40,0.30)", color: "#ff8888", fontSize: 12, marginBottom: 8 }}>
            {traceError}
          </div>
        )}

        {traceVectorStep && (
          <div
            data-testid="card-trace-vector"
            style={{
              border: "1px solid rgba(0,200,255,0.25)",
              borderRadius: 6,
              padding: 14,
              background: "rgba(0,200,255,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16 }}>{traceVectorStep.symbol}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#00ccff" }}>{traceVectorStep.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  padding: "2px 8px",
                  borderRadius: 4,
                  border: `1px solid ${decisionColor(traceVectorStep.decision).border}`,
                  background: decisionColor(traceVectorStep.decision).bg,
                  color: decisionColor(traceVectorStep.decision).color,
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                }}
              >
                {traceVectorStep.decision}
              </span>
            </div>
            <div style={{ fontSize: 10, color: "rgba(0,200,255,0.6)", marginBottom: 6 }}>
              {traceVectorStep.role}
            </div>
            <div style={{ fontSize: 11, color: "rgba(200,240,240,0.75)", lineHeight: 1.5 }}>
              {traceVectorStep.detail}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(0,200,255,0.4)" }}>
              ⏱ {traceVectorStep.durationMs}ms
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
