import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Clock } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TraceStep = {
  name: string;
  symbol: string;
  role: string;
  decision: string;
  detail: string;
  durationMs: number;
};

type TraceResult = {
  auditId: string;
  input: string;
  steps: TraceStep[];
  lattice: {
    D_gate: string;
    D_scope: string;
    D_runtime: string;
    D_final: string;
  };
  hypatia: {
    impact: number;
    probability: number;
    risk: number;
    decision: string;
    thresholdLabel: string;
    reason: string;
  };
  phronesis: {
    tau: number;
    omega: number;
    SI: number;
    risk: number;
    overloaded: boolean;
    decision: string;
    reason: string;
  };
  finalDecision: string;
  finalReason: string;
  processingMs: number;
};

// ── Decision styling ──────────────────────────────────────────────────────────

function decisionStyle(decision: string) {
  switch (decision) {
    case "BLOCK":
      return { color: "#ff4444", bg: "rgba(255,68,68,0.10)", border: "rgba(255,68,68,0.35)", label: "BLOCK" };
    case "ESCALATE_HUMAN":
    case "ESCALATE":
      return { color: "#ffaa00", bg: "rgba(255,170,0,0.10)", border: "rgba(255,170,0,0.35)", label: "ESCALATE" };
    case "ESCALATE_REGULATORY":
      return { color: "#ff6600", bg: "rgba(255,102,0,0.10)", border: "rgba(255,102,0,0.35)", label: "ESC. REG." };
    case "PASS_WITH_TRANSPARENCY":
      return { color: "#00ccff", bg: "rgba(0,204,255,0.08)", border: "rgba(0,204,255,0.30)", label: "PASS (T)" };
    case "PASS":
    case "ALLOWED":
    case "OBSERVED":
    case "STRUCTURED":
    case "CLASSIFIED":
    case "RECORDED":
      return { color: "#00ff41", bg: "rgba(0,255,65,0.08)", border: "rgba(0,255,65,0.25)", label: decision };
    default:
      return { color: "#888", bg: "rgba(128,128,128,0.08)", border: "rgba(128,128,128,0.25)", label: decision };
  }
}

function DecisionBadge({ decision }: { decision: string }) {
  const s = decisionStyle(decision);
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 4,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.1em",
        fontFamily: "monospace",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Castra Layout ─────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { name: "Argos",      symbol: "👁",  role: "Observe",    zone: "Porta"      },
  { name: "Arachne",    symbol: "🕸",  role: "Structure",  zone: "Via"        },
  { name: "Logos",      symbol: "📐",  role: "Classify",   zone: "Via"        },
  { name: "Hypatia",    symbol: "⚖",  role: "Risk",       zone: "Principia"  },
  { name: "Phronesis",  symbol: "🧭",  role: "Capacity",   zone: "Principia"  },
  { name: "Cerberus",   symbol: "🐺",  role: "Boundary",   zone: "Principia"  },
  { name: "TaoGate",    symbol: "☯",  role: "Decision",   zone: "Principia"  },
  { name: "Sandbox",    symbol: "🏛",  role: "Execute",    zone: "Campus"     },
  { name: "Hermes",     symbol: "⚡",  role: "Comms",      zone: "Via"        },
  { name: "Tabularium", symbol: "📜",  role: "Audit",      zone: "Tabularium" },
];

export default function CastraPage() {
  const [input, setInput]               = useState("");
  const [profile, setProfile]           = useState("GENERAL");
  const [tau, setTau]                   = useState("1.0");
  const [omega, setOmega]               = useState("0.8");
  const [impact, setImpact]             = useState("");
  const [probability, setProbability]   = useState("0.5");
  const [busy, setBusy]                 = useState(false);
  const [result, setResult]             = useState<TraceResult | null>(null);
  const [error, setError]               = useState<string | null>(null);

  async function runPipeline() {
    setError(null);
    setResult(null);
    setBusy(true);

    try {
      const body: Record<string, any> = {
        input: input,
        profile,
        tau: parseFloat(tau) || 1.0,
        omega: parseFloat(omega) || 0.8,
        probability: parseFloat(probability) || 0.5,
      };
      if (impact.trim()) body.impact = parseFloat(impact);

      const r = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.error ? JSON.stringify(data.error) : `Trace fout (${r.status})`);
      }
      setResult(data as TraceResult);
    } catch (e: any) {
      setError(e?.message ?? "Pipeline fout");
    } finally {
      setBusy(false);
    }
  }

  const finalStyle = result ? decisionStyle(result.finalDecision) : null;

  // Map step name to trace result
  const stepMap = result
    ? Object.fromEntries(result.steps.map(s => [s.name, s]))
    : {};

  return (
    <div style={{ fontFamily: "monospace", color: "#b8ffb8" }}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6">
        <h1
          data-testid="text-page-title"
          className="text-2xl font-bold font-mono flex items-center gap-3"
        >
          <Shield className="w-6 h-6 text-primary" />
          CASTRA — ORFHEUSS Pipeline Tracer
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualiseer de volledige ORFHEUSS besluitpipeline: van Porta (input) tot Tabularium (audit).
          Elke stap toont het besluit van Argos → Arachne → Logos → Hypatia → Phronesis → Cerberus → TaoGate → Sandbox → Hermes → Tabularium.
        </p>
      </div>

      {/* ── Castra Map (Roman camp top-level zones) ─────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gap: 8,
          marginBottom: 12,
          fontSize: 10,
          letterSpacing: "0.12em",
          textAlign: "center",
          textTransform: "uppercase",
          color: "rgba(0,255,65,0.45)",
        }}
      >
        <div style={{ border: "1px solid rgba(0,255,65,0.15)", padding: "4px 0", borderRadius: 2 }}>PORTA</div>
        <div style={{ border: "1px solid rgba(0,255,65,0.15)", padding: "4px 0", borderRadius: 2 }}>PRINCIPIA</div>
        <div style={{ border: "1px solid rgba(0,255,65,0.15)", padding: "4px 0", borderRadius: 2 }}>TABULARIUM</div>
      </div>

      {/* ── Input Panel ────────────────────────────────────── */}
      <div
        style={{
          background: "rgba(0,255,65,0.03)",
          border: "1px solid rgba(0,255,65,0.15)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11, opacity: 0.6 }}>PROFIEL:</span>
          <select
            value={profile}
            onChange={e => setProfile(e.target.value)}
            style={{
              background: "#0a0a0a",
              border: "1px solid rgba(0,255,65,0.25)",
              color: "#00ff41",
              borderRadius: 4,
              padding: "3px 8px",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            {["GENERAL", "CLINICAL", "FINANCIAL", "LEGAL", "EDUCATIONAL", "CUSTOM"].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>τ (tijd):</span>
          <input
            type="number" step="0.1" min="0" max="100"
            value={tau}
            onChange={e => setTau(e.target.value)}
            style={{ width: 60, background: "#0a0a0a", border: "1px solid rgba(0,255,65,0.25)", color: "#00ff41", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "monospace" }}
          />

          <span style={{ fontSize: 11, opacity: 0.6 }}>ω (capaciteit):</span>
          <input
            type="number" step="0.05" min="0" max="1"
            value={omega}
            onChange={e => setOmega(e.target.value)}
            style={{ width: 60, background: "#0a0a0a", border: "1px solid rgba(0,255,65,0.25)", color: "#00ff41", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "monospace" }}
          />

          <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>Impact:</span>
          <input
            type="number" step="0.05" min="0" max="1"
            placeholder="auto"
            value={impact}
            onChange={e => setImpact(e.target.value)}
            style={{ width: 60, background: "#0a0a0a", border: "1px solid rgba(0,255,65,0.25)", color: "#00ff41", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "monospace" }}
          />

          <span style={{ fontSize: 11, opacity: 0.6 }}>Kans:</span>
          <input
            type="number" step="0.05" min="0" max="1"
            value={probability}
            onChange={e => setProbability(e.target.value)}
            style={{ width: 60, background: "#0a0a0a", border: "1px solid rgba(0,255,65,0.25)", color: "#00ff41", borderRadius: 4, padding: "3px 6px", fontSize: 11, fontFamily: "monospace" }}
          />
        </div>

        <textarea
          data-testid="input-trace"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Voer een intent of observatie in voor pipeline-trace…"
          style={{
            width: "100%",
            minHeight: 90,
            resize: "vertical",
            background: "#050505",
            border: "1px solid rgba(0,255,65,0.20)",
            color: "#b8ffb8",
            borderRadius: 6,
            padding: 10,
            fontSize: 13,
            fontFamily: "monospace",
            outline: "none",
            lineHeight: 1.45,
            marginBottom: 10,
          }}
        />

        <button
          data-testid="button-run-trace"
          onClick={runPipeline}
          disabled={busy}
          style={{
            padding: "8px 20px",
            borderRadius: 4,
            border: "1px solid rgba(0,255,65,0.50)",
            background: busy ? "rgba(0,255,65,0.05)" : "rgba(0,255,65,0.12)",
            color: "#00ff41",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: "monospace",
            fontSize: 12,
            letterSpacing: "0.1em",
          }}
        >
          {busy ? "▶ TRACE LOOPT…" : "▶ RUN PIPELINE"}
        </button>

        {error && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: "rgba(255,40,40,0.08)", border: "1px solid rgba(255,40,40,0.30)", color: "#ff8888", fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      {/* ── Pipeline steps ─────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {PIPELINE_STEPS.map((meta, idx) => {
          const step = stepMap[meta.name];
          const s = step ? decisionStyle(step.decision) : { color: "#333", bg: "rgba(0,0,0,0)", border: "rgba(0,255,65,0.08)", label: "—" };
          return (
            <div
              key={meta.name}
              data-testid={`step-${meta.name.toLowerCase()}`}
              style={{
                border: `1px solid ${step ? s.border : "rgba(0,255,65,0.08)"}`,
                borderRadius: 6,
                padding: "10px 12px",
                background: step ? s.bg : "rgba(0,0,0,0)",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{meta.symbol}</span>
                <span style={{ fontWeight: 700, fontSize: 12, color: step ? s.color : "rgba(0,255,65,0.35)" }}>
                  {String(idx + 1).padStart(2, "0")} {meta.name}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  {step ? <DecisionBadge decision={step.decision} /> : (
                    <span style={{ color: "rgba(0,255,65,0.25)", fontSize: 10 }}>PENDING</span>
                  )}
                </span>
              </div>
              <div style={{ fontSize: 10, color: "rgba(0,255,65,0.45)", marginBottom: step ? 4 : 0 }}>
                {meta.role.toUpperCase()} · {meta.zone}
              </div>
              {step && (
                <div style={{ fontSize: 11, color: "rgba(200,240,200,0.70)", lineHeight: 1.4 }}>
                  {step.detail}
                </div>
              )}
              {step && (
                <div style={{ marginTop: 4, fontSize: 10, color: "rgba(0,255,65,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {step.durationMs}ms
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── TaoGate Decision Lattice ────────────────────────── */}
      {result && (
        <div
          style={{
            border: "1px solid rgba(0,255,65,0.20)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 12,
            background: "rgba(0,255,65,0.03)",
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.6, letterSpacing: "0.12em", marginBottom: 10 }}>
            ☯ TAOGATE DECISION LATTICE — D_final = max(D_gate, D_scope, D_runtime)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
            {[
              { label: "D_gate", value: result.lattice.D_gate, desc: "Cerberus grens" },
              { label: "D_scope", value: result.lattice.D_scope, desc: "Hypatia risico" },
              { label: "D_runtime", value: result.lattice.D_runtime, desc: "Phronesis capaciteit" },
              { label: "D_final", value: result.lattice.D_final, desc: "Definitief besluit" },
            ].map(item => (
              <div key={item.label} style={{ padding: "8px 4px" }}>
                <div style={{ fontSize: 10, opacity: 0.5, marginBottom: 4 }}>{item.label}</div>
                <DecisionBadge decision={item.value} />
                <div style={{ fontSize: 10, opacity: 0.45, marginTop: 4 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hypatia + Phronesis formulas ────────────────────── */}
      {result && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {/* Hypatia */}
          <div style={{ border: "1px solid rgba(0,200,255,0.20)", borderRadius: 8, padding: 14, background: "rgba(0,200,255,0.03)" }}>
            <div style={{ fontSize: 11, color: "rgba(0,200,255,0.7)", letterSpacing: "0.1em", marginBottom: 8 }}>
              ⚖ HYPATIA — Risk = Impact × Probability
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div><span style={{ opacity: 0.5 }}>Impact:</span> {result.hypatia.impact.toFixed(3)}</div>
              <div><span style={{ opacity: 0.5 }}>Kans:</span> {result.hypatia.probability.toFixed(3)}</div>
              <div><span style={{ opacity: 0.5 }}>Risico:</span> <strong style={{ color: "#00ccff" }}>{result.hypatia.risk.toFixed(4)}</strong></div>
              <div><span style={{ opacity: 0.5 }}>Drempel:</span> {result.hypatia.thresholdLabel}</div>
            </div>
            <div style={{ marginTop: 6 }}>
              <DecisionBadge decision={result.hypatia.decision} />
            </div>
          </div>

          {/* Phronesis */}
          <div style={{ border: "1px solid rgba(255,200,0,0.20)", borderRadius: 8, padding: 14, background: "rgba(255,200,0,0.03)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,200,0,0.7)", letterSpacing: "0.1em", marginBottom: 8 }}>
              🧭 PHRONESIS — SI = τ × ω
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              <div><span style={{ opacity: 0.5 }}>τ (tijd):</span> {result.phronesis.tau.toFixed(2)}</div>
              <div><span style={{ opacity: 0.5 }}>ω (capaciteit):</span> {result.phronesis.omega.toFixed(2)}</div>
              <div><span style={{ opacity: 0.5 }}>SI:</span> <strong style={{ color: "#ffcc00" }}>{result.phronesis.SI.toFixed(4)}</strong></div>
              <div><span style={{ opacity: 0.5 }}>Overbelast:</span> {result.phronesis.overloaded ? "JA" : "nee"}</div>
            </div>
            <div style={{ marginTop: 6 }}>
              <DecisionBadge decision={result.phronesis.decision === "ESCALATE" ? "ESCALATE_HUMAN" : result.phronesis.decision} />
            </div>
          </div>
        </div>
      )}

      {/* ── Final Verdict (Tabularium) ──────────────────────── */}
      {result && finalStyle && (
        <div
          data-testid="final-verdict"
          style={{
            border: `2px solid ${finalStyle.border}`,
            borderRadius: 8,
            padding: 16,
            background: finalStyle.bg,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            {result.finalDecision === "BLOCK" ? (
              <XCircle style={{ width: 20, height: 20, color: finalStyle.color }} />
            ) : result.finalDecision === "PASS" ? (
              <CheckCircle style={{ width: 20, height: 20, color: finalStyle.color }} />
            ) : (
              <AlertTriangle style={{ width: 20, height: 20, color: finalStyle.color }} />
            )}
            <span style={{ fontWeight: 800, fontSize: 16, color: finalStyle.color, letterSpacing: "0.1em" }}>
              {result.finalDecision}
            </span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, opacity: 0.55 }}>
              <Activity style={{ width: 12, height: 12 }} />
              {result.processingMs}ms
            </span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>{result.finalReason}</div>
          <div style={{ fontSize: 10, opacity: 0.45, fontFamily: "monospace" }}>
            📜 Audit-ID: {result.auditId}
          </div>
        </div>
      )}
    </div>
  );
}
