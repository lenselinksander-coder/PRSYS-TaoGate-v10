import { useEffect, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Shield, AlertTriangle, Eye, Scale, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type ScopeRule = {
  layer: string;
  title: string;
  action: string;
  domain: string;
  ruleId: string;
  source: string;
  article: string;
  description: string;
  overridesLowerLayers: boolean;
};

type ScopeLite = {
  id: string;
  name: string;
  status: string | null;
  orgName?: string | null;
  rules: ScopeRule[];
};

type LayerSummary = {
  layer: string;
  priority: number;
  ruleCount: number;
  rules: ScopeRule[];
  dominantAction: string | null;
};

type OlympiaResult = {
  winningRule: ScopeRule | null;
  hasConflict: boolean;
  pressure: number | "INFINITE";
  layers: LayerSummary[];
  applicableRules: ScopeRule[];
  totalRules: number;
};

const LAYER_ORDER = ["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"];

const layerMeta: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  EU: { label: "Europese Unie", color: "text-blue-400", icon: Shield },
  NATIONAL: { label: "Nationaal (NL)", color: "text-cyan-400", icon: Scale },
  REGIONAL: { label: "Regionaal", color: "text-emerald-400", icon: Eye },
  MUNICIPAL: { label: "Gemeentelijk", color: "text-violet-400", icon: Activity },
};

function actionBadge(action: string) {
  switch (action) {
    case "BLOCK": return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", label: "BLOCK" };
    case "ESCALATE_HUMAN": return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "ESCALATE HUMAN" };
    case "ESCALATE_REGULATORY": return { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", label: "ESCALATE REG" };
    case "PASS_WITH_TRANSPARENCY": return { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "PASS (TRANSP)" };
    default: return { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "PASS" };
  }
}

export default function OlympiaPage() {
  const [scopes, setScopes] = useState<ScopeLite[]>([]);
  const [selectedScopeId, setSelectedScopeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [resolveResult, setResolveResult] = useState<OlympiaResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [domainFilter, setDomainFilter] = useState("");
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({ EU: true, NATIONAL: true, REGIONAL: true, MUNICIPAL: true });

  useEffect(() => {
    fetch("/api/scopes")
      .then(r => r.json())
      .then((data: ScopeLite[]) => {
        setScopes(data);
        const locked = data.find(s => s.status === "LOCKED");
        if (locked) setSelectedScopeId(locked.id);
        else if (data.length > 0) setSelectedScopeId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const selectedScope = scopes.find(s => s.id === selectedScopeId);
  const rules = (selectedScope?.rules || []) as ScopeRule[];

  const rulesByLayer = LAYER_ORDER.map(layer => ({
    layer,
    rules: rules.filter(r => r.layer === layer),
  }));

  const domains = Array.from(new Set(rules.map(r => r.domain).filter(Boolean)));

  async function runResolve() {
    if (!selectedScopeId) return;
    setResolving(true);
    try {
      const body: Record<string, string> = { scopeId: selectedScopeId };
      if (domainFilter) body.domain = domainFilter;
      const r = await fetch("/api/olympia/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) setResolveResult(data);
    } catch {}
    setResolving(false);
  }

  useEffect(() => {
    if (selectedScopeId) {
      runResolve();
    }
  }, [selectedScopeId, domainFilter]);

  const toggleLayer = (layer: string) => {
    setExpandedLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const totalRules = rules.length;
  const blockCount = rules.filter(r => r.action === "BLOCK").length;
  const escalateCount = rules.filter(r => r.action === "ESCALATE_HUMAN" || r.action === "ESCALATE_REGULATORY").length;
  const passCount = rules.filter(r => r.action === "PASS" || r.action === "PASS_WITH_TRANSPARENCY").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            OLYMPIA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Jurisdictionele regelconflict-resolutie over 4 lagen — EU, Nationaal, Regionaal, Gemeentelijk
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          data-testid="select-scope"
          value={selectedScopeId}
          onChange={e => { setSelectedScopeId(e.target.value); setResolveResult(null); }}
          className="bg-muted/30 border border-white/10 rounded-md px-3 py-2 text-sm font-mono text-foreground min-w-[200px]"
        >
          {scopes.map(s => (
            <option key={s.id} value={s.id}>
              {s.orgName ? `${s.orgName} — ` : ""}{s.name} {s.status === "LOCKED" ? "(LOCKED)" : `(${s.status})`}
            </option>
          ))}
        </select>

        <select
          data-testid="select-domain"
          value={domainFilter}
          onChange={e => { setDomainFilter(e.target.value); setResolveResult(null); }}
          className="bg-muted/30 border border-white/10 rounded-md px-3 py-2 text-sm font-mono text-foreground"
        >
          <option value="">Alle domeinen</option>
          {domains.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <Button data-testid="button-resolve" onClick={runResolve} size="sm" variant="outline" disabled={resolving || !selectedScopeId}>
          {resolving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
          Resolveren
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-muted/20 border border-white/5 rounded-lg p-3 text-center">
          <div data-testid="text-total-rules" className="text-2xl font-bold font-mono">{totalRules}</div>
          <div className="text-xs text-muted-foreground">Totaal regels</div>
        </div>
        <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 text-center">
          <div data-testid="text-block-count" className="text-2xl font-bold font-mono text-red-400">{blockCount}</div>
          <div className="text-xs text-muted-foreground">BLOCK</div>
        </div>
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-center">
          <div data-testid="text-escalate-count" className="text-2xl font-bold font-mono text-amber-400">{escalateCount}</div>
          <div className="text-xs text-muted-foreground">ESCALATE</div>
        </div>
        <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3 text-center">
          <div data-testid="text-pass-count" className="text-2xl font-bold font-mono text-green-400">{passCount}</div>
          <div className="text-xs text-muted-foreground">PASS</div>
        </div>
      </div>

      {resolveResult && (
        <div className="mb-6 bg-muted/20 border border-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-sm font-bold">Resolutie Resultaat</span>
            {resolveResult.hasConflict && (
              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> CONFLICT
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Winnende Regel</div>
              {resolveResult.winningRule ? (
                <div>
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${actionBadge(resolveResult.winningRule.action).bg} ${actionBadge(resolveResult.winningRule.action).text} ${actionBadge(resolveResult.winningRule.action).border}`}>
                    {resolveResult.winningRule.action}
                  </span>
                  <div data-testid="text-winning-rule" className="text-sm font-medium mt-1">{resolveResult.winningRule.title}</div>
                  <div className="text-xs text-muted-foreground">{resolveResult.winningRule.ruleId} — {resolveResult.winningRule.source} {resolveResult.winningRule.article}</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Geen winnende regel</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Druk (Pressure)</div>
              <div data-testid="text-pressure" className="text-lg font-bold font-mono">
                {resolveResult.pressure === "INFINITE" ? (
                  <span className="text-red-400">ONEINDIG</span>
                ) : (
                  <span className="text-cyan-400">{resolveResult.pressure}</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Regels toegepast</div>
              <div className="text-lg font-bold font-mono">{resolveResult.applicableRules.length} <span className="text-xs text-muted-foreground font-normal">/ {resolveResult.totalRules}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rulesByLayer.map(({ layer, rules: layerRules }) => {
          const meta = layerMeta[layer] || { label: layer, color: "text-muted-foreground", icon: Activity };
          const Icon = meta.icon;
          const isExpanded = expandedLayers[layer] ?? true;
          const resolveLayer = resolveResult?.layers?.find(l => l.layer === layer);

          return (
            <div key={layer} className="bg-muted/10 border border-white/5 rounded-lg overflow-hidden">
              <button
                data-testid={`button-layer-${layer.toLowerCase()}`}
                onClick={() => toggleLayer(layer)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                  <span className="font-mono font-bold text-sm">{layer}</span>
                  <span className="text-xs text-muted-foreground">— {meta.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {resolveLayer?.dominantAction && (
                    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${actionBadge(resolveLayer.dominantAction).bg} ${actionBadge(resolveLayer.dominantAction).text} ${actionBadge(resolveLayer.dominantAction).border}`}>
                      {actionBadge(resolveLayer.dominantAction).label}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">{layerRules.length} regels</span>
                </div>
              </button>

              {isExpanded && layerRules.length > 0 && (
                <div className="border-t border-white/5">
                  {layerRules.map((rule, idx) => {
                    const badge = actionBadge(rule.action);
                    const isWinner = resolveResult?.winningRule?.ruleId === rule.ruleId;
                    return (
                      <div
                        key={`${rule.ruleId}-${idx}`}
                        data-testid={`rule-${rule.ruleId}`}
                        className={`px-4 py-3 border-b border-white/5 last:border-b-0 ${isWinner ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono border ${badge.bg} ${badge.text} ${badge.border}`}>
                                {badge.label}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">{rule.ruleId}</span>
                              {rule.overridesLowerLayers && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">OVERRIDE</span>
                              )}
                              {isWinner && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-bold">WINNAAR</span>
                              )}
                            </div>
                            <div className="text-sm font-medium">{rule.title}</div>
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{rule.description}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-muted-foreground">{rule.source}</div>
                            <div className="text-xs text-muted-foreground">{rule.article}</div>
                            <div className="text-xs font-mono text-muted-foreground/60 mt-1">{rule.domain}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isExpanded && layerRules.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground border-t border-white/5">
                  Geen regels op deze laag
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 text-center text-xs text-muted-foreground/50 font-mono">
        OLYMPIA — BLOCK wint altijd. Hogere jurisdictie wint bij conflict. CERBERUS invariant.
      </div>
    </div>
  );
}
