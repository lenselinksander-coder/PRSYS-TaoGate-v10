import { useState } from "react";
import { motion } from "framer-motion";
import { Play, FastForward, Activity, Wind, Zap, Anchor, Layers, Box, Circle, Repeat, Info, AlertTriangle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Line } from "recharts";

type Discipline = {
  id: string;
  name: string;
  category: "Athletic" | "Martial";
  icon: any;
  omega: number;
  tau: number;
  recovery: number;
  description: string;
  mechanicalRule: string;
  color: string;
  plainExplanation: string;
  example: string;
  risk: string;
};

const DISCIPLINES: Discipline[] = [
  { 
    id: "sprint", name: "Sprint", category: "Athletic", icon: FastForward, 
    omega: 95, tau: 20, recovery: 100, 
    description: "Maximale snelheid over korte tijd. Totale uitputting van draagkracht.",
    mechanicalRule: "P = max(ω) · lim(t)",
    color: "hsl(10, 80%, 60%)",
    plainExplanation: "Alles op alles zetten, heel kort. Daarna ben je leeg.",
    example: "Een spoedoperatie, een deadline vandaag, een crisis die NU moet.",
    risk: "Als je blijft sprinten zonder rust, breek je. Dit is de modus van burn-out."
  },
  { 
    id: "estafette", name: "Estafette", category: "Athletic", icon: Repeat, 
    omega: 80, tau: 40, recovery: 60, 
    description: "Kritieke overdracht. Synchronisatie is belangrijker dan snelheid.",
    mechanicalRule: "E = sync(ω1, ω2)",
    color: "hsl(40, 90%, 60%)",
    plainExplanation: "Je geeft het stokje door aan iemand anders. Timing is alles.",
    example: "Dienst-overdracht op de IC, een project overdragen aan een collega.",
    risk: "Als de ontvanger een ander tempo heeft, valt het stokje. Informatie gaat verloren."
  },
  { 
    id: "horden", name: "Horden", category: "Athletic", icon: Activity, 
    omega: 70, tau: 50, recovery: 40, 
    description: "Ritmische onderbrekingen. Cadans is leidend.",
    mechanicalRule: "ω(t) = sin(t)",
    color: "hsl(150, 60%, 50%)",
    plainExplanation: "Rennen met vaste hindernissen. Je weet wanneer ze komen.",
    example: "Weekelijkse vergaderingen, vaste controlemomenten, geplande audits.",
    risk: "Werkt alleen als het ritme voorspelbaar is. Verrassingen verstoren de cadans."
  },
  { 
    id: "marathon", name: "Marathon", category: "Athletic", icon: Play, 
    omega: 40, tau: 90, recovery: 20, 
    description: "Duurzame snelheid. Herstel is ingebouwd in de beweging.",
    mechanicalRule: "∫ P dt = constant",
    color: "hsl(200, 80%, 60%)",
    plainExplanation: "Rustig en gelijkmatig. Dit kun je lang volhouden.",
    example: "Dagelijks werk in een goed draaiend team, routine-zorg, stabiele processen.",
    risk: "Laag risico. Dit is de gezondste modus. Problemen ontstaan pas als je denkt dat je sneller moet."
  },
  { 
    id: "triathlon", name: "Triathlon", category: "Athletic", icon: Layers, 
    omega: 60, tau: 70, recovery: 50, 
    description: "Modus-schakeling. Verliesvrij wisselen tussen contexten.",
    mechanicalRule: "Δcontext → min(loss)",
    color: "hsl(280, 60%, 60%)",
    plainExplanation: "Je moet steeds iets anders doen. Zwemmen, fietsen, rennen — afwisselend.",
    example: "Een manager die van vergadering naar vergadering springt over verschillende onderwerpen.",
    risk: "Elk 'schakelen' kost energie. Hoe vaker je wisselt, hoe meer je verliest."
  },
  { 
    id: "worstelen", name: "Worstelen", category: "Martial", icon: Anchor, 
    omega: 30, tau: 100, recovery: 80, 
    description: "Directe frictie. Overbruggen van tegenkracht.",
    mechanicalRule: "F = τ - σ(ext)",
    color: "hsl(0, 0%, 50%)",
    plainExplanation: "Je staat tegenover iemand die niet meewerkt. Rechtstreeks kracht tegen kracht.",
    example: "Een conflict met een afdeling, weerstand tegen verandering, een lastige onderhandeling.",
    risk: "Kost enorm veel energie. Je kunt winnen, maar je bent daarna uitgeput."
  },
  { 
    id: "turks-worstelen", name: "Turks Worstelen", category: "Martial", icon: Wind, 
    omega: 50, tau: 60, recovery: 70, 
    description: "Gladde context (Olie). Grip ontbreekt, balans is leidend.",
    mechanicalRule: "μ ≈ 0 (No Friction)",
    color: "hsl(35, 40%, 55%)",
    plainExplanation: "Je probeert grip te krijgen, maar alles glijdt weg. Niets is vast.",
    example: "Werken met onduidelijke regels, politieke situaties, steeds veranderende verwachtingen.",
    risk: "Kracht helpt hier niet. Alleen balans en geduld werken. Dit is de meest frustrerende modus."
  },
  { 
    id: "aikido", name: "Aikido", category: "Martial", icon: Circle, 
    omega: 40, tau: 30, recovery: 10, 
    description: "Neutraliseren van externe kracht. Vector ombuiging.",
    mechanicalRule: "v_out = -v_in",
    color: "hsl(180, 50%, 70%)",
    plainExplanation: "Je gebruikt de kracht van de ander. In plaats van duwen, leid je om.",
    example: "Een klacht ombuigen naar een verbetering, weerstand gebruiken als feedback.",
    risk: "Laag risico. Maar vereist vaardigheid en kalmte. Niet iedereen kan dit."
  },
  { 
    id: "yoga", name: "Yoga", category: "Martial", icon: Box, 
    omega: 10, tau: 80, recovery: 0, 
    description: "Interne uitlijning. Vergroten van effectieve draagkracht.",
    mechanicalRule: "τ_eff = τ_max",
    color: "hsl(300, 30%, 60%)",
    plainExplanation: "Niet bewegen, maar sterker worden. Spanning loslaten zodat je meer aankunt.",
    example: "Teamreflectie, coaching, rust nemen om daarna beter te presteren.",
    risk: "Geen risico. Dit IS het herstel. Maar wordt vaak overgeslagen omdat het 'niets doen' lijkt."
  },
  { 
    id: "capoeira", name: "Capoeira", category: "Martial", icon: Zap, 
    omega: 75, tau: 50, recovery: 30, 
    description: "Dans tussen conflict en spel. Vloeiende interactie.",
    mechanicalRule: "Flow(ω, τ)",
    color: "hsl(50, 90%, 60%)",
    plainExplanation: "Half gevecht, half dans. Het is serieus én speels tegelijk.",
    example: "Brainstormsessies, creatieve spanning, competitieve samenwerking.",
    risk: "Kan omslaan in echt conflict als de 'spelregels' niet duidelijk zijn."
  },
];

const generateData = (discipline: Discipline) => {
  return Array.from({ length: 24 }, (_, i) => {
    let omega = discipline.omega;
    let tau = discipline.tau;
    if (discipline.id === 'sprint') { omega = 80 + Math.random() * 20; tau = Math.max(5, 40 - i * 1.5); }
    if (discipline.id === 'marathon') { omega = 38 + Math.sin(i / 3) * 5; tau = 85 + Math.sin(i / 4) * 5; }
    if (discipline.id === 'horden') { omega = i % 4 === 0 ? 90 : 50; tau = i % 4 === 0 ? 35 : 60; }
    if (discipline.id === 'worstelen') { omega = 25 + Math.random() * 10; tau = 95 - i * 0.5; }
    if (discipline.id === 'estafette') { omega = i % 6 < 3 ? 80 : 20; tau = i % 6 < 3 ? 40 : 70; }
    if (discipline.id === 'yoga') { omega = 8 + Math.random() * 4; tau = 60 + i * 0.8; }
    return { time: i, omega: Math.round(omega), tau: Math.round(tau) };
  });
};

function getHealthStatus(d: Discipline) {
  if (d.omega > d.tau) return { label: "OVERBELAST", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", icon: AlertTriangle };
  if (d.omega > d.tau * 0.7) return { label: "WAARSCHUWING", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle };
  return { label: "GEZOND", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle };
}

export default function OlympiaPage() {
  const [selectedId, setSelectedId] = useState<string>("sprint");
  const activeDiscipline = DISCIPLINES.find(d => d.id === selectedId)!;
  const chartData = generateData(activeDiscipline);
  const health = getHealthStatus(activeDiscipline);

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
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Elke organisatie beweegt. Maar <strong className="text-foreground">hoe</strong> beweegt ze? 
          Sprint ze (snel maar uitputtend) of loopt ze een marathon (rustig en duurzaam)? 
          Kies hieronder een modus om te zien wat de <em>kosten</em> zijn.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT: Discipline Selector */}
        <div className="lg:col-span-4 space-y-6">
          
          <div>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">
              Atletisch
            </h3>
            <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe hard en hoe lang beweegt de organisatie?</p>
            <div className="space-y-1">
              {DISCIPLINES.filter(d => d.category === "Athletic").map(d => (
                <button
                  key={d.id}
                  data-testid={`button-discipline-${d.id}`}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                    selectedId === d.id 
                      ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                  )}
                >
                  <d.icon className="w-5 h-5 opacity-70" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{d.name}</span>
                    <p className="text-xs opacity-60 mt-0.5">{d.plainExplanation}</p>
                  </div>
                  {selectedId === d.id && (
                    <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">
              Martiaal / Vloeiend
            </h3>
            <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe gaat de organisatie om met weerstand en conflict?</p>
            <div className="space-y-1">
              {DISCIPLINES.filter(d => d.category === "Martial").map(d => (
                <button
                  key={d.id}
                  data-testid={`button-discipline-${d.id}`}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                    selectedId === d.id 
                      ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" 
                      : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                  )}
                >
                  <d.icon className="w-5 h-5 opacity-70" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{d.name}</span>
                    <p className="text-xs opacity-60 mt-0.5">{d.plainExplanation}</p>
                  </div>
                  {selectedId === d.id && (
                    <motion.div layoutId="active-dot" className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT: Detail Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Card */}
          <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none rounded-full blur-3xl" style={{ backgroundColor: activeDiscipline.color }} />
            
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="font-mono border-primary/20 text-primary/80">
                      {activeDiscipline.category === "Athletic" ? "ATLETISCH" : "MARTIAAL"}
                    </Badge>
                    <Badge variant="outline" className={cn("font-mono border", health.bg, health.color)}>
                      <health.icon className="w-3 h-3 mr-1" />
                      {health.label}
                    </Badge>
                  </div>
                  <CardTitle className="text-3xl font-bold">{activeDiscipline.name}</CardTitle>
                  <CardDescription className="text-base mt-2 max-w-lg">
                    {activeDiscipline.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="mt-4 space-y-8">
              
              {/* Plain Language Explanation */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{activeDiscipline.plainExplanation}</p>
                    <p className="text-sm text-muted-foreground"><strong>Voorbeeld:</strong> {activeDiscipline.example}</p>
                    <p className="text-sm text-muted-foreground"><strong>Risico:</strong> <span className={health.color}>{activeDiscipline.risk}</span></p>
                  </div>
                </div>
              </div>

              {/* Meters with Labels */}
              <div className="space-y-6">
                <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">De Meters</h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Omega — Snelheid</span>
                    <span className="font-mono text-muted-foreground">{activeDiscipline.omega}%</span>
                  </div>
                  <Progress value={activeDiscipline.omega} className="h-3 bg-muted/50" indicatorClassName="bg-cyan-500" />
                  <p className="text-xs text-muted-foreground">Hoe snel volgen besluiten en acties elkaar op? Hoe hoger, hoe meer druk.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Tau — Draagkracht</span>
                    <span className="font-mono text-muted-foreground">{activeDiscipline.tau}%</span>
                  </div>
                  <Progress value={activeDiscipline.tau} className="h-3 bg-muted/50" indicatorClassName="bg-purple-500" />
                  <p className="text-xs text-muted-foreground">Hoeveel kan het team aan? Hoe lager, hoe kwetsbaarder het systeem.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">Herstel nodig na afloop</span>
                    <span className="font-mono text-muted-foreground">{activeDiscipline.recovery}%</span>
                  </div>
                  <Progress value={activeDiscipline.recovery} className="h-3 bg-muted/50" indicatorClassName="bg-amber-500" />
                  <p className="text-xs text-muted-foreground">Hoeveel rust is er nodig? 100% = je moet volledig stoppen na deze activiteit.</p>
                </div>
              </div>

              {/* Chart */}
              <div>
                <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  Verloop over tijd — Snelheid (cyaan) vs. Draagkracht (paars)
                </h4>
                <div className="h-[250px] w-full bg-background/30 rounded-lg border border-border/30 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorOmega" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(190, 80%, 60%)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(190, 80%, 60%)" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorTau" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(280, 60%, 60%)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="hsl(280, 60%, 60%)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 110]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontFamily: 'monospace', fontSize: 12 }}
                        formatter={(value: number, name: string) => [
                          `${value}%`, 
                          name === 'omega' ? 'Snelheid (ω)' : 'Draagkracht (τ)'
                        ]}
                      />
                      <Area type="monotone" dataKey="omega" stroke="hsl(190, 80%, 60%)" fillOpacity={1} fill="url(#colorOmega)" strokeWidth={2} />
                      <Area type="monotone" dataKey="tau" stroke="hsl(280, 60%, 60%)" fillOpacity={1} fill="url(#colorTau)" strokeWidth={2} strokeDasharray="6 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {activeDiscipline.omega > activeDiscipline.tau 
                    ? "⚠️ Snelheid (cyaan) is hoger dan Draagkracht (paars). Dit systeem is overbelast." 
                    : "✓ Draagkracht (paars) is hoger dan Snelheid (cyaan). Dit systeem is in balans."}
                </p>
              </div>

            </CardContent>
          </Card>

          {/* Bottom Insight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card/30 border-border/30">
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-mono text-muted-foreground">KERNVRAAG</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed">
                  {activeDiscipline.omega > activeDiscipline.tau
                    ? "\"We gaan te hard. Wat moeten we loslaten of vertragen?\""
                    : activeDiscipline.recovery > 60
                    ? "\"We hebben het volgehouden, maar we moeten nu echt rust nemen.\""
                    : "\"Dit tempo is houdbaar. Hoe houden we dit vol?\""}
                </p>
              </CardContent>
            </Card>

            <Card className={cn("border", health.bg)}>
              <CardHeader className="py-4">
                <CardTitle className="text-sm font-mono text-muted-foreground">CONSTRAINT (O36)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground font-mono mb-2">ω ≤ f(τ - σ_ext)</p>
                <p className="text-xs text-muted-foreground">
                  {activeDiscipline.omega > activeDiscipline.tau
                    ? "Snelheid overstijgt draagkracht. Systeembreuk dreigt."
                    : "Snelheid blijft binnen draagkracht. Systeem is stabiel."}
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
