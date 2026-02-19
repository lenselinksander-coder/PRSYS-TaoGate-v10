import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Shield, CheckCircle, Terminal, BarChart2, Eye, Layers, Plus, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { fetchObservations, fetchStats, createObservation, fetchScopes, classifyText } from "@/lib/api";
import type { Scope, GateDecision } from "@shared/schema";

const DECISION_CONFIG: Record<string, { label: string; shortLabel: string; color: string; bg: string; border: string; dot: string; icon: "check" | "info" | "alert" | "shield"; gateText: string }> = {
  PASS: {
    label: "PASS",
    shortLabel: "PASS",
    color: "text-green-500",
    bg: "bg-green-500/5",
    border: "border-green-500/10",
    dot: "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
    icon: "check",
    gateText: "PASS — Geen escalatie",
  },
  PASS_WITH_TRANSPARENCY: {
    label: "PASS + TRANSPARANTIE",
    shortLabel: "TRANSPARENCY",
    color: "text-blue-400",
    bg: "bg-blue-400/5",
    border: "border-blue-400/10",
    dot: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]",
    icon: "info",
    gateText: "PASS — Transparantieverplichting",
  },
  ESCALATE_HUMAN: {
    label: "ESCALATIE MENS",
    shortLabel: "ESCALATE",
    color: "text-orange-400",
    bg: "bg-orange-400/5",
    border: "border-orange-400/10",
    dot: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]",
    icon: "alert",
    gateText: "ESCALATE — Menselijk mandaat vereist",
  },
  ESCALATE_REGULATORY: {
    label: "ESCALATIE TOEZICHT",
    shortLabel: "REGULATORY",
    color: "text-amber-500",
    bg: "bg-amber-500/5",
    border: "border-amber-500/10",
    dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
    icon: "alert",
    gateText: "ESCALATE — Regulatoir toezicht vereist",
  },
  BLOCK: {
    label: "BLOCK",
    shortLabel: "BLOCK",
    color: "text-red-500",
    bg: "bg-red-500/5",
    border: "border-red-500/10",
    dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    icon: "shield",
    gateText: "BLOCK — Verboden",
  },
};

function getDecisionConfig(status: string) {
  return DECISION_CONFIG[status] || DECISION_CONFIG["PASS"];
}

function DecisionIcon({ status, className }: { status: string; className?: string }) {
  const config = getDecisionConfig(status);
  const cn = `${className || ""} ${config.color}`;
  switch (config.icon) {
    case "check": return <CheckCircle className={cn} />;
    case "info": return <Info className={cn} />;
    case "alert": return <AlertTriangle className={cn} />;
    case "shield": return <Shield className={cn} />;
  }
}

function classifyWithScope(text: string, scope: Scope): { status: string; category: string; escalation: string | null } {
  const lower = text.toLowerCase();

  const priorityOrder: GateDecision[] = ["BLOCK", "ESCALATE_REGULATORY", "ESCALATE_HUMAN", "PASS_WITH_TRANSPARENCY", "PASS"];

  for (const decision of priorityOrder) {
    const cats = scope.categories.filter(c => c.status === decision);
    for (const cat of cats) {
      if (cat.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return { status: cat.status, category: cat.name, escalation: cat.escalation };
      }
    }
  }

  const defaultPass = scope.categories.find(c => c.status === "PASS");
  return {
    status: "PASS",
    category: defaultPass?.name || "Observation",
    escalation: null,
  };
}

function buildPresets(scope: Scope): { text: string; status: string; category: string; escalation: string | null }[] {
  const presets: { text: string; status: string; category: string; escalation: string | null }[] = [];

  for (const cat of scope.categories) {
    if (cat.keywords.length > 0) {
      const sampleKeywords = cat.keywords.slice(0, 2);
      for (const kw of sampleKeywords) {
        presets.push({
          text: kw.charAt(0).toUpperCase() + kw.slice(1),
          status: cat.status,
          category: cat.name,
          escalation: cat.escalation,
        });
      }
    }
  }
  return presets;
}

function BlankState() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3" data-testid="text-page-title">
          <div className="p-2 bg-blue-600/20 text-blue-500 rounded-lg">
            <Eye className="w-6 h-6" />
          </div>
          ARGOS TaoGate
        </h1>
        <p className="text-xs font-mono text-primary/60 mt-0.5">Atelier Argos — Bewaakt de horizon</p>
        <p className="text-muted-foreground mt-1 font-mono text-sm">Pre-Governance — classificeer + escaleer</p>
      </div>

      <Card className="bg-card/30 border-dashed border-primary/20">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-6">
            <Eye className="w-10 h-10 text-primary/20" />
          </div>
          <h2 className="text-2xl font-mono font-bold mb-3">Blanco Project</h2>
          <p className="text-muted-foreground mb-2 max-w-md mx-auto">
            De TaoGate wacht op een scope. Zonder scope is er geen classificatie, geen gate, geen escalatie.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-8 max-w-lg mx-auto">
            Maak een MC scope aan — met categorieën, trefwoorden, escalatiepaden, visiedocumenten en mandaten — en de TaoGate wordt automatisch ingevuld.
          </p>
          <Link href="/scopes">
            <Button size="lg" data-testid="button-goto-scopes">
              <Plus className="w-4 h-4 mr-2" />
              Eerste MC Scope aanmaken
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="text-center text-xs font-mono text-muted-foreground/40 pb-4">
        Definieer een scope → de gate, classificatie en escalatiepaden verschijnen automatisch.
      </div>
    </div>
  );
}

export default function ArgosPage() {
  const [input, setInput] = useState("");
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: scopeList = [] } = useQuery({
    queryKey: ["scopes"],
    queryFn: fetchScopes,
  });

  const activeScope = selectedScopeId
    ? scopeList.find(s => s.id === selectedScopeId)
    : scopeList.find(s => s.isDefault === "true") || scopeList[0];

  const activeContext = activeScope?.name || "";

  const { data: observations = [] } = useQuery({
    queryKey: ["observations", activeScope?.id || "none"],
    queryFn: () => fetchObservations(activeContext, activeScope?.id),
    refetchInterval: 5000,
    enabled: !!activeScope,
  });

  const { data: stats = { total: 0, passed: 0, transparency: 0, escalated: 0, blocked: 0 } } = useQuery({
    queryKey: ["stats", activeScope?.id || "none"],
    queryFn: () => fetchStats(activeContext, activeScope?.id),
    refetchInterval: 5000,
    enabled: !!activeScope,
  });

  const mutation = useMutation({
    mutationFn: createObservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setInput("");
    },
  });

  if (!activeScope || scopeList.length === 0) {
    return <BlankState />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || mutation.isPending) return;
    const result = await classifyText(input, activeScope.id);
    mutation.mutate({
      text: input,
      status: result.status,
      category: result.category,
      escalation: result.escalation,
      context: activeContext,
      scopeId: activeScope.id,
      olympiaRuleId: result.olympiaRuleId,
      olympiaAction: result.olympiaAction,
      olympiaLayer: result.olympiaLayer,
    });
  };

  const handlePresetClick = async (preset: { text: string; status: string; category: string; escalation: string | null }) => {
    const result = await classifyText(preset.text, activeScope.id);
    mutation.mutate({
      text: preset.text,
      status: result.status,
      category: result.category,
      escalation: result.escalation,
      context: activeContext,
      scopeId: activeScope.id,
      olympiaRuleId: result.olympiaRuleId,
      olympiaAction: result.olympiaAction,
      olympiaLayer: result.olympiaLayer,
    });
  };

  const presets = buildPresets(activeScope);
  const categoryLabels: Record<string, string> = {};
  for (const cat of activeScope.categories) {
    categoryLabels[cat.name] = cat.label;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 bg-blue-600/20 text-blue-500 rounded-lg">
              <Eye className="w-6 h-6" />
            </div>
            ARGOS TaoGate
          </h1>
          <p className="text-xs font-mono text-primary/60 mt-0.5">Atelier Argos — Bewaakt de horizon</p>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Pre-Governance — classificeer + escaleer</p>
        </div>

        <div className="flex items-center gap-3">
          {scopeList.length > 1 && (
            <select
              value={activeScope.id}
              onChange={e => setSelectedScopeId(e.target.value)}
              className="h-9 rounded-md border border-primary/20 bg-card px-3 text-sm font-mono"
              data-testid="select-scope"
            >
              {scopeList.map(s => (
                <option key={s.id} value={s.id}>MC {s.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-2 px-4">
            <Layers className="w-4 h-4 text-primary/60" />
            <span className="text-sm font-mono font-bold text-primary">MC</span>
            <span className="text-sm font-mono font-semibold text-foreground">{activeContext}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Totaal</p>
                <h3 className="text-2xl font-mono font-bold mt-1" data-testid="text-stat-total">{stats.total}</h3>
              </div>
              <BarChart2 className="w-6 h-6 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-green-900/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-green-500/80">PASS</p>
                <h3 className="text-2xl font-mono font-bold mt-1 text-green-500" data-testid="text-stat-passed">{stats.passed}</h3>
              </div>
              <CheckCircle className="w-6 h-6 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-blue-900/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-blue-400/80">TRANSP.</p>
                <h3 className="text-2xl font-mono font-bold mt-1 text-blue-400" data-testid="text-stat-transparency">{stats.transparency}</h3>
              </div>
              <Info className="w-6 h-6 text-blue-400/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-orange-900/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-orange-400/80">ESCALATIE</p>
                <h3 className="text-2xl font-mono font-bold mt-1 text-orange-400" data-testid="text-stat-escalated">{stats.escalated}</h3>
              </div>
              <AlertTriangle className="w-6 h-6 text-orange-400/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-red-900/20">
          <CardContent className="pt-5 pb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-red-500/80">BLOCK</p>
                <h3 className="text-2xl font-mono font-bold mt-1 text-red-500" data-testid="text-stat-blocked">{stats.blocked}</h3>
              </div>
              <Shield className="w-6 h-6 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="pt-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
            {activeScope.categories.map((cat, i) => {
              const config = getDecisionConfig(cat.status);
              return (
                <div key={i} className={`flex items-center gap-2 p-2 rounded ${config.bg} border ${config.border}`}>
                  <DecisionIcon status={cat.status} className="w-3 h-3 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className={`${config.color} font-semibold block truncate`}>{cat.label.toUpperCase()}</span>
                    <span className="text-muted-foreground block truncate">
                      {cat.status === "PASS" ? "→ PASS" : cat.escalation ? `→ ${cat.escalation}` : `→ ${config.shortLabel}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-primary" />
            Invoer Classificatie — <span className="text-primary">MC</span> {activeContext}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input
              data-testid="input-observation"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Invoer voor MC ${activeContext}...`}
              className="font-mono text-sm bg-background/50 border-primary/20 focus-visible:ring-primary/30"
            />
            <Button data-testid="button-process" type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]">
              {mutation.isPending ? "Scannen..." : "Classificeer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {presets.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Voorbeelden — <span className="text-primary">MC</span> {activeScope.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {presets.map((ex, i) => {
                const config = getDecisionConfig(ex.status);
                return (
                  <div
                    key={i}
                    data-testid={`button-example-${i}`}
                    onClick={() => handlePresetClick(ex)}
                    className="group flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-all border border-transparent hover:border-primary/10"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <DecisionIcon status={ex.status} className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-sm text-foreground/90 truncate">{ex.text}</span>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                      <Badge className={`font-mono text-[10px] tracking-wider ${config.bg} ${config.color} border ${config.border}`}>
                        {config.shortLabel}
                      </Badge>
                      {ex.escalation && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {ex.escalation}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card className={`bg-card/50 backdrop-blur-sm border-border/50 h-full flex flex-col ${presets.length === 0 ? 'lg:col-span-2' : ''}`}>
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              Audit Log — <span className="text-primary">MC</span> {activeContext}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-[400px] p-4">
              <AnimatePresence initial={false}>
                {observations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 mt-10">
                    <Activity className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">Nog geen observaties vastgelegd.</p>
                    <p className="text-xs mt-1">De AI observeert en classificeert, maar beslist nooit.</p>
                  </div>
                ) : (
                  observations.map((obs: any) => {
                    const config = getDecisionConfig(obs.status);
                    return (
                      <motion.div
                        key={obs.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="mb-4 last:mb-0"
                      >
                        <div className="flex gap-3 items-start p-3 rounded border border-border/40 bg-background/30">
                          <div className="mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-mono text-muted-foreground">
                                {new Date(obs.createdAt).toLocaleTimeString()} — ID: {obs.id.slice(0, 8)}
                              </span>
                              <Badge className={`text-[10px] h-5 ${config.bg} ${config.color} border ${config.border}`}>
                                {categoryLabels[obs.category] || obs.category}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium" data-testid={`text-observation-${obs.id}`}>{obs.text}</p>
                            <div className="pt-2 flex gap-2 flex-wrap">
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>
                                TaoGate: {config.gateText}
                              </span>
                              {obs.escalation && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 text-orange-400">
                                  → Escalatie: {obs.escalation}
                                </span>
                              )}
                              {obs.olympiaRuleId && (
                                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  obs.olympiaAction === "BLOCK" ? "bg-red-500/10 text-red-400" :
                                  obs.olympiaAction === "ESCALATE_REGULATORY" ? "bg-orange-500/10 text-orange-400" :
                                  obs.olympiaAction === "ESCALATE_HUMAN" ? "bg-amber-500/10 text-amber-400" :
                                  obs.olympiaAction === "PASS_WITH_TRANSPARENCY" ? "bg-sky-500/10 text-sky-400" :
                                  "bg-green-500/10 text-green-400"
                                }`}>
                                  Olympia: {obs.olympiaRuleId} [{obs.olympiaLayer}]
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs font-mono text-muted-foreground/40 pb-4">
        MC {activeContext} — TaoGate classificeert → Olympia verdeelt kracht → De mens autoriseert.
      </div>
    </div>
  );
}
