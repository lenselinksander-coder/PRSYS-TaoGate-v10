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

type CouplingMode = {
  id: string;
  name: string;
  icon: any;
  color: string;
  grip: string;
  mechanism: string;
  plainExplanation: string;
  effect: string;
  bestFor: string;
  worstFor: string;
};

const SPEEDS: Discipline[] = [
  { id: "sprint", name: "Sprint", category: "Athletic", icon: FastForward, omega: 95, tau: 20, recovery: 100, description: "Maximale snelheid over korte tijd.", mechanicalRule: "P = max(ω)", color: "hsl(10, 80%, 60%)", plainExplanation: "Alles op alles, heel kort. Daarna ben je leeg.", example: "Spoedoperatie, deadline vandaag, crisis.", risk: "Burn-out als je blijft sprinten." },
  { id: "estafette", name: "Estafette", category: "Athletic", icon: Repeat, omega: 80, tau: 40, recovery: 60, description: "Kritieke overdracht tussen systemen.", mechanicalRule: "sync(ω1, ω2)", color: "hsl(40, 90%, 60%)", plainExplanation: "Stokje doorgeven. Timing is alles.", example: "Dienst-overdracht, project overdragen.", risk: "Stokje valt als tempos niet kloppen." },
  { id: "horden", name: "Horden", category: "Athletic", icon: Activity, omega: 70, tau: 50, recovery: 40, description: "Ritmische onderbrekingen.", mechanicalRule: "ω(t) = sin(t)", color: "hsl(150, 60%, 50%)", plainExplanation: "Rennen met vaste hindernissen.", example: "Vaste vergaderingen, geplande audits.", risk: "Verrassingen verstoren de cadans." },
  { id: "marathon", name: "Marathon", category: "Athletic", icon: Play, omega: 40, tau: 90, recovery: 20, description: "Duurzame snelheid met ingebouwd herstel.", mechanicalRule: "∫P dt = const", color: "hsl(200, 80%, 60%)", plainExplanation: "Rustig en gelijkmatig. Lang vol te houden.", example: "Goed draaiend team, stabiele processen.", risk: "Laag. Gezondste modus." },
  { id: "triathlon", name: "Triathlon", category: "Athletic", icon: Layers, omega: 60, tau: 70, recovery: 50, description: "Schakelen tussen contexten.", mechanicalRule: "Δctx → min(loss)", color: "hsl(280, 60%, 60%)", plainExplanation: "Steeds iets anders doen. Afwisselend.", example: "Manager die tussen vergaderingen springt.", risk: "Elk schakelen kost energie." },
];

const COUPLINGS: CouplingMode[] = [
  { id: "worstelen", name: "Worstelen", icon: Anchor, color: "hsl(0, 0%, 55%)", grip: "Maximaal", mechanism: "Grip — wederzijds begrip. Beide partijen houden elkaar vast.", plainExplanation: "Je pakt elkaar beet. Je voelt elkaars kracht. Er is direct contact en begrip.", effect: "Hoge frictie, maar ook hoge overdracht. Wat de een duwt, voelt de ander direct.", bestFor: "Organisaties die dicht bij elkaar staan en bereid zijn om kracht te delen.", worstFor: "Organisaties die elkaars taal niet spreken. Zonder grip wordt dit een gevecht." },
  { id: "turks-worstelen", name: "Turks Worstelen", icon: Wind, color: "hsl(35, 50%, 55%)", grip: "Geen (olie)", mechanism: "Geen grip — alles glijdt. Kracht is nutteloos, alleen balans werkt.", plainExplanation: "Je probeert de ander vast te pakken, maar alles is glad. Niets houdt.", effect: "Bijna geen overdracht mogelijk. Energie verdwijnt. Frustratie groeit.", bestFor: "Situaties waar je eerst de context moet stabiliseren voordat koppeling kan.", worstFor: "Wanneer je denkt dat harder duwen helpt. Dat maakt het alleen gladder." },
  { id: "aikido", name: "Aikido", icon: Circle, color: "hsl(180, 50%, 65%)", grip: "Hefboom", mechanism: "Eén heeft de ander nodig als hefboom. Je gebruikt de kracht van de ander.", plainExplanation: "In plaats van tegen te duwen, buig je de kracht van de ander om. De ander is je hefboom.", effect: "Lage eigen energie nodig, hoge effectiviteit. Maar vereist vaardigheid en timing.", bestFor: "Wanneer het kleine wiel het grote wiel wil laten draaien — met slimheid, niet met kracht.", worstFor: "Wanneer beide partijen tegelijk willen sturen. Dan ontstaat chaos." },
  { id: "yoga", name: "Yoga", icon: Box, color: "hsl(300, 30%, 60%)", grip: "Intern", mechanism: "Geen externe koppeling — interne uitlijning versterkt het eigen wiel.", plainExplanation: "Je koppelt niet aan de ander. Je maakt jezelf eerst sterker, zodat je later beter kunt koppelen.", effect: "Geen directe overdracht. Wel: grotere toekomstige draagkracht.", bestFor: "Na een periode van overbelasting. Eerst herstellen, dan pas weer koppelen.", worstFor: "Als onmiddellijke actie nodig is. Yoga is geen antwoord op een brand." },
  { id: "capoeira", name: "Capoeira", icon: Zap, color: "hsl(50, 90%, 55%)", grip: "Vloeiend", mechanism: "Dans tussen conflict en spel. De koppeling wisselt continu van aard.", plainExplanation: "Half gevecht, half dans. Je weet niet altijd of jullie samenwerken of concurreren — en dat is precies het punt.", effect: "Hoge energie, hoge creativiteit, maar onvoorspelbaar. Kan omslaan.", bestFor: "Innovatie, brainstorms, creatieve spanning tussen teams.", worstFor: "Wanneer er duidelijkheid en stabiliteit nodig is. Capoeira is chaos met stijl." },
];

const generateData = (discipline: Discipline) => {
  return Array.from({ length: 24 }, (_, i) => {
    let omega = discipline.omega;
    let tau = discipline.tau;
    if (discipline.id === 'sprint') { omega = 80 + Math.random() * 20; tau = Math.max(5, 40 - i * 1.5); }
    if (discipline.id === 'marathon') { omega = 38 + Math.sin(i / 3) * 5; tau = 85 + Math.sin(i / 4) * 5; }
    if (discipline.id === 'horden') { omega = i % 4 === 0 ? 90 : 50; tau = i % 4 === 0 ? 35 : 60; }
    if (discipline.id === 'estafette') { omega = i % 6 < 3 ? 80 : 20; tau = i % 6 < 3 ? 40 : 70; }
    return { time: i, omega: Math.round(omega), tau: Math.round(tau) };
  });
};

function getHealthStatus(d: Discipline) {
  if (d.omega > d.tau) return { label: "OVERBELAST", color: "text-red-500", bg: "bg-red-500/10 border-red-500/20", icon: AlertTriangle };
  if (d.omega > d.tau * 0.7) return { label: "WAARSCHUWING", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", icon: AlertTriangle };
  return { label: "GEZOND", color: "text-green-500", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle };
}

function Flywheel({ discipline, size, speed, direction = 1, label }: { discipline: Discipline; size: number; speed: number; direction?: number; label: string }) {
  const segments = 8;
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div className="absolute inset-0 rounded-full border-2 flex items-center justify-center" style={{ borderColor: discipline.color }}
          animate={{ rotate: direction * 360 }} transition={{ duration: Math.max(1, 10 - speed / 15), repeat: Infinity, ease: "linear" }}>
          {Array.from({ length: segments }).map((_, i) => (
            <div key={i} className="absolute w-full h-full" style={{ transform: `rotate(${(360 / segments) * i}deg)` }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 rounded-full" style={{ height: size * 0.35, backgroundColor: discipline.color, opacity: 0.4 + (i % 2) * 0.3 }} />
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
      <span className="text-xs text-muted-foreground text-center max-w-[140px]">{discipline.plainExplanation}</span>
    </div>
  );
}

function CouplingView() {
  const [leftId, setLeftId] = useState("marathon");
  const [rightId, setRightId] = useState("sprint");
  const [couplingId, setCouplingId] = useState("worstelen");
  
  const left = SPEEDS.find(d => d.id === leftId)!;
  const right = SPEEDS.find(d => d.id === rightId)!;
  const coupling = COUPLINGS.find(c => c.id === couplingId)!;
  
  const ratio = left.omega / right.omega;
  const mismatch = Math.abs(1 - ratio);
  const leftSize = 120 + left.tau * 0.8;
  const rightSize = 120 + right.tau * 0.8;

  const getCouplingResult = () => {
    if (coupling.id === "yoga") {
      return { label: "INTERN HERSTEL", color: "text-purple-400", description: `Geen directe koppeling. ${left.name} en ${right.name} draaien los van elkaar. Elk wiel versterkt zichzelf van binnenuit. Pas na herstel kan er weer gekoppeld worden.` };
    }
    if (coupling.id === "turks-worstelen") {
      return { label: "GEEN GRIP", color: "text-amber-500", description: `${left.name} (ω${left.omega}) en ${right.name} (ω${right.omega}) proberen te koppelen, maar er is geen grip. De olie (onduidelijkheid, politiek) maakt dat kracht niet overgedragen wordt. Eerst moet de context stabiliseren.` };
    }
    if (coupling.id === "aikido") {
      const smaller = left.omega < right.omega ? left : right;
      const bigger = left.omega >= right.omega ? left : right;
      return { label: "HEFBOOM", color: "text-cyan-400", description: `${smaller.name} gebruikt de kracht van ${bigger.name} als hefboom. Het kleinere wiel hoeft niet zelf harder te draaien — het buigt de energie van het grotere wiel om. Slim, niet sterk.` };
    }
    if (coupling.id === "capoeira") {
      return { label: "VLOEIEND", color: "text-yellow-400", description: `${left.name} en ${right.name} wisselen continu tussen samenwerken en concurreren. Het is creatief en energiek, maar onvoorspelbaar. De koppeling pulseert.` };
    }
    // Worstelen
    if (mismatch < 0.3) {
      return { label: "RESONANTIE", color: "text-green-500", description: `${left.name} en ${right.name} hebben grip op elkaar en draaien op vergelijkbare frequentie. Er is wederzijds begrip. Energie stroomt vrij. Dit is Attunement.` };
    }
    if (mismatch < 0.6) {
      return { label: "FRICTIE", color: "text-amber-500", description: `${left.name} en ${right.name} hebben grip, maar de tempos verschillen. De koppeling houdt stand, maar het schuurt. Er gaat energie verloren aan de overdracht. Afstemming is nodig.` };
    }
    return { label: "OVERBELASTING", color: "text-red-500", description: `${left.name} en ${right.name} hebben grip, maar het tempoverschil is te groot. Het snellere wiel (ω${Math.max(left.omega, right.omega)}) dreigt het tragere (ω${Math.min(left.omega, right.omega)}) kapot te trekken. De koppeling moet losser of de snelheden moeten naar elkaar toe.` };
  };

  const result = getCouplingResult();

  return (
    <div className="space-y-8">
      
      {/* Intro */}
      <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              Twee organisaties als vliegwielen. Drie keuzes:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li><strong className="text-foreground">Snelheid A</strong> — Op welk tempo draait de eerste organisatie? (Sprint, Marathon, etc.)</li>
              <li><strong className="text-foreground">Snelheid B</strong> — Op welk tempo draait de tweede?</li>
              <li><strong className="text-foreground">Koppeling</strong> — Hoe zitten ze aan elkaar vast? (Grip, Hefboom, Gladde context, etc.)</li>
            </ol>
          </div>
        </div>
      </div>

      {/* 3 Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
            Snelheid A (Loopdiscipline)
          </label>
          <select data-testid="select-speed-a" value={leftId} onChange={e => setLeftId(e.target.value)} className="w-full bg-card border border-border rounded-md p-2.5 text-sm">
            {SPEEDS.map(d => (<option key={d.id} value={d.id}>{d.name} — ω{d.omega}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
            Koppeling (Hoe verbonden?)
          </label>
          <select data-testid="select-coupling" value={couplingId} onChange={e => setCouplingId(e.target.value)} className="w-full bg-card border border-border rounded-md p-2.5 text-sm">
            {COUPLINGS.map(c => (<option key={c.id} value={c.id}>{c.name} — {c.grip}</option>))}
          </select>
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2 block">
            Snelheid B (Loopdiscipline)
          </label>
          <select data-testid="select-speed-b" value={rightId} onChange={e => setRightId(e.target.value)} className="w-full bg-card border border-border rounded-md p-2.5 text-sm">
            {SPEEDS.map(d => (<option key={d.id} value={d.id}>{d.name} — ω{d.omega}</option>))}
          </select>
        </div>
      </div>

      {/* Flywheels + Coupling Mechanism */}
      <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden">
        <CardContent className="pt-8 pb-8">
          <div className="flex items-center justify-center gap-2 md:gap-6 flex-wrap">
            <Flywheel discipline={left} size={leftSize} speed={left.omega} direction={1} label="Organisatie A" />
            
            {/* Coupling Mechanism */}
            <div className="flex flex-col items-center gap-3 px-2 md:px-6 min-w-[120px]">
              <motion.div
                className="p-3 rounded-full border-2" 
                style={{ borderColor: coupling.color }}
                animate={{ 
                  rotate: coupling.id === "capoeira" ? [0, 10, -10, 0] : 0,
                  scale: coupling.id === "turks-worstelen" ? [1, 0.9, 1.1, 1] : [1, 1.05, 1],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <coupling.icon className="w-6 h-6" style={{ color: coupling.color }} />
              </motion.div>
              <div className="text-center">
                <div className="font-bold text-sm" style={{ color: coupling.color }}>{coupling.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1">Grip: {coupling.grip}</div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">i = {ratio.toFixed(2)}</div>
              </div>
            </div>

            <Flywheel discipline={right} size={rightSize} speed={right.omega} direction={-1} label="Organisatie B" />
          </div>
        </CardContent>
      </Card>

      {/* Coupling Mechanism Explanation */}
      <Card className="bg-card/30 border-border/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <coupling.icon className="w-4 h-4" style={{ color: coupling.color }} />
            Koppelingsmechanisme: {coupling.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground font-medium">{coupling.mechanism}</p>
          <p className="text-sm text-muted-foreground">{coupling.plainExplanation}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3 rounded bg-green-500/5 border border-green-500/10">
              <p className="text-xs font-medium text-green-500 mb-1">Werkt goed bij:</p>
              <p className="text-xs text-muted-foreground">{coupling.bestFor}</p>
            </div>
            <div className="p-3 rounded bg-red-500/5 border border-red-500/10">
              <p className="text-xs font-medium text-red-500 mb-1">Werkt slecht bij:</p>
              <p className="text-xs text-muted-foreground">{coupling.worstFor}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      <Card className={cn("border-2", 
        result.color === "text-green-500" ? "bg-green-500/5 border-green-500/20" :
        result.color === "text-red-500" ? "bg-red-500/5 border-red-500/20" :
        result.color === "text-amber-500" ? "bg-amber-500/5 border-amber-500/20" :
        result.color === "text-cyan-400" ? "bg-cyan-500/5 border-cyan-500/20" :
        result.color === "text-yellow-400" ? "bg-yellow-500/5 border-yellow-500/20" :
        "bg-purple-500/5 border-purple-500/20"
      )}>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <h3 className={cn("text-lg font-bold font-mono", result.color)}>
              {result.label}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {result.description}
            </p>
            
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/30">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Frequentie A</div>
                <div className="font-mono font-bold" style={{ color: left.color }}>ω = {left.omega}</div>
                <div className="text-xs text-muted-foreground">{left.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Koppeling</div>
                <div className="font-mono font-bold" style={{ color: coupling.color }}>{coupling.grip}</div>
                <div className="text-xs text-muted-foreground">{coupling.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Frequentie B</div>
                <div className="font-mono font-bold" style={{ color: right.color }}>ω = {right.omega}</div>
                <div className="text-xs text-muted-foreground">{right.name}</div>
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
  const allDisciplines = [...SPEEDS, ...COUPLINGS.map(c => {
    const d = { id: c.id, name: c.name, category: "Martial" as const, icon: c.icon, omega: 0, tau: 0, recovery: 0, description: c.mechanism, mechanicalRule: "", color: c.color, plainExplanation: c.plainExplanation, example: c.bestFor, risk: c.worstFor };
    if (c.id === "worstelen") { d.omega = 30; d.tau = 100; d.recovery = 80; }
    if (c.id === "turks-worstelen") { d.omega = 50; d.tau = 60; d.recovery = 70; }
    if (c.id === "aikido") { d.omega = 40; d.tau = 30; d.recovery = 10; }
    if (c.id === "yoga") { d.omega = 10; d.tau = 80; d.recovery = 0; }
    if (c.id === "capoeira") { d.omega = 75; d.tau = 50; d.recovery = 30; }
    return d;
  })];
  const activeDiscipline = allDisciplines.find(d => d.id === selectedId)!;
  const chartData = generateData(activeDiscipline);
  const health = getHealthStatus(activeDiscipline);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-6">
        <div>
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">5 Snelheden (Loopdisciplines)</h3>
          <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe hard draait het vliegwiel?</p>
          <div className="space-y-1">
            {SPEEDS.map(d => (
              <button key={d.id} data-testid={`button-discipline-${d.id}`} onClick={() => setSelectedId(d.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                  selectedId === d.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
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
          <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-1 pl-1">5 Koppelingen (Frictie / Attunement)</h3>
          <p className="text-xs text-muted-foreground mb-3 pl-1">Hoe haken de wielen in elkaar?</p>
          <div className="space-y-1">
            {COUPLINGS.map(c => (
              <button key={c.id} data-testid={`button-discipline-${c.id}`} onClick={() => setSelectedId(c.id)}
                className={cn("w-full flex items-center gap-3 p-3 rounded-md text-left transition-all border",
                  selectedId === c.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-card/30 border-transparent hover:bg-card/80 hover:border-border text-muted-foreground"
                )}>
                <c.icon className="w-5 h-5 opacity-70" />
                <div className="flex-1">
                  <span className="font-medium text-sm">{c.name}</span>
                  <p className="text-xs opacity-60 mt-0.5">{c.plainExplanation}</p>
                </div>
                {selectedId === c.id && <motion.div layoutId="solo-dot" className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <Card className="bg-card/50 backdrop-blur-md border-border/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-32 opacity-5 pointer-events-none rounded-full blur-3xl" style={{ backgroundColor: activeDiscipline.color }} />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <Badge variant="outline" className="font-mono border-primary/20 text-primary/80">
                {activeDiscipline.category === "Athletic" ? "SNELHEID" : "KOPPELING"}
              </Badge>
              {activeDiscipline.category === "Athletic" && (
                <Badge variant="outline" className={cn("font-mono border", health.bg, health.color)}>
                  <health.icon className="w-3 h-3 mr-1" />{health.label}
                </Badge>
              )}
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

            {activeDiscipline.category === "Athletic" && (
              <>
                <div className="space-y-6">
                  <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest">De Meters</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="font-medium">Omega — Snelheid</span><span className="font-mono text-muted-foreground">{activeDiscipline.omega}%</span></div>
                    <Progress value={activeDiscipline.omega} className="h-3 bg-muted/50" indicatorClassName="bg-cyan-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="font-medium">Tau — Draagkracht</span><span className="font-mono text-muted-foreground">{activeDiscipline.tau}%</span></div>
                    <Progress value={activeDiscipline.tau} className="h-3 bg-muted/50" indicatorClassName="bg-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="font-medium">Herstel nodig</span><span className="font-mono text-muted-foreground">{activeDiscipline.recovery}%</span></div>
                    <Progress value={activeDiscipline.recovery} className="h-3 bg-muted/50" indicatorClassName="bg-amber-500" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-widest mb-3">Verloop — Snelheid vs. Draagkracht</h4>
                  <div className="h-[200px] w-full bg-background/30 rounded-lg border border-border/30 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="soloO" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(190,80%,60%)" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(190,80%,60%)" stopOpacity={0}/></linearGradient>
                          <linearGradient id="soloT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(280,60%,60%)" stopOpacity={0.2}/><stop offset="95%" stopColor="hsl(280,60%,60%)" stopOpacity={0}/></linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide /><YAxis hide domain={[0, 110]} />
                        <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontFamily: 'monospace', fontSize: 12 }} formatter={(v: number, n: string) => [`${v}%`, n === 'omega' ? 'Snelheid' : 'Draagkracht']} />
                        <Area type="monotone" dataKey="omega" stroke="hsl(190,80%,60%)" fillOpacity={1} fill="url(#soloO)" strokeWidth={2} />
                        <Area type="monotone" dataKey="tau" stroke="hsl(280,60%,60%)" fillOpacity={1} fill="url(#soloT)" strokeWidth={2} strokeDasharray="6 3" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
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
          <strong className="text-foreground">5 Snelheden</strong> bepalen hoe hard elk vliegwiel draait.  
          <strong className="text-foreground"> 5 Koppelingen</strong> bepalen hoe de wielen aan elkaar vastzitten.  
          Samen vormen ze de mechanica van organisatorische beweging.
        </p>
      </div>

      <Tabs defaultValue="coupling" className="w-full">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="coupling" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-coupling">
            <Link2 className="w-4 h-4" /> Koppeling (Vliegwielen)
          </TabsTrigger>
          <TabsTrigger value="solo" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-solo">
            <Activity className="w-4 h-4" /> Solo (Alle 10)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="coupling" className="mt-6"><CouplingView /></TabsContent>
        <TabsContent value="solo" className="mt-6"><SoloView /></TabsContent>
      </Tabs>
    </div>
  );
}
