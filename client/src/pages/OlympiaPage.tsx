import { useState } from "react";
import { motion } from "framer-motion";
import { Play, FastForward, Activity, Wind, Zap, Anchor, Layers, Box, Circle, Repeat, Info, AlertTriangle, CheckCircle, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

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

function Flywheel({ discipline, size, speed, direction = 1, label }: { 
  discipline: Discipline; size: number; speed: number; direction?: number; label: string 
}) {
  const segments = 8;
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: discipline.color }}
          animate={{ rotate: direction * 360 }}
          transition={{ duration: Math.max(1, 10 - speed / 15), repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-full"
              style={{ transform: `rotate(${(360 / segments) * i}deg)` }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-1 rounded-full"
                style={{ 
                  height: size * 0.35,
                  backgroundColor: discipline.color,
                  opacity: 0.4 + (i % 2) * 0.3,
                }}
              />
            </div>
          ))}
          <div className="absolute inset-[20%] rounded-full bg-background border flex items-center justify-center" style={{ borderColor: discipline.color + '40' }}>
            <discipline.icon className="w-6 h-6" style={{ color: discipline.color }} />
          </div>
        </motion.div>
        <div className="absolute -bottom-1 -right-1 bg-background rounded px-1.5 py-0.5 border text-[10px] font-mono" style={{ borderColor: discipline.color + '40', color: discipline.color }}>
          ω {discipline.omega}
        </div>
      </div>
      <span className="font-bold text-sm mt-1">{discipline.name}</span>
    </div>
  );
}

function CouplingView() {
  const [leftId, setLeftId] = useState("marathon");
  const [rightId, setRightId] = useState("sprint");
  const left = DISCIPLINES.find(d => d.id === leftId)!;
  const right = DISCIPLINES.find(d => d.id === rightId)!;
  
  const ratio = left.omega / right.omega;
  const mismatch = Math.abs(1 - ratio);
  const leftSize = 140 + left.tau;
  const rightSize = 140 + right.tau;
  
  let couplingStatus: { label: string; description: string; color: string; emoji: string };
  if (mismatch < 0.3) {
    couplingStatus = {
      label: "RESONANTIE",
      description: "De wielen draaien op vergelijkbare frequentie. Energie stroomt vrij tussen beide systemen. Dit is Attunement.",
      color: "text-green-500",
      emoji: "✓"
    };
  } else if (mismatch < 0.6) {
    couplingStatus = {
      label: "SPANNING",
      description: "De wielen draaien met verschil in tempo. Er is frictie, maar de koppeling houdt stand. Er gaat energie verloren aan de overdracht.",
      color: "text-amber-500",
      emoji: "⚠"
    };
  } else {
    couplingStatus = {
      label: "DISSIPATIE",
      description: "De wielen draaien te ver uit sync. Het grote wiel dreigt het kleine kapot te maken, of het kleine wiel raakt losgekoppeld. Energie gaat verloren als schade.",
      color: "text-red-500",
      emoji: "✕"
    };
  }

  return (
    <div className="space-y-8">
      
      {/* Explanation */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Organisaties zijn vliegwielen die in elkaar haken.
            </p>
            <p className="text-sm text-muted-foreground">
              Een corporate (groot wiel, langzaam maar krachtig) en een startup (klein wiel, snel maar licht) 
              kunnen samenwerken — als de koppeling klopt. De startup brengt enthousiasme en snelheid. 
              De corporate brengt draagkracht en stabiliteit. Maar als de frequenties te ver uit elkaar liggen, 
              ontstaat er schade in plaats van synergie.
            </p>
          </div>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Vliegwiel A</label>
          <select 
            data-testid="select-flywheel-a"
            value={leftId} 
            onChange={e => setLeftId(e.target.value)}
            className="w-full bg-card border border-border rounded-md p-2.5 text-sm"
          >
            {DISCIPLINES.map(d => (
              <option key={d.id} value={d.id}>{d.name} — ω {d.omega}, τ {d.tau}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">Vliegwiel B</label>
          <select 
            data-testid="select-flywheel-b"
            value={rightId} 
            onChange={e => setRightId(e.target.value)}
            className="w-full bg-card border border-border rounded-md p-2.5 text-sm"
          >
            {DISCIPLINES.map(d => (
              <option key={d.id} value={d.id}>{d.name} — ω {d.omega}, τ {d.tau}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flywheels Visual */}
      <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Flywheel discipline={left} size={leftSize} speed={left.omega} direction={1} label="Vliegwiel A" />
            
            {/* Coupling Link */}
            <div className="flex flex-col items-center gap-2 px-4">
              <motion.div
                animate={{ 
                  scale: mismatch < 0.3 ? [1, 1.1, 1] : mismatch < 0.6 ? [1, 1.05, 1] : [1, 0.95, 1],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Link2 className={cn("w-8 h-8", couplingStatus.color)} />
              </motion.div>
              <div className="text-center">
                <div className={cn("text-xs font-mono font-bold", couplingStatus.color)}>
                  i = {ratio.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">overdrachtsratio</div>
              </div>
            </div>

            <Flywheel discipline={right} size={rightSize} speed={right.omega} direction={-1} label="Vliegwiel B" />
          </div>
        </CardContent>
      </Card>

      {/* Coupling Status */}
      <Card className={cn("border", 
        mismatch < 0.3 ? "bg-green-500/5 border-green-500/20" : 
        mismatch < 0.6 ? "bg-amber-500/5 border-amber-500/20" : 
        "bg-red-500/5 border-red-500/20"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">{couplingStatus.emoji}</span>
            <div className="space-y-2 flex-1">
              <h3 className={cn("text-lg font-bold font-mono", couplingStatus.color)}>
                {couplingStatus.label}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {couplingStatus.description}
              </p>
              
              {/* Detail Metrics */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/30">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Frequentie A</div>
                  <div className="font-mono font-bold" style={{ color: left.color }}>ω = {left.omega}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Frequentie B</div>
                  <div className="font-mono font-bold" style={{ color: right.color }}>ω = {right.omega}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Verschil</div>
                  <div className={cn("font-mono font-bold", couplingStatus.color)}>
                    {(mismatch * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Practical Advice */}
              <div className="mt-4 p-3 rounded bg-background/50 border border-border/30">
                <p className="text-xs font-medium text-foreground mb-1">Wat betekent dit?</p>
                <p className="text-xs text-muted-foreground">
                  {mismatch < 0.3 
                    ? `${left.name} en ${right.name} draaien op vergelijkbare frequentie. Ze versterken elkaar. De grote brengt draagkracht, de kleine brengt energie. Dit is het ideaal.`
                    : mismatch < 0.6 
                    ? `${left.name} en ${right.name} hebben een verschil in tempo. De overdracht kost extra energie. Afstemming (Attunement) is nodig: wie versnelt, wie vertraagt?`
                    : `${left.name} en ${right.name} zijn te ver uit sync. Als ze gekoppeld blijven, maakt het snellere systeem het tragere kapot — of het tragere remt het snellere af tot stilstand. Ontkoppelen of fundamenteel herpositioneren is nodig.`
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SoloView() {
  const [selectedId, setSelectedId] = useState<string>("sprint");
  const activeDiscipline = DISCIPLINES.find(d => d.id === selectedId)!;
  const chartData = generateData(activeDiscipline);
  const health = getHealthStatus(activeDiscipline);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT: Selector */}
      <div className="lg:col-span-4 space-y-6">
        <div>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">Atletisch</h3>
          <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe hard en hoe lang beweegt de organisatie?</p>
          <div className="space-y-1">
            {DISCIPLINES.filter(d => d.category === "Athletic").map(d => (
              <button key={d.id} data-testid={`button-discipline-${d.id}`} onClick={() => setSelectedId(d.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                  selectedId === d.id ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                )}>
                <d.icon className="w-5 h-5 opacity-70" />
                <div className="flex-1">
                  <span className="font-medium text-sm">{d.name}</span>
                  <p className="text-xs opacity-60 mt-0.5">{d.plainExplanation}</p>
                </div>
                {selectedId === d.id && <motion.div layoutId="solo-dot" className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">Martiaal / Vloeiend</h3>
          <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe gaat de organisatie om met weerstand?</p>
          <div className="space-y-1">
            {DISCIPLINES.filter(d => d.category === "Martial").map(d => (
              <button key={d.id} data-testid={`button-discipline-${d.id}`} onClick={() => setSelectedId(d.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                  selectedId === d.id ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(6,182,212,0.15)]" : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                )}>
                <d.icon className="w-5 h-5 opacity-70" />
                <div className="flex-1">
                  <span className="font-medium text-sm">{d.name}</span>
                  <p className="text-xs opacity-60 mt-0.5">{d.plainExplanation}</p>
                </div>
                {selectedId === d.id && <motion.div layoutId="solo-dot" className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT: Detail */}
      <div className="lg:col-span-8 space-y-6">
        <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none rounded-full blur-3xl" style={{ backgroundColor: activeDiscipline.color }} />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="font-mono border-primary/20 text-primary/80">
                {activeDiscipline.category === "Athletic" ? "ATLETISCH" : "MARTIAAL"}
              </Badge>
              <Badge variant="outline" className={cn("font-mono border", health.bg, health.color)}>
                <health.icon className="w-3 h-3 mr-1" />{health.label}
              </Badge>
            </div>
            <CardTitle className="text-3xl font-bold">{activeDiscipline.name}</CardTitle>
            <CardDescription className="text-base mt-2 max-w-lg">{activeDiscipline.description}</CardDescription>
          </CardHeader>
          <CardContent className="mt-4 space-y-8">
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

            <div className="space-y-6">
              <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">De Meters</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="font-medium">Omega — Snelheid</span><span className="font-mono text-muted-foreground">{activeDiscipline.omega}%</span></div>
                <Progress value={activeDiscipline.omega} className="h-3 bg-muted/50" indicatorClassName="bg-cyan-500" />
                <p className="text-xs text-muted-foreground">Hoe snel volgen besluiten en acties elkaar op?</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="font-medium">Tau — Draagkracht</span><span className="font-mono text-muted-foreground">{activeDiscipline.tau}%</span></div>
                <Progress value={activeDiscipline.tau} className="h-3 bg-muted/50" indicatorClassName="bg-purple-500" />
                <p className="text-xs text-muted-foreground">Hoeveel kan het team aan?</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="font-medium">Herstel nodig</span><span className="font-mono text-muted-foreground">{activeDiscipline.recovery}%</span></div>
                <Progress value={activeDiscipline.recovery} className="h-3 bg-muted/50" indicatorClassName="bg-amber-500" />
                <p className="text-xs text-muted-foreground">100% = volledig stoppen na deze activiteit.</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">Verloop — Snelheid (cyaan) vs. Draagkracht (paars)</h4>
              <div className="h-[220px] w-full bg-background/30 rounded-lg border border-border/30 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="soloOmega" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(190, 80%, 60%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(190, 80%, 60%)" stopOpacity={0}/></linearGradient>
                      <linearGradient id="soloTau" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(280, 60%, 60%)" stopOpacity={0.2}/><stop offset="95%" stopColor="hsl(280, 60%, 60%)" stopOpacity={0}/></linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide /><YAxis hide domain={[0, 110]} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontFamily: 'monospace', fontSize: 12 }} formatter={(value: number, name: string) => [`${value}%`, name === 'omega' ? 'Snelheid (ω)' : 'Draagkracht (τ)']} />
                    <Area type="monotone" dataKey="omega" stroke="hsl(190, 80%, 60%)" fillOpacity={1} fill="url(#soloOmega)" strokeWidth={2} />
                    <Area type="monotone" dataKey="tau" stroke="hsl(280, 60%, 60%)" fillOpacity={1} fill="url(#soloTau)" strokeWidth={2} strokeDasharray="6 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {activeDiscipline.omega > activeDiscipline.tau 
                  ? "⚠️ Snelheid is hoger dan Draagkracht. Dit systeem is overbelast." 
                  : "✓ Draagkracht is hoger dan Snelheid. Dit systeem is in balans."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OlympiaPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/20 text-primary rounded-lg"><Activity className="w-6 h-6" /></div>
          OLYMPIA Decathlon
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          Organisaties bewegen als <strong className="text-foreground">vliegwielen</strong>. 
          Ze draaien elk op hun eigen frequentie. Wanneer twee wielen in elkaar haken, 
          bepaalt de <em>overdrachtsratio</em> of ze samen resoneren — of elkaar kapot maken.
        </p>
      </div>

      <Tabs defaultValue="coupling" className="w-full">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="coupling" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-coupling">
            <Link2 className="w-4 h-4" /> Koppeling (Vliegwielen)
          </TabsTrigger>
          <TabsTrigger value="solo" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-solo">
            <Activity className="w-4 h-4" /> Solo (Discipline)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupling" className="mt-6">
          <CouplingView />
        </TabsContent>

        <TabsContent value="solo" className="mt-6">
          <SoloView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
