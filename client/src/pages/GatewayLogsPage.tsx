import { useEffect, useState } from "react";
import { ScrollText, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

type Intent = {
  id: string;
  orgId: string | null;
  scopeId: string | null;
  connectorId: string | null;
  inputText: string;
  decision: string;
  category: string | null;
  layer: string | null;
  pressure: string | null;
  reason: string | null;
  escalation: string | null;
  processingMs: number | null;
  createdAt: string;
};

type Organization = { id: string; name: string };

function decisionBadge(decision: string) {
  switch (decision) {
    case "BLOCK": return { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" };
    case "ESCALATE_HUMAN": return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
    case "ESCALATE_REGULATORY": return { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" };
    case "PASS_WITH_TRANSPARENCY": return { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" };
    default: return { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" };
  }
}

export default function GatewayLogsPage() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOrg, setFilterOrg] = useState("");
  const [stats, setStats] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterOrg) params.set("orgId", filterOrg);
    params.set("limit", "200");

    const [iRes, oRes, sRes] = await Promise.all([
      fetch(`/api/intents?${params}`).then(r => r.json()),
      fetch("/api/organizations").then(r => r.json()),
      fetch(`/api/intents/stats?${filterOrg ? `orgId=${filterOrg}` : ""}`).then(r => r.json()),
    ]);
    setIntents(iRes);
    setOrgs(oRes);
    setStats(sRes);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [filterOrg]);

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return "—";
    return orgs.find(o => o.id === orgId)?.name || orgId.substring(0, 8);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
            <ScrollText className="w-6 h-6 text-amber-400" />
            Gateway Logs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Audit trail van alle intents verwerkt via de universele gateway</p>
        </div>
        <Button data-testid="button-refresh-logs" onClick={loadData} size="sm" variant="outline">
          <RefreshCw className="w-4 h-4 mr-1" /> Verversen
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-card/50 border border-border/40 p-4 text-center">
            <div className="text-xl font-bold font-mono">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Totaal</div>
          </div>
          <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4 text-center">
            <div className="text-xl font-bold font-mono text-green-400">{stats.passed}</div>
            <div className="text-xs text-muted-foreground">Doorgelaten</div>
          </div>
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4 text-center">
            <div className="text-xl font-bold font-mono text-amber-400">{stats.escalated}</div>
            <div className="text-xs text-muted-foreground">Geëscaleerd</div>
          </div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 text-center">
            <div className="text-xl font-bold font-mono text-red-400">{stats.blocked}</div>
            <div className="text-xs text-muted-foreground">Geblokkeerd</div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          data-testid="select-filter-org"
          value={filterOrg}
          onChange={e => setFilterOrg(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-3 text-xs"
        >
          <option value="">Alle organisaties</option>
          {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-lg bg-card/50 border border-border/40 animate-pulse" />)}
        </div>
      ) : intents.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ScrollText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Nog geen gateway intents verwerkt</p>
          <p className="text-sm mt-1">Gebruik de gateway API om intents in te dienen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {intents.map(intent => {
            const badge = decisionBadge(intent.decision);
            return (
              <div
                key={intent.id}
                data-testid={`row-intent-${intent.id}`}
                className="rounded-lg bg-card/50 border border-border/40 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${badge.bg} ${badge.text} border ${badge.border}`}>
                        {intent.decision}
                      </span>
                      {intent.layer && (
                        <span className="text-[10px] text-muted-foreground font-mono">{intent.layer}</span>
                      )}
                      {intent.category && (
                        <span className="text-[10px] text-muted-foreground">{intent.category}</span>
                      )}
                    </div>
                    <div className="text-sm truncate">{intent.inputText}</div>
                    {intent.reason && (
                      <div className="text-xs text-muted-foreground mt-1 truncate">{intent.reason}</div>
                    )}
                  </div>
                  <div className="text-right text-[10px] text-muted-foreground whitespace-nowrap">
                    <div>{getOrgName(intent.orgId)}</div>
                    <div>{new Date(intent.createdAt).toLocaleString("nl-NL")}</div>
                    {intent.processingMs !== null && <div>{intent.processingMs}ms</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
