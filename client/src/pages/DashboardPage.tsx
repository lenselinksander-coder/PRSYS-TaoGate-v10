import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Layers, Plug, ScrollText, Activity, Eye, FileInput, ArrowRight } from "lucide-react";

type SystemInfo = {
  version: string;
  model: string;
  organizations: number;
  scopes: number;
  connectors: number;
  intents: { total: number; passed: number; blocked: number; escalated: number };
  gateProfiles: string[];
  sectors: string[];
};

export default function DashboardPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/system/info")
      .then(r => r.json())
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { title: "Organisaties", value: info?.organizations ?? 0, icon: Building2, path: "/organizations", color: "text-blue-400", desc: "Beheer organisaties en hun gate-profielen" },
    { title: "Scopes", value: info?.scopes ?? 0, icon: Layers, path: "/scopes", color: "text-cyan-400", desc: "Datasets met regels, categorieën en documenten" },
    { title: "Connectors", value: info?.connectors ?? 0, icon: Plug, path: "/connectors", color: "text-purple-400", desc: "Externe AI-agents en datakoppelingen" },
    { title: "Gateway Intents", value: info?.intents?.total ?? 0, icon: ScrollText, path: "/gateway-logs", color: "text-amber-400", desc: "Verwerkte intents via de universele gateway" },
  ];

  const modules = [
    { title: "ARGOS (TaoGate)", desc: "Pre-governance classificatie met pluggable gate-profielen", icon: Eye, path: "/triage" },
    { title: "OLYMPIA", desc: "Jurisdictionele regelconflict-resolutie over 4 lagen", icon: Activity, path: "/olympia" },
    { title: "Dataset Import", desc: "CSV/JSON datasets importeren als nieuwe Scopes", icon: FileInput, path: "/import" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 data-testid="text-page-title" className="text-3xl font-bold font-mono tracking-tight">
          ORFHEUSS <span className="text-primary">Universal</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Universeel governance-model voor elke organisatie. Laad datasets, verbind AI-agents, en laat het systeem classificeren, escaleren en blokkeren volgens uw regels.
        </p>
        {info && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
              v{info.version}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {info.gateProfiles.length} gate-profielen · {info.sectors.length} sectoren
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 rounded-xl bg-card/50 border border-border/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map(card => (
              <Link
                key={card.path}
                to={card.path}
                data-testid={`card-${card.title.toLowerCase().replace(/\s/g, '-')}`}
                className="group rounded-xl bg-card/50 border border-border/40 p-5 hover:border-primary/30 hover:bg-card/80 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-2xl font-bold font-mono">{card.value}</div>
                <div className="text-sm font-medium mt-1">{card.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{card.desc}</div>
              </Link>
            ))}
          </div>

          {info && info.intents.total > 0 && (
            <div className="mb-8 rounded-xl bg-card/50 border border-border/40 p-5">
              <h2 className="text-lg font-bold font-mono mb-4">Gateway Statistieken</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-400">{info.intents.passed}</div>
                  <div className="text-xs text-muted-foreground">Doorgelaten</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-400">{info.intents.escalated}</div>
                  <div className="text-xs text-muted-foreground">Geëscaleerd</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-400">{info.intents.blocked}</div>
                  <div className="text-xs text-muted-foreground">Geblokkeerd</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold font-mono mb-4">Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {modules.map(mod => (
                <Link
                  key={mod.path}
                  to={mod.path}
                  className="group rounded-xl bg-card/50 border border-border/40 p-5 hover:border-primary/30 hover:bg-card/80 transition-all"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <mod.icon className="w-5 h-5 text-primary" />
                    <span className="font-bold">{mod.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{mod.desc}</p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
