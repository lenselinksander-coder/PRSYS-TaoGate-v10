import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Scale, AlertTriangle, ChevronDown, ChevronRight, Gavel, Globe, Building2, MapPin, Landmark, Zap, Lock, Eye, Users, FileWarning, CheckCircle, Info, ArrowDown, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchScopes, resolveOlympia } from "@/lib/api";
import type { Scope, ScopeRule, RuleLayer, GateDecision } from "@shared/schema";

const LAYER_CONFIG: Record<RuleLayer, { label: string; icon: any; color: string; bg: string; border: string; description: string; priority: number }> = {
  EU: {
    label: "EU",
    icon: Globe,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    description: "Europese verordeningen — directe werking",
    priority: 1,
  },
  NATIONAL: {
    label: "Nationaal",
    icon: Landmark,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    description: "Nationale wetgeving — implementatie EU + eigen regelgeving",
    priority: 2,
  },
  REGIONAL: {
    label: "Regionaal",
    icon: Building2,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30",
    description: "Provinciale/regionale protocollen",
    priority: 3,
  },
  MUNICIPAL: {
    label: "Gemeentelijk",
    icon: MapPin,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    description: "Lokale verordeningen en beleid",
    priority: 4,
  },
};

const DECISION_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  BLOCK: { label: "BLOCK", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", icon: Lock },
  ESCALATE_REGULATORY: { label: "ESCALATE → TOEZICHT", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30", icon: FileWarning },
  ESCALATE_HUMAN: { label: "ESCALATE → MENS", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: Users },
  PASS_WITH_TRANSPARENCY: { label: "PASS + TRANSPARANTIE", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30", icon: Eye },
  PASS: { label: "PASS", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", icon: CheckCircle },
};

function BlankState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <Scale className="w-16 h-16 text-muted-foreground/30 mx-auto" />
        <h2 className="text-xl font-bold text-foreground">Geen MC Scope gevonden</h2>
        <p className="text-sm text-muted-foreground">
          Maak eerst een scope aan in SCOPES. Olympia kan alleen regels uitvoeren als er een scope met regels gedefinieerd is.
        </p>
      </div>
    </div>
  );
}

function PressureGauge({ pressure }: { pressure: number | "INFINITE" }) {
  const isInfinite = pressure === "INFINITE";
  const normalizedPressure = isInfinite ? 100 : Math.min(100, (pressure as number / 50) * 100);
  const pressureColor = isInfinite ? "text-red-500" : normalizedPressure > 60 ? "text-orange-400" : normalizedPressure > 30 ? "text-amber-400" : "text-green-400";
  const pressureBg = isInfinite ? "bg-red-500" : normalizedPressure > 60 ? "bg-orange-400" : normalizedPressure > 30 ? "bg-amber-400" : "bg-green-400";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Regeldruk</span>
        <span className={cn("font-mono font-bold text-sm", pressureColor)}>
          {isInfinite ? "∞ ONEINDIG" : pressure}
        </span>
      </div>
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", pressureBg)}
          initial={{ width: 0 }}
          animate={{ width: `${normalizedPressure}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        {isInfinite
          ? "BLOCK actief — EU-verordening heeft directe werking. Regeldruk = ∞"
          : "Σ (laag_prioriteit × impact × toepassingsbreedte)"
        }
      </p>
    </div>
  );
}

function RuleCard({ rule, showLayer = true }: { rule: ScopeRule; showLayer?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const dc = DECISION_CONFIG[rule.action] || DECISION_CONFIG.PASS;
  const lc = LAYER_CONFIG[rule.layer];

  return (
    <motion.div
      layout
      className={cn("rounded-lg border p-3 cursor-pointer transition-colors", dc.bg, dc.border, "hover:brightness-110")}
      onClick={() => setExpanded(!expanded)}
      data-testid={`rule-card-${rule.ruleId}`}
    >
      <div className="flex items-start gap-3">
        <dc.icon className={cn("w-4 h-4 mt-0.5 shrink-0", dc.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-foreground">{rule.ruleId}</span>
            <Badge variant="outline" className={cn("text-[10px] py-0", dc.color, dc.border)}>
              {dc.label}
            </Badge>
            {showLayer && (
              <Badge variant="outline" className={cn("text-[10px] py-0", lc.color, lc.border)}>
                {lc.label}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-1">{rule.title}</p>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{rule.description}</p>
                <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                  {rule.source && <span>Bron: <span className="text-foreground">{rule.source}</span></span>}
                  {rule.article && <span>Artikel: <span className="text-foreground">{rule.article}</span></span>}
                  <span>Override: <span className="text-foreground">{rule.overridesLowerLayers ? "Ja" : "Nee"}</span></span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 mt-1" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0 mt-1" />}
      </div>
    </motion.div>
  );
}

function LayerColumn({ layer, rules, isWinningLayer }: { layer: RuleLayer; rules: ScopeRule[]; isWinningLayer: boolean }) {
  const config = LAYER_CONFIG[layer];
  const LayerIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: config.priority * 0.1 }}
      className={cn(
        "rounded-xl border p-4 space-y-3 relative",
        isWinningLayer ? cn(config.bg, config.border, "border-2") : "bg-card/30 border-border/30"
      )}
    >
      {isWinningLayer && (
        <div className={cn("absolute -top-2.5 left-4 px-2 py-0.5 rounded text-[10px] font-mono font-bold", config.bg, config.color, config.border, "border")}>
          WINNEND
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className={cn("p-1.5 rounded-md", config.bg)}>
          <LayerIcon className={cn("w-4 h-4", config.color)} />
        </div>
        <div>
          <h3 className={cn("font-bold text-sm", config.color)}>
            {config.label}
          </h3>
          <p className="text-[10px] text-muted-foreground">{config.description}</p>
        </div>
        <Badge variant="outline" className={cn("ml-auto text-[10px]", config.color, config.border)}>
          P{config.priority}
        </Badge>
      </div>

      {rules.length > 0 ? (
        <div className="space-y-2">
          {rules.map(rule => (
            <RuleCard key={rule.ruleId} rule={rule} showLayer={false} />
          ))}
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-xs text-muted-foreground/50 italic">Geen regels in deze laag</p>
        </div>
      )}
    </motion.div>
  );
}

function ConflictBanner({ hasConflict, winningRule }: { hasConflict: boolean; winningRule: ScopeRule | null }) {
  if (!hasConflict || !winningRule) return null;

  const dc = DECISION_CONFIG[winningRule.action] || DECISION_CONFIG.PASS;
  const lc = LAYER_CONFIG[winningRule.layer];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("rounded-xl border-2 p-4", dc.bg, dc.border)}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">Regelconflict gedetecteerd</h3>
            <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">CONFLICT</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Meerdere jurisdicties geven tegenstrijdige beslissingen. Het Olympia-algoritme lost dit op:
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">BLOCK wint altijd.</span>
            <span className="text-muted-foreground">Hogere jurisdictie wint bij conflict.</span>
          </div>
          <div className={cn("mt-3 p-3 rounded-lg border", dc.bg, dc.border)}>
            <div className="flex items-center gap-2">
              <dc.icon className={cn("w-4 h-4", dc.color)} />
              <span className={cn("font-mono font-bold text-sm", dc.color)}>{dc.label}</span>
              <span className="text-xs text-muted-foreground">via</span>
              <Badge variant="outline" className={cn("text-[10px]", lc.color, lc.border)}>{lc.label}</Badge>
            </div>
            <p className="text-xs text-foreground mt-1">{winningRule.title}</p>
            <p className="text-[10px] text-muted-foreground mt-1 font-mono">{winningRule.ruleId} — {winningRule.source} {winningRule.article}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FlowDiagram() {
  const steps = [
    { label: "Context", sub: "Observatie binnengekomen", icon: Info, color: "text-muted-foreground" },
    { label: "TaoGate", sub: "Classificatie", icon: Shield, color: "text-cyan-400" },
    { label: "Olympia", sub: "Regel-executie", icon: Scale, color: "text-blue-400" },
    { label: "Menselijk Mandaat", sub: "Autorisatie", icon: Users, color: "text-amber-400" },
    { label: "Uitvoering", sub: "Beslissing", icon: Gavel, color: "text-green-400" },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-1 shrink-0">
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
            i === 2 ? "bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/20" : "bg-card/30 border-border/30"
          )}>
            <step.icon className={cn("w-3.5 h-3.5", step.color)} />
            <div>
              <p className={cn("text-xs font-bold", step.color)}>{step.label}</p>
              <p className="text-[10px] text-muted-foreground">{step.sub}</p>
            </div>
          </div>
          {i < steps.length - 1 && (
            <ArrowDown className="w-3 h-3 text-muted-foreground/30 rotate-[-90deg] shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function OlympiaPage() {
  const { data: scopeList = [] } = useQuery<Scope[]>({
    queryKey: ["/api/scopes"],
    queryFn: fetchScopes,
  });

  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  const [selectedDomain, setSelectedDomain] = useState<string>("AI");

  const activeScope = scopeList.find(s => s.id === selectedScopeId) || scopeList[0];

  const { data: resolution, isLoading } = useQuery({
    queryKey: ["/api/olympia/resolve", activeScope?.id, selectedDomain],
    queryFn: () => resolveOlympia(activeScope!.id, selectedDomain || undefined),
    enabled: !!activeScope,
  });

  const domains = useMemo(() => {
    if (!activeScope?.rules) return [];
    const unique = [...new Set((activeScope.rules as any[]).map(r => r.domain))];
    return unique;
  }, [activeScope]);

  if (!activeScope || scopeList.length === 0) {
    return <BlankState />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Scale className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight font-mono">
                OLYMPIA <span className="text-muted-foreground font-normal text-lg">Rule Execution Layer</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Waar regel → kracht wordt. Welke regel wint in uitvoering?
              </p>
            </div>
          </div>
        </div>

        <FlowDiagram />

        <div className="p-4 rounded-lg bg-card/30 border border-border/30">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-foreground font-medium">
                TaoGate classificeert. Olympia bepaalt welke regel kracht krijgt.
              </p>
              <p className="text-xs text-muted-foreground">
                EU-verordening heeft directe werking. BLOCK wint altijd. Hogere jurisdictie wint bij conflict. Dat is mechanisch, niet politiek. Olympia interpreteert niet — het verdeelt kracht.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
              MC Scope
            </label>
            <select
              data-testid="select-scope"
              value={activeScope.id}
              onChange={e => setSelectedScopeId(e.target.value)}
              className="w-full bg-card border border-border rounded-md p-2.5 text-sm"
            >
              {scopeList.map(s => (
                <option key={s.id} value={s.id}>MC {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
              Domein
            </label>
            <select
              data-testid="select-domain"
              value={selectedDomain}
              onChange={e => setSelectedDomain(e.target.value)}
              className="w-full bg-card border border-border rounded-md p-2.5 text-sm"
            >
              <option value="">Alle domeinen</option>
              {domains.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Scale className="w-8 h-8 text-blue-400 mx-auto" />
            </motion.div>
            <p className="text-sm text-muted-foreground mt-3">Regels worden geëvalueerd...</p>
          </div>
        ) : resolution ? (
          <div className="space-y-6">

            {resolution.hasConflict && (
              <ConflictBanner hasConflict={resolution.hasConflict} winningRule={resolution.winningRule} />
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-card/30 border-border/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground mb-1">Totaal regels</div>
                  <div className="text-2xl font-mono font-bold text-foreground">{resolution.totalRules}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/30 border-border/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground mb-1">Van toepassing</div>
                  <div className="text-2xl font-mono font-bold text-blue-400">{resolution.applicableRules.length}</div>
                </CardContent>
              </Card>
              <Card className="bg-card/30 border-border/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground mb-1">Conflict</div>
                  <div className={cn("text-2xl font-mono font-bold", resolution.hasConflict ? "text-amber-400" : "text-green-400")}>
                    {resolution.hasConflict ? "JA" : "NEE"}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card/30 border-border/30">
                <CardContent className="pt-4 pb-4">
                  <div className="text-xs text-muted-foreground mb-1">Beslissing</div>
                  {resolution.winningRule ? (
                    <div className={cn("text-lg font-mono font-bold", DECISION_CONFIG[resolution.winningRule.action]?.color || "text-foreground")}>
                      {DECISION_CONFIG[resolution.winningRule.action]?.label || resolution.winningRule.action}
                    </div>
                  ) : (
                    <div className="text-lg font-mono font-bold text-muted-foreground">—</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <PressureGauge pressure={resolution.pressure} />

            {resolution.winningRule && !resolution.hasConflict && (
              <Card className={cn("border-2", DECISION_CONFIG[resolution.winningRule.action]?.bg, DECISION_CONFIG[resolution.winningRule.action]?.border)}>
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start gap-3">
                    {(() => {
                      const WinIcon = DECISION_CONFIG[resolution.winningRule.action]?.icon || CheckCircle;
                      const winColor = DECISION_CONFIG[resolution.winningRule.action]?.color || "text-foreground";
                      return <WinIcon className={cn("w-5 h-5 mt-0.5", winColor)} />;
                    })()}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-mono font-bold", DECISION_CONFIG[resolution.winningRule.action]?.color)}>
                          {DECISION_CONFIG[resolution.winningRule.action]?.label}
                        </span>
                        <Badge variant="outline" className={cn("text-[10px]", LAYER_CONFIG[resolution.winningRule.layer]?.color, LAYER_CONFIG[resolution.winningRule.layer]?.border)}>
                          {LAYER_CONFIG[resolution.winningRule.layer]?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground font-medium">{resolution.winningRule.title}</p>
                      <p className="text-xs text-muted-foreground">{resolution.winningRule.description}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-1">
                        {resolution.winningRule.ruleId} — {resolution.winningRule.source} {resolution.winningRule.article}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Jurisdictielagen — Prioriteitsvolgorde
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {resolution.layers.map((layerData: any) => (
                  <LayerColumn
                    key={layerData.layer}
                    layer={layerData.layer}
                    rules={layerData.rules}
                    isWinningLayer={resolution.winningRule?.layer === layerData.layer}
                  />
                ))}
              </div>
            </div>

            <Card className="bg-card/20 border-border/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" />
                  Olympia Principes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Wat Olympia doet</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> Krachtverdeling tussen jurisdicties</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> Conflictresolutie via prioriteit</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> BLOCK als absolute grens</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-400 shrink-0" /> Regeldruk zichtbaar maken</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Wat Olympia NIET doet</h4>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2"><Lock className="w-3 h-3 text-red-400 shrink-0" /> Geen interpretatie</li>
                      <li className="flex items-center gap-2"><Lock className="w-3 h-3 text-red-400 shrink-0" /> Geen proportionaliteitsoordeel</li>
                      <li className="flex items-center gap-2"><Lock className="w-3 h-3 text-red-400 shrink-0" /> Geen belangenafweging</li>
                      <li className="flex items-center gap-2"><Lock className="w-3 h-3 text-red-400 shrink-0" /> Geen optimalisatie</li>
                    </ul>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-4 pt-3 border-t border-border/20">
                  Olympia is krachtverdeling. Het menselijk mandaat blijft bij de mens. TaoGate observeert, Olympia verdeelt kracht, de mens beslist.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12">
            <Scale className="w-12 h-12 text-muted-foreground/20 mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Geen regels gevonden voor dit domein.</p>
          </div>
        )}
      </div>
    </div>
  );
}
