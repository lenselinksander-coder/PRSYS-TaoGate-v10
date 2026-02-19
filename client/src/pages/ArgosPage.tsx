import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Shield, CheckCircle, Terminal, BarChart2, Eye, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { fetchObservations, fetchStats, createObservation } from "@/lib/api";

type Classification = {
  status: "PASS" | "BLOCK";
  category: string;
  escalation: string | null;
};

const ESCALATION_MAP: Record<string, { label: string; color: string }> = {
  Intensivist: { label: "→ Escalatie: Intensivist", color: "text-red-400" },
  OvD: { label: "→ Escalatie: OvD", color: "text-orange-400" },
  "IC-Hoofdarts": { label: "→ Escalatie: IC-Hoofdarts", color: "text-amber-400" },
};

const PRESET_EXAMPLES: { text: string; status: "PASS" | "BLOCK"; category: string; escalation: string | null }[] = [
  { text: "Bloeddruk 120/80, stabiel", status: "PASS", category: "Observation", escalation: null },
  { text: "FiO2 40%, PEEP 5", status: "PASS", category: "Observation", escalation: null },
  { text: "Op de hartbewaking en rusten", status: "PASS", category: "Observation", escalation: null },
  { text: "30ml noradrenaline", status: "PASS", category: "Observation", escalation: null },
  { text: "Intuberen", status: "BLOCK", category: "Clinical_Intervention", escalation: "Intensivist" },
  { text: "Verhoog dosis noradrenaline", status: "BLOCK", category: "Clinical_Intervention", escalation: "Intensivist" },
  { text: "Start medicatie", status: "BLOCK", category: "Clinical_Intervention", escalation: "Intensivist" },
  { text: "Naar de OK", status: "BLOCK", category: "Clinical_Intervention", escalation: "Intensivist" },
  { text: "Alarmeer extra personeel", status: "BLOCK", category: "Operational_Command", escalation: "OvD" },
  { text: "Stuur team naar kamer 4", status: "BLOCK", category: "Operational_Command", escalation: "OvD" },
  { text: "Activeer trauma team", status: "BLOCK", category: "Operational_Command", escalation: "OvD" },
  { text: "Wijs bed 7 toe aan patiënt", status: "BLOCK", category: "Allocation", escalation: "IC-Hoofdarts" },
  { text: "Verplaats patiënt naar bed 3", status: "BLOCK", category: "Allocation", escalation: "IC-Hoofdarts" },
  { text: "Bedindeling aanpassen", status: "BLOCK", category: "Allocation", escalation: "IC-Hoofdarts" },
];

const CATEGORY_LABELS: Record<string, string> = {
  Observation: "Observatie",
  Clinical_Intervention: "Klinische Interventie",
  Operational_Command: "Operationeel Commando",
  Allocation: "Allocatie",
};

export default function ArgosPage() {
  const [input, setInput] = useState("");
  const [selectedContext] = useState("IC");
  const queryClient = useQueryClient();

  const { data: observations = [] } = useQuery({
    queryKey: ["observations", selectedContext],
    queryFn: () => fetchObservations(selectedContext),
    refetchInterval: 5000,
  });

  const { data: stats = { total: 0, passed: 0, blocked: 0 } } = useQuery({
    queryKey: ["stats", selectedContext],
    queryFn: () => fetchStats(selectedContext),
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: createObservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["observations"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setInput("");
    },
  });

  const classify = (text: string): Classification => {
    const lower = text.toLowerCase();

    const interventionVerbs = ["intuberen", "start medicatie", "verhoog", "verlaag", "stop medicatie", "geef", "dien toe", "sedatie", "naar de ok", "opereren", "beademen", "extuberen", "bolus", "infuus"];
    const commandVerbs = ["alarmeer", "stuur team", "activeer", "mobiliseer", "ontruim", "inzetten", "oproepen", "dispatch"];
    const allocationVerbs = ["wijs bed", "verplaats patiënt", "bedindeling", "toewijzen", "transfereer", "overplaats", "bed toewijzen"];

    if (allocationVerbs.some(v => lower.includes(v))) {
      return { status: "BLOCK", category: "Allocation", escalation: "IC-Hoofdarts" };
    }
    if (commandVerbs.some(v => lower.includes(v))) {
      return { status: "BLOCK", category: "Operational_Command", escalation: "OvD" };
    }
    if (interventionVerbs.some(v => lower.includes(v))) {
      return { status: "BLOCK", category: "Clinical_Intervention", escalation: "Intensivist" };
    }

    return { status: "PASS", category: "Observation", escalation: null };
  };

  const handleExampleClick = (example: typeof PRESET_EXAMPLES[number]) => {
    mutation.mutate({
      text: example.text,
      status: example.status,
      category: example.category,
      escalation: example.escalation,
      context: selectedContext,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || mutation.isPending) return;
    const result = classify(input);
    mutation.mutate({
      text: input,
      status: result.status,
      category: result.category,
      escalation: result.escalation,
      context: selectedContext,
    });
  };

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
        
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-2 px-4">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-mono text-muted-foreground">Scope:</span>
          <span className="text-sm font-mono font-semibold text-primary">IC</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Totaal</p>
                <h3 className="text-3xl font-mono font-bold mt-2" data-testid="text-stat-total">{stats.total}</h3>
              </div>
              <BarChart2 className="w-8 h-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-green-900/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-500/80">PASS</p>
                <h3 className="text-3xl font-mono font-bold mt-2 text-green-500" data-testid="text-stat-passed">{stats.passed}</h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-red-900/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-destructive/80">BLOCK</p>
                <h3 className="text-3xl font-mono font-bold mt-2 text-destructive" data-testid="text-stat-blocked">{stats.blocked}</h3>
              </div>
              <Shield className="w-8 h-8 text-destructive/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-primary/20">
        <CardContent className="pt-6 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 p-2 rounded bg-green-500/5 border border-green-500/10">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <div>
                <span className="text-green-400 font-semibold">OBSERVATION</span>
                <span className="text-muted-foreground block">→ PASS</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-red-500/5 border border-red-500/10">
              <Shield className="w-3 h-3 text-red-400" />
              <div>
                <span className="text-red-400 font-semibold">INTERVENTIE</span>
                <span className="text-muted-foreground block">→ Intensivist</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-orange-500/5 border border-orange-500/10">
              <AlertTriangle className="w-3 h-3 text-orange-400" />
              <div>
                <span className="text-orange-400 font-semibold">COMMANDO</span>
                <span className="text-muted-foreground block">→ OvD</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-amber-500/5 border border-amber-500/10">
              <UserCheck className="w-3 h-3 text-amber-400" />
              <div>
                <span className="text-amber-400 font-semibold">ALLOCATIE</span>
                <span className="text-muted-foreground block">→ IC-Hoofdarts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-primary" />
            Invoer Classificatie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input 
              data-testid="input-observation"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Voer een observatie of verzoek in..." 
              className="font-mono text-sm bg-background/50 border-primary/20 focus-visible:ring-primary/30"
            />
            <Button data-testid="button-process" type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]">
              {mutation.isPending ? "Scannen..." : "Classificeer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Voorbeelden — IC Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PRESET_EXAMPLES.map((ex, i) => (
              <div 
                key={i}
                data-testid={`button-example-${i}`}
                onClick={() => handleExampleClick(ex)}
                className="group flex items-center justify-between p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-all border border-transparent hover:border-primary/10"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {ex.status === "PASS" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500/70 flex-shrink-0" />
                  ) : (
                    <Shield className="w-3.5 h-3.5 text-destructive/70 flex-shrink-0" />
                  )}
                  <span className="text-sm text-foreground/90 truncate">{ex.text}</span>
                </div>
                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                  <Badge variant={ex.status === "PASS" ? "secondary" : "destructive"} className="font-mono text-[10px] tracking-wider">
                    {ex.status}
                  </Badge>
                  {ex.escalation && (
                    <span className={`text-[10px] font-mono ${ESCALATION_MAP[ex.escalation]?.color || "text-muted-foreground"}`}>
                      {ex.escalation}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full flex flex-col">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              Audit Log (Live)
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
                  observations.map((obs: any) => (
                    <motion.div
                      key={obs.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="mb-4 last:mb-0"
                    >
                      <div className="flex gap-3 items-start p-3 rounded border border-border/40 bg-background/30">
                        <div className="mt-0.5">
                          {obs.status === "PASS" ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-mono text-muted-foreground">
                              {new Date(obs.createdAt).toLocaleTimeString()} — ID: {obs.id.slice(0, 8)}
                            </span>
                            <Badge variant={obs.status === "PASS" ? "outline" : "destructive"} className="text-[10px] h-5">
                              {CATEGORY_LABELS[obs.category] || obs.category}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium" data-testid={`text-observation-${obs.id}`}>{obs.text}</p>
                          <div className="pt-2 flex gap-2 flex-wrap">
                            <span className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
                              TaoGate: {obs.status === "PASS" ? "PASS — Geen escalatie" : "BLOCK"}
                            </span>
                            {obs.escalation && ESCALATION_MAP[obs.escalation] && (
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/50 ${ESCALATION_MAP[obs.escalation].color}`}>
                                {ESCALATION_MAP[obs.escalation].label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs font-mono text-muted-foreground/40 pb-4">
        TaoGate staat observatie toe, blokkeert interventie, en waarborgt dat beslissingen menselijk geautoriseerd blijven.
      </div>
    </div>
  );
}
