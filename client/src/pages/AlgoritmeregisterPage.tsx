import { useState, useEffect, useMemo } from "react";
import { BookOpen, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, Loader2, Filter } from "lucide-react";

type AlgorithmEntry = {
  algorithm: string;
  organization: string;
  decision: "APPROVED" | "ESCALATE" | "BLOCK";
  risk_score: number;
  dpia_level: number;
  dpia_label: string;
};

type DecisionFilter = "ALL" | "APPROVED" | "ESCALATE" | "BLOCK";

const DECISION_STYLES: Record<string, { color: string; bg: string; border: string; icon: typeof CheckCircle }> = {
  APPROVED: { color: "#00ff41", bg: "rgba(0,255,65,0.08)", border: "rgba(0,255,65,0.30)", icon: CheckCircle },
  ESCALATE: { color: "#ffaa00", bg: "rgba(255,170,0,0.08)", border: "rgba(255,170,0,0.30)", icon: AlertTriangle },
  BLOCK: { color: "#ff4444", bg: "rgba(255,68,68,0.08)", border: "rgba(255,68,68,0.30)", icon: XCircle },
};

function DecisionBadge({ decision }: { decision: string }) {
  const s = DECISION_STYLES[decision] ?? DECISION_STYLES.APPROVED;
  const Icon = s.icon;
  return (
    <span
      data-testid={`badge-decision-${decision.toLowerCase()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 10px",
        borderRadius: 4,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.1em",
        fontFamily: "monospace",
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: 12, height: 12 }} />
      {decision}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      data-testid={`stat-${label.toLowerCase()}`}
      style={{
        border: `1px solid ${color}30`,
        borderRadius: 8,
        padding: "14px 18px",
        background: `${color}08`,
        textAlign: "center",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color, fontFamily: "monospace" }}>{value}</div>
      <div style={{ fontSize: 11, color: `${color}99`, letterSpacing: "0.1em", marginTop: 2, fontFamily: "monospace" }}>
        {label}
      </div>
    </div>
  );
}

export default function AlgoritmeregisterPage() {
  const [data, setData] = useState<AlgorithmEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>("ALL");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/algoritmeregister");
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const json = await r.json();
      setData(Array.isArray(json) ? json : []);
    } catch (e: any) {
      setError(e?.message ?? "Fout bij ophalen algoritmeregister");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    let items = data;
    if (decisionFilter !== "ALL") {
      items = items.filter((i) => i.decision === decisionFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          (i.algorithm ?? "").toLowerCase().includes(q) ||
          (i.organization ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, search, decisionFilter]);

  const stats = useMemo(() => {
    const total = data.length;
    const approved = data.filter((d) => d.decision === "APPROVED").length;
    const escalate = data.filter((d) => d.decision === "ESCALATE").length;
    const block = data.filter((d) => d.decision === "BLOCK").length;
    return { total, approved, escalate, block };
  }, [data]);

  return (
    <div style={{ fontFamily: "monospace", color: "#b8ffb8" }}>
      <div className="mb-6">
        <h1
          data-testid="text-page-title"
          className="text-2xl font-bold font-mono flex items-center gap-3"
        >
          <BookOpen className="w-6 h-6 text-primary" />
          Algoritmeregister — Governance Overzicht
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Overzicht van het Nederlandse overheids-algoritmeregister met PRSYS governance-beslissingen per algoritme.
          Data wordt opgehaald en verwerkt via de volledige besluitpipeline.
        </p>
      </div>

      {loading && (
        <div
          data-testid="status-loading"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 20px",
            gap: 16,
          }}
        >
          <Loader2
            style={{ width: 32, height: 32, color: "#00ff41", animation: "spin 1s linear infinite" }}
          />
          <div style={{ fontSize: 13, color: "rgba(0,255,65,0.7)", letterSpacing: "0.1em" }}>
            ALGORITMEREGISTER LADEN…
          </div>
          <div style={{ fontSize: 11, color: "rgba(0,255,65,0.4)" }}>
            Extern CSV wordt opgehaald en door de PRSYS pipeline verwerkt. Dit kan even duren.
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && !loading && (
        <div
          data-testid="status-error"
          style={{
            padding: "20px 24px",
            borderRadius: 8,
            background: "rgba(255,40,40,0.08)",
            border: "1px solid rgba(255,40,40,0.30)",
            color: "#ff8888",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <XCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Fout bij laden</div>
            <div style={{ opacity: 0.8 }}>{error}</div>
          </div>
          <button
            data-testid="button-retry"
            onClick={fetchData}
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              borderRadius: 4,
              border: "1px solid rgba(255,68,68,0.40)",
              background: "rgba(255,68,68,0.10)",
              color: "#ff8888",
              cursor: "pointer",
              fontFamily: "monospace",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
            Opnieuw
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          <div
            data-testid="stats-panel"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <StatCard label="TOTAAL" value={stats.total} color="#00ccff" />
            <StatCard label="APPROVED" value={stats.approved} color="#00ff41" />
            <StatCard label="ESCALATE" value={stats.escalate} color="#ffaa00" />
            <StatCard label="BLOCK" value={stats.block} color="#ff4444" />
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative", flex: "1 1 300px" }}>
              <Search
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 14,
                  height: 14,
                  color: "rgba(0,255,65,0.4)",
                }}
              />
              <input
                data-testid="input-search"
                type="text"
                placeholder="Zoek op naam of organisatie…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  background: "#0a0a0a",
                  border: "1px solid rgba(0,255,65,0.20)",
                  borderRadius: 6,
                  color: "#b8ffb8",
                  fontSize: 12,
                  fontFamily: "monospace",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <Filter style={{ width: 13, height: 13, color: "rgba(0,255,65,0.4)", marginRight: 4 }} />
              {(["ALL", "APPROVED", "ESCALATE", "BLOCK"] as DecisionFilter[]).map((f) => {
                const active = decisionFilter === f;
                const colors: Record<DecisionFilter, string> = {
                  ALL: "#00ccff",
                  APPROVED: "#00ff41",
                  ESCALATE: "#ffaa00",
                  BLOCK: "#ff4444",
                };
                const c = colors[f];
                return (
                  <button
                    key={f}
                    data-testid={`filter-${f.toLowerCase()}`}
                    onClick={() => setDecisionFilter(f)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 4,
                      border: `1px solid ${active ? c : "rgba(0,255,65,0.15)"}`,
                      background: active ? `${c}15` : "transparent",
                      color: active ? c : "rgba(0,255,65,0.5)",
                      cursor: "pointer",
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: active ? 700 : 400,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {f === "ALL" ? `ALLES (${stats.total})` : `${f} (${f === "APPROVED" ? stats.approved : f === "ESCALATE" ? stats.escalate : stats.block})`}
                  </button>
                );
              })}
            </div>

            <button
              data-testid="button-refresh"
              onClick={fetchData}
              style={{
                padding: "6px 14px",
                borderRadius: 4,
                border: "1px solid rgba(0,255,65,0.30)",
                background: "rgba(0,255,65,0.08)",
                color: "#00ff41",
                cursor: "pointer",
                fontFamily: "monospace",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RefreshCw style={{ width: 12, height: 12 }} />
              Vernieuwen
            </button>
          </div>

          <div style={{ fontSize: 11, color: "rgba(0,255,65,0.4)", marginBottom: 8 }}>
            {filtered.length} van {data.length} algoritmes getoond
          </div>

          <div
            style={{
              border: "1px solid rgba(0,255,65,0.15)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 120px 90px 140px",
                gap: 0,
                padding: "10px 14px",
                background: "rgba(0,255,65,0.05)",
                borderBottom: "1px solid rgba(0,255,65,0.15)",
                fontSize: 10,
                letterSpacing: "0.12em",
                color: "rgba(0,255,65,0.6)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              <div>Algoritme</div>
              <div>Organisatie</div>
              <div>Beslissing</div>
              <div>Risico</div>
              <div>DPIA</div>
            </div>

            {filtered.length === 0 ? (
              <div
                data-testid="status-empty"
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "rgba(0,255,65,0.4)",
                  fontSize: 13,
                }}
              >
                Geen algoritmes gevonden{search ? ` voor "${search}"` : ""}.
              </div>
            ) : (
              <div style={{ maxHeight: 600, overflowY: "auto" }}>
                {filtered.map((item, idx) => {
                  const riskColor =
                    item.risk_score >= 0.7
                      ? "#ff4444"
                      : item.risk_score >= 0.4
                        ? "#ffaa00"
                        : "#00ff41";
                  return (
                    <div
                      key={`${item.algorithm}-${idx}`}
                      data-testid={`row-algorithm-${idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 2fr 120px 90px 140px",
                        gap: 0,
                        padding: "10px 14px",
                        borderBottom: "1px solid rgba(0,255,65,0.06)",
                        fontSize: 12,
                        alignItems: "center",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = "rgba(0,255,65,0.03)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.background = "transparent";
                      }}
                    >
                      <div
                        data-testid={`text-algorithm-${idx}`}
                        style={{
                          color: "#b8ffb8",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          paddingRight: 8,
                        }}
                        title={item.algorithm}
                      >
                        {item.algorithm || "—"}
                      </div>
                      <div
                        data-testid={`text-organization-${idx}`}
                        style={{
                          color: "rgba(184,255,184,0.7)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          paddingRight: 8,
                        }}
                        title={item.organization}
                      >
                        {item.organization || "—"}
                      </div>
                      <div>
                        <DecisionBadge decision={item.decision} />
                      </div>
                      <div style={{ color: riskColor, fontWeight: 700, fontFamily: "monospace" }}>
                        {item.risk_score?.toFixed(4) ?? "—"}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: "rgba(184,255,184,0.6)",
                          fontFamily: "monospace",
                        }}
                      >
                        <span style={{ opacity: 0.7 }}>L{item.dpia_level}</span>{" "}
                        {item.dpia_label || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
