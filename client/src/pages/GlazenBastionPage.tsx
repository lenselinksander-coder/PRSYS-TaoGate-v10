import { useEffect, useState } from "react";
import { Shield, RefreshCw, Search, Eye, AlertTriangle, XCircle, CheckCircle, Info } from "lucide-react";

type BesluitRecord = {
  id: string;
  decision: string;
  category: string | null;
  layer: string | null;
  reason: string | null;
  ruleId: string | null;
  dpiaLevel: number | null;
  escalation: string | null;
  createdAt: string;
};

type HerautEntry = {
  decision: string;
  category: string | null;
  layer: string | null;
  dpiaLevel: number | null;
  reasonShort: string | null;
  createdAt: string;
};

const DPIA_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Geen risico", color: "#6ee7b7" },
  1: { label: "Verwaarloosbaar", color: "#86efac" },
  2: { label: "Laag risico", color: "#fde68a" },
  3: { label: "Middel risico", color: "#fdba74" },
  4: { label: "Hoog risico", color: "#f87171" },
  5: { label: "Kritisch", color: "#ef4444" },
};

function decisionStyle(decision: string): { bg: string; fg: string; bd: string; icon: React.ReactNode } {
  switch (decision) {
    case "BLOCK":
      return { bg: "#3b0a0a", fg: "#ffb4b4", bd: "#7a1d1d", icon: <XCircle size={14} /> };
    case "ESCALATE_REGULATORY":
      return { bg: "#22110a", fg: "#ffd2b4", bd: "#7a3a1d", icon: <AlertTriangle size={14} /> };
    case "ESCALATE_HUMAN":
      return { bg: "#1b1606", fg: "#ffe7a3", bd: "#7a651d", icon: <AlertTriangle size={14} /> };
    case "PASS_WITH_TRANSPARENCY":
      return { bg: "#071b16", fg: "#b7ffe9", bd: "#1d7a65", icon: <Eye size={14} /> };
    default:
      return { bg: "#07161b", fg: "#b4f0ff", bd: "#1d5f7a", icon: <CheckCircle size={14} /> };
  }
}

function DecisionBadge({ decision }: { decision: string }) {
  const s = decisionStyle(decision);
  return (
    <span
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}
    >
      {s.icon}
      {decision.replace(/_/g, " ")}
    </span>
  );
}

function DpiaBadge({ level }: { level: number | null }) {
  if (level === null || level === undefined) return null;
  const info = DPIA_LABELS[level] ?? { label: `Niveau ${level}`, color: "#9ca3af" };
  return (
    <span style={{ background: "rgba(255,255,255,0.05)", color: info.color, border: `1px solid ${info.color}40`, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontFamily: "monospace" }}>
      DPIA {level} — {info.label}
    </span>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" });
}

export default function GlazenBastionPage() {
  const [lookupType, setLookupType] = useState<"email" | "bsn">("email");
  const [lookupValue, setLookupValue] = useState("");
  const [besluiten, setBesluiten] = useState<BesluitRecord[] | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [herautFeed, setHerautFeed] = useState<HerautEntry[]>([]);
  const [herautLoading, setHerautLoading] = useState(true);
  const [herautError, setHerautError] = useState<string | null>(null);

  const loadHeraut = async () => {
    setHerautLoading(true);
    setHerautError(null);
    try {
      const r = await fetch("/api/heraut/feed?limit=50");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setHerautFeed(data.feed ?? []);
    } catch (e: any) {
      setHerautError(e.message ?? "Fout bij laden");
    } finally {
      setHerautLoading(false);
    }
  };

  useEffect(() => { loadHeraut(); }, []);

  const handleLookup = async () => {
    if (!lookupValue.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setBesluiten(null);
    try {
      const body = lookupType === "email"
        ? { email: lookupValue.trim() }
        : { bsn: lookupValue.trim() };
      const r = await fetch("/api/burgerportaal/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error?.formErrors?.[0] ?? data.error ?? `HTTP ${r.status}`);
      setBesluiten(data.besluiten ?? []);
    } catch (e: any) {
      setLookupError(e.message ?? "Onbekende fout");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e2e8f0", fontFamily: "monospace" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #1a2a1a", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12, background: "#0d0d0d" }}>
        <Shield size={22} color="#00ff41" />
        <span style={{ fontSize: 18, fontWeight: 700, color: "#00ff41", letterSpacing: 1 }}>GLAZEN BASTION</span>
        <span style={{ fontSize: 12, color: "#4a5568", marginLeft: 8 }}>Transparantieportaal — ORFHEUSS / PRSYS</span>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>

        {/* ── Links: Mijn Besluiten ── */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "#00ff41", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
            Mijn Besluiten
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20, lineHeight: 1.6 }}>
            Zoek op besluiten die over u zijn genomen via e-mailadres of BSN.
            Uw gegevens worden nooit opgeslagen — alleen een versleutelde hash wordt vergeleken.
          </p>

          {/* Toggle email / BSN */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["email", "bsn"] as const).map(t => (
              <button
                key={t}
                onClick={() => { setLookupType(t); setLookupValue(""); setBesluiten(null); setLookupError(null); }}
                style={{
                  padding: "4px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer", fontFamily: "monospace",
                  background: lookupType === t ? "#00ff4120" : "transparent",
                  border: lookupType === t ? "1px solid #00ff41" : "1px solid #2d3748",
                  color: lookupType === t ? "#00ff41" : "#9ca3af",
                }}
              >
                {t === "email" ? "E-mailadres" : "BSN"}
              </button>
            ))}
          </div>

          {/* Invoerveld */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              type={lookupType === "email" ? "email" : "text"}
              placeholder={lookupType === "email" ? "uw@email.nl" : "123456789"}
              value={lookupValue}
              onChange={e => setLookupValue(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLookup()}
              style={{
                flex: 1, padding: "8px 12px", background: "#111", border: "1px solid #2d3748",
                borderRadius: 4, color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", outline: "none",
              }}
            />
            <button
              onClick={handleLookup}
              disabled={lookupLoading || !lookupValue.trim()}
              style={{
                padding: "8px 16px", borderRadius: 4, fontSize: 12, cursor: "pointer", fontFamily: "monospace",
                background: "#00ff4120", border: "1px solid #00ff41", color: "#00ff41",
                opacity: lookupLoading || !lookupValue.trim() ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Search size={14} />
              {lookupLoading ? "Zoeken…" : "Zoek"}
            </button>
          </div>

          {lookupError && (
            <div style={{ padding: "10px 14px", background: "#3b0a0a", border: "1px solid #7a1d1d", borderRadius: 4, color: "#ffb4b4", fontSize: 12, marginBottom: 12 }}>
              {lookupError}
            </div>
          )}

          {/* Resultaten */}
          {besluiten !== null && (
            <div>
              {besluiten.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: 13, border: "1px solid #1f2937", borderRadius: 6 }}>
                  Geen besluiten gevonden voor dit {lookupType === "email" ? "e-mailadres" : "BSN"}.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>{besluiten.length} besluit{besluiten.length !== 1 ? "en" : ""} gevonden</div>
                  {besluiten.map(b => (
                    <div key={b.id} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 6, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <DecisionBadge decision={b.decision} />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>{formatDate(b.createdAt)}</span>
                      </div>
                      {b.dpiaLevel !== null && <div style={{ marginBottom: 8 }}><DpiaBadge level={b.dpiaLevel} /></div>}
                      {b.reason && (
                        <p style={{ fontSize: 12, color: "#d1d5db", marginBottom: 8, lineHeight: 1.5 }}>
                          <span style={{ color: "#9ca3af" }}>Reden: </span>{b.reason}
                        </p>
                      )}
                      {b.escalation && (
                        <p style={{ fontSize: 12, color: "#d1d5db", marginBottom: 6 }}>
                          <span style={{ color: "#9ca3af" }}>Vervolgstap: </span>{b.escalation}
                        </p>
                      )}
                      <div style={{ display: "flex", gap: 16, marginTop: 6 }}>
                        {b.ruleId && <span style={{ fontSize: 11, color: "#6b7280" }}>Regel: {b.ruleId}</span>}
                        {b.layer && <span style={{ fontSize: 11, color: "#6b7280" }}>Laag: {b.layer}</span>}
                        {b.category && <span style={{ fontSize: 11, color: "#6b7280" }}>Categorie: {b.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AVG-info */}
          <div style={{ marginTop: 24, padding: "12px 14px", background: "#0d1117", border: "1px solid #1f2937", borderRadius: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <Info size={14} color="#60a5fa" style={{ marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              U heeft het recht op inzage en uitleg over geautomatiseerde besluiten die over u zijn genomen (AVG art. 22, Richtlijn 2016/680).
              Bezwaar maken? Neem contact op met de verwerkingsverantwoordelijke van uw gemeente of instelling.
            </p>
          </div>
        </div>

        {/* ── Rechts: Heraut Prikbord ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
              Heraut Prikbord
            </h2>
            <button
              onClick={loadHeraut}
              disabled={herautLoading}
              style={{
                padding: "4px 10px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: "monospace",
                background: "transparent", border: "1px solid #2d3748", color: "#9ca3af",
                display: "flex", alignItems: "center", gap: 5,
                opacity: herautLoading ? 0.5 : 1,
              }}
            >
              <RefreshCw size={11} />
              Vernieuwen
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 10, background: "#f59e0b15", border: "1px solid #f59e0b40", color: "#f59e0b", padding: "2px 8px", borderRadius: 3, letterSpacing: 0.5 }}>
              PUBLIEK TRANSPARANTIEREGISTER — EU AI ACT ART. 50
            </span>
          </div>

          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
            Geanonimiseerde live-feed van recente gate-beslissingen. Geen persoonsgegevens worden getoond.
          </p>

          {herautError && (
            <div style={{ padding: "10px 14px", background: "#3b0a0a", border: "1px solid #7a1d1d", borderRadius: 4, color: "#ffb4b4", fontSize: 12, marginBottom: 12 }}>
              {herautError}
            </div>
          )}

          {herautLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 56, borderRadius: 4, background: "#111", border: "1px solid #1f2937", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 600, overflowY: "auto" }}>
              {herautFeed.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: 13, border: "1px solid #1f2937", borderRadius: 6 }}>
                  Nog geen besluiten in het register.
                </div>
              ) : herautFeed.map((entry, idx) => (
                <div key={idx} style={{ background: "#111", border: "1px solid #1f2937", borderRadius: 4, padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <DecisionBadge decision={entry.decision} />
                      {entry.dpiaLevel !== null && <DpiaBadge level={entry.dpiaLevel} />}
                    </div>
                    <span style={{ fontSize: 10, color: "#4b5563" }}>{formatDate(entry.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: entry.reasonShort ? 4 : 0 }}>
                    {entry.category && <span style={{ fontSize: 10, color: "#6b7280" }}>{entry.category}</span>}
                    {entry.layer && <span style={{ fontSize: 10, color: "#4b5563" }}>{entry.layer}</span>}
                  </div>
                  {entry.reasonShort && (
                    <p style={{ fontSize: 11, color: "#9ca3af", margin: 0, lineHeight: 1.4 }}>
                      {entry.reasonShort}{entry.reasonShort.length === 80 ? "…" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
