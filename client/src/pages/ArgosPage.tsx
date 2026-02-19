import { useState } from "react";
import { Activity, Shield, AlertTriangle, CheckCircle, XCircle, Terminal, BarChart2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

interface Observation {
  id: string;
  text: string;
  status: "PASS" | "BLOCK";
  category: "Observation" | "Intervention" | "Allocatie" | "Command";
  timestamp: string;
}

const PRESET_EXAMPLES = [
  { text: "Saturatie daalt gestaag, patiënt onrustig.", status: "PASS", category: "Observation" },
  { text: "Hartfrequentie stabiel, diurese normaal gemeten.", status: "PASS", category: "Observation" },
  { text: "Verhoog noradrenaline dosering met spoed.", status: "BLOCK", category: "Intervention" },
  { text: "Start sedatie met propofol bij patiënt.", status: "BLOCK", category: "Intervention" },
  { text: "Intuberen en beademing starten onmiddellijk.", status: "BLOCK", category: "Intervention" },
  { text: "Wijs bed 7 toe aan nieuwe patiënt.", status: "BLOCK", category: "Allocatie" },
  { text: "Alarmeer ambulance voor spoedtransport hierheen.", status: "BLOCK", category: "Command" },
] as const;

export default function ArgosPage() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);

  const stats = {
    total: observations.length,
    passed: observations.filter(o => o.status === "PASS").length,
    blocked: observations.filter(o => o.status === "BLOCK").length,
  };

  const handleExampleClick = (example: typeof PRESET_EXAMPLES[number]) => {
    // Simulate processing
    setProcessing(true);
    setInput(example.text);
    
    setTimeout(() => {
      const newObservation: Observation = {
        id: Math.random().toString(36).substring(7),
        text: example.text,
        status: example.status,
        category: example.category,
        timestamp: new Date().toLocaleTimeString(),
      };
      setObservations(prev => [newObservation, ...prev]);
      setProcessing(false);
      setInput("");
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    setProcessing(true);
    // Simple heuristic for demo: if it contains command verbs, block it
    const commandVerbs = ["verhoog", "start", "intuberen", "wijs", "alarmeer", "geef", "doe"];
    const isCommand = commandVerbs.some(v => input.toLowerCase().includes(v));
    
    setTimeout(() => {
      const newObservation: Observation = {
        id: Math.random().toString(36).substring(7),
        text: input,
        status: isCommand ? "BLOCK" : "PASS",
        category: isCommand ? "Intervention" : "Observation",
        timestamp: new Date().toLocaleTimeString(),
      };
      setObservations(prev => [newObservation, ...prev]);
      setProcessing(false);
      setInput("");
    }, 600);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-500 rounded-lg">
              <Eye className="w-6 h-6" />
            </div>
            ORFHEUSS Argos
          </h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Pre-Governance — classify + escalate</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg p-1.5">
          <Activity className="w-4 h-4 text-muted-foreground ml-2" />
          <select className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer">
            <option>IC (Intensive Care)</option>
            <option>Legal Review</option>
            <option>Financial Audit</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Requests</p>
                <h3 className="text-3xl font-mono font-bold mt-2">{stats.total}</h3>
              </div>
              <BarChart2 className="w-8 h-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-green-900/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-green-500/80">Passed (Observations)</p>
                <h3 className="text-3xl font-mono font-bold mt-2 text-green-500">{stats.passed}</h3>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-red-900/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-destructive/80">Blocked (Interventions)</p>
                <h3 className="text-3xl font-mono font-bold mt-2 text-destructive">{stats.blocked}</h3>
              </div>
              <Shield className="w-8 h-8 text-destructive/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Input Section */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-primary" />
            Submit Observation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Voer een observatie of verzoek in..." 
              className="font-mono text-sm bg-background/50 border-primary/20 focus-visible:ring-primary/30"
            />
            <Button type="submit" disabled={processing} className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[120px]">
              {processing ? "Scanning..." : "Process"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Examples & Classification */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Preset Examples */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 h-full">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Voorbeelden — IC Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRESET_EXAMPLES.map((ex, i) => (
              <div 
                key={i}
                onClick={() => handleExampleClick(ex)}
                className="group flex items-center justify-between p-3 rounded-md hover:bg-muted/50 cursor-pointer transition-all border border-transparent hover:border-primary/10"
              >
                <div className="flex items-center gap-3">
                  {ex.status === "PASS" ? (
                    <CheckCircle className="w-4 h-4 text-green-500/70" />
                  ) : (
                    <Shield className="w-4 h-4 text-destructive/70" />
                  )}
                  <span className="text-sm text-foreground/90">{ex.text}</span>
                </div>
                <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                  <Badge variant={ex.status === "PASS" ? "secondary" : "destructive"} className="font-mono text-[10px] tracking-wider">
                    {ex.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground w-24 text-right">{ex.category}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Audit Log */}
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
                    <p>No observations recorded yet.</p>
                  </div>
                ) : (
                  observations.map((obs) => (
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
                            <span className="text-xs font-mono text-muted-foreground">{obs.timestamp} — ID: {obs.id}</span>
                            <Badge variant={obs.status === "PASS" ? "outline" : "destructive"} className="text-[10px] h-5">
                              {obs.category.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{obs.text}</p>
                          <div className="pt-2 flex gap-2">
                             <span className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground">
                               TaoGate: {obs.status === "PASS" ? "GRANTED" : "DENIED"}
                             </span>
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
    </div>
  );
}
