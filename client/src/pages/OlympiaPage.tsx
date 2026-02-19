import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, FastForward, Activity, Wind, Zap, Anchor, Layers, Box, Circle, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from "recharts";

// --- DATA & TYPES ---

type Discipline = {
  id: string;
  name: string;
  category: "Athletic" | "Martial";
  icon: any;
  omega: number; // Speed/Decision Frequency
  tau: number;   // Load/Carrying Capacity
  recovery: number; // Required Recovery
  description: string;
  mechanicalRule: string;
  color: string;
};

const DISCIPLINES: Discipline[] = [
  // Athletic (Output & Duration)
  { 
    id: "sprint", 
    name: "Sprint", 
    category: "Athletic", 
    icon: FastForward, 
    omega: 95, 
    tau: 20, 
    recovery: 100, 
    description: "Maximale snelheid over korte tijd. Totale uitputting van draagkracht.",
    mechanicalRule: "P = max(ω) · lim(t)",
    color: "hsl(10, 80%, 60%)" // Red/Orange
  },
  { 
    id: "estafette", 
    name: "Estafette", 
    category: "Athletic", 
    icon: Repeat, 
    omega: 80, 
    tau: 40, 
    recovery: 60, 
    description: "Kritieke overdracht. Synchronisatie is belangrijker dan snelheid.",
    mechanicalRule: "E = sync(ω1, ω2)",
    color: "hsl(40, 90%, 60%)" // Amber
  },
  { 
    id: "horden", 
    name: "Horden", 
    category: "Athletic", 
    icon: Activity, 
    omega: 70, 
    tau: 50, 
    recovery: 40, 
    description: "Ritmische onderbrekingen. Cadans is leidend.",
    mechanicalRule: "ω(t) = sin(t)",
    color: "hsl(150, 60%, 50%)" // Green
  },
  { 
    id: "marathon", 
    name: "Marathon", 
    category: "Athletic", 
    icon: Play, 
    omega: 40, 
    tau: 90, 
    recovery: 20, 
    description: "Duurzame snelheid. Herstel is ingebouwd in de beweging.",
    mechanicalRule: "∫ P dt = constant",
    color: "hsl(200, 80%, 60%)" // Blue
  },
  { 
    id: "triathlon", 
    name: "Triathlon", 
    category: "Athletic", 
    icon: Layers, 
    omega: 60, 
    tau: 70, 
    recovery: 50, 
    description: "Modus-schakeling. Verliesvrij wisselen tussen contexten.",
    mechanicalRule: "Δcontext → min(loss)",
    color: "hsl(280, 60%, 60%)" // Purple
  },
  // Martial (Resistance & Integrity)
  { 
    id: "worstelen", 
    name: "Worstelen", 
    category: "Martial", 
    icon: Anchor, 
    omega: 30, 
    tau: 100, 
    recovery: 80, 
    description: "Directe frictie. Overbruggen van tegenkracht.",
    mechanicalRule: "F = τ - σ(ext)",
    color: "hsl(0, 0%, 40%)" // Dark Grey
  },
  { 
    id: "turks-worstelen", 
    name: "Turks Worstelen", 
    category: "Martial", 
    icon: Wind, 
    omega: 50, 
    tau: 60, 
    recovery: 70, 
    description: "Gladde context (Olie). Grip ontbreekt, balans is leidend.",
    mechanicalRule: "μ ≈ 0 (No Friction)",
    color: "hsl(35, 40%, 50%)" // Brown/Gold
  },
  { 
    id: "aikido", 
    name: "Aikido", 
    category: "Martial", 
    icon: Circle, 
    omega: 40, 
    tau: 30, 
    recovery: 10, 
    description: "Neutraliseren van externe kracht. Vector ombuiging.",
    mechanicalRule: "v_out = -v_in",
    color: "hsl(180, 50%, 70%)" // Cyan/Soft
  },
  { 
    id: "yoga", 
    name: "Yoga", 
    category: "Martial", 
    icon: Box, 
    omega: 10, 
    tau: 80, 
    recovery: 0, 
    description: "Interne uitlijning. Vergroten van effectieve draagkracht.",
    mechanicalRule: "τ_eff = τ_max",
    color: "hsl(300, 30%, 60%)" // Pink/Purple
  },
  { 
    id: "capoeira", 
    name: "Capoeira", 
    category: "Martial", 
    icon: Zap, 
    omega: 75, 
    tau: 50, 
    recovery: 30, 
    description: "Dans tussen conflict en spel. Vloeiende interactie.",
    mechanicalRule: "Flow(ω, τ)",
    color: "hsl(50, 90%, 60%)" // Yellow
  },
];

// --- GENERATE DUMMY GRAPH DATA ---
const generateData = (discipline: Discipline) => {
  return Array.from({ length: 20 }, (_, i) => {
    let value = 50;
    if (discipline.id === 'sprint') value = 80 + Math.random() * 20;
    if (discipline.id === 'marathon') value = 40 + Math.sin(i / 3) * 5;
    if (discipline.id === 'horden') value = 50 + (i % 4 === 0 ? 40 : 0);
    if (discipline.id === 'worstelen') value = 80 + Math.random() * 5; // High constant load
    return { time: i, load: value, omega: discipline.omega + Math.random() * 10 - 5 };
  });
};

export default function OlympiaPage() {
  const [selectedId, setSelectedId] = useState<string>("sprint");
  const activeDiscipline = DISCIPLINES.find(d => d.id === selectedId) || DISCIPLINES[0];
  const chartData = generateData(activeDiscipline);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/20 text-primary rounded-lg">
            <Activity className="w-6 h-6" />
          </div>
          OLYMPIA Decathlon
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          Mechanical Canon 10-Kamp — Selecteer een bewegingsmodus
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: THE 10 DISCIPLINES SELECTOR */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Athletic List */}
          <div>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3 pl-1">
              Atletische Tak (Output)
            </h3>
            <div className="space-y-1">
              {DISCIPLINES.filter(d => d.category === "Athletic").map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                    selectedId === d.id 
                      ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                  )}
                >
                  <d.icon className="w-5 h-5 opacity-70" />
                  <span className="font-medium text-sm">{d.name}</span>
                  {selectedId === d.id && (
                    <motion.div layoutId="active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Martial List */}
          <div>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3 pl-1">
              Martiale Tak (Weerstand)
            </h3>
            <div className="space-y-1">
              {DISCIPLINES.filter(d => d.category === "Martial").map(d => (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                    selectedId === d.id 
                      ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                  )}
                >
                  <d.icon className="w-5 h-5 opacity-70" />
                  <span className="font-medium text-sm">{d.name}</span>
                  {selectedId === d.id && (
                    <motion.div layoutId="active-dot" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: VISUALIZATION & DATA */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Monitor Card */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden relative">
            <div 
              className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none rounded-full blur-3xl"
              style={{ backgroundColor: activeDiscipline.color }} 
            />
            
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <Badge variant="outline" className="font-mono mb-2 border-primary/20 text-primary/80">
                    {activeDiscipline.category.toUpperCase()}
                  </Badge>
                  <CardTitle className="text-3xl font-bold flex items-center gap-3">
                    {activeDiscipline.name}
                  </CardTitle>
                  <CardDescription className="text-base mt-2 max-w-lg">
                    {activeDiscipline.description}
                  </CardDescription>
                </div>
                <div className="text-right font-mono text-sm text-muted-foreground/60 border p-2 rounded bg-background/20">
                  RULE SET:<br/>
                  <span className="text-foreground">{activeDiscipline.mechanicalRule}</span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="mt-6">
              
              {/* Mechanical Metrics */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Omega (Snelheid)</span>
                    <span>{activeDiscipline.omega}%</span>
                  </div>
                  <Progress value={activeDiscipline.omega} className="h-2 bg-muted/50" indicatorClassName="bg-cyan-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Tau (Draagkracht)</span>
                    <span>{activeDiscipline.tau}%</span>
                  </div>
                  <Progress value={activeDiscipline.tau} className="h-2 bg-muted/50" indicatorClassName="bg-purple-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs uppercase tracking-wider text-muted-foreground">
                    <span>Herstelbehoefte</span>
                    <span>{activeDiscipline.recovery}%</span>
                  </div>
                  <Progress value={activeDiscipline.recovery} className="h-2 bg-muted/50" indicatorClassName="bg-amber-500" />
                </div>
              </div>

              {/* Visualization Graph */}
              <div className="h-[300px] w-full bg-background/30 rounded-lg border border-border/30 p-4 relative overflow-hidden">
                 <div className="absolute top-2 left-4 text-xs font-mono text-muted-foreground">REAL-TIME RESONANCE MONITOR</div>
                 
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorOmega" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={activeDiscipline.color} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={activeDiscipline.color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 120]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                        itemStyle={{ fontFamily: 'monospace' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="omega" 
                        stroke={activeDiscipline.color} 
                        fillOpacity={1} 
                        fill="url(#colorOmega)" 
                        strokeWidth={2}
                      />
                      <Line 
                        type="step" 
                        dataKey="load" 
                        stroke="#fff" 
                        strokeOpacity={0.2} 
                        strokeDasharray="5 5" 
                      />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>

            </CardContent>
          </Card>

          {/* Lane Interaction Visualizer */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-card/30 border-border/30">
               <CardHeader className="py-4">
                 <CardTitle className="text-sm font-mono text-muted-foreground">LANE INTERACTION</CardTitle>
               </CardHeader>
               <CardContent className="h-32 flex items-center justify-center relative overflow-hidden">
                  {/* Visualizing "Friction" or "Flow" */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1">
                     {Array.from({length: 12}).map((_, i) => (
                       <motion.div 
                         key={i}
                         className="w-1 h-12 bg-primary/20 rounded-full"
                         animate={{ 
                           height: [20, 60, 20],
                           opacity: [0.2, 0.8, 0.2] 
                         }}
                         transition={{ 
                           duration: 2, 
                           repeat: Infinity, 
                           delay: i * 0.1,
                           ease: "easeInOut"
                         }}
                       />
                     ))}
                  </div>
                  <div className="z-10 text-center">
                    <div className="text-2xl font-bold">1.0</div>
                    <div className="text-xs text-muted-foreground">Resonance Factor</div>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-card/30 border-border/30">
               <CardHeader className="py-4">
                 <CardTitle className="text-sm font-mono text-muted-foreground">PROJECTED WEAR (SILENT VIOLENCE)</CardTitle>
               </CardHeader>
               <CardContent className="h-32 flex items-center justify-center">
                  <div className="text-center">
                    <div className={cn(
                      "text-2xl font-bold", 
                      activeDiscipline.recovery > 80 ? "text-destructive" : "text-green-500"
                    )}>
                      {activeDiscipline.recovery > 80 ? "HIGH" : "NOMINAL"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Based on current Omega load
                    </div>
                  </div>
               </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
