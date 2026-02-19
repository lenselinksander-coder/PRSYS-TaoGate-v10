import { useState } from "react";
import { Info, Eye, Scale, Layers, BookOpen, Shield, CheckCircle, AlertTriangle, Gavel, Globe, Landmark, Building2, MapPin, ArrowRight, ArrowDown, FileText, Terminal, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

type Section = "legenda" | "woordenlijst" | "gebruik" | "voorbeelden";

const GATE_DECISIONS = [
  {
    status: "PASS",
    label: "PASS",
    description: "Vrije doorgang. Geen risico gedetecteerd, geen escalatie nodig. De invoer is veilig.",
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    icon: CheckCircle,
    example: "spamfilter",
  },
  {
    status: "PASS_WITH_TRANSPARENCY",
    label: "PASS + TRANSPARANTIE",
    description: "Doorgang met transparantieverplichting. De invoer mag doorgaan, maar de gebruiker moet ge\u00efnformeerd worden dat AI betrokken is.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
    icon: Info,
    example: "chatbot",
  },
  {
    status: "ESCALATE_HUMAN",
    label: "ESCALATIE MENS",
    description: "Menselijke beoordeling vereist. De invoer raakt een hoog-risico domein. Een mens moet meekijken en goedkeuren.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/20",
    icon: AlertTriangle,
    example: "biometrisch",
  },
  {
    status: "ESCALATE_REGULATORY",
    label: "ESCALATIE TOEZICHT",
    description: "Toezichthouder betrekken. De invoer valt onder strenger regulatoir toezicht. De DPO of AI Office moet worden ge\u00efnformeerd.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: AlertTriangle,
    example: "foundation model",
  },
  {
    status: "BLOCK",
    label: "BLOCK",
    description: "Verboden. De invoer is wettelijk niet toegestaan. Absolute grens. Geen uitzonderingen.",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: Shield,
    example: "social scoring",
  },
];

const JURISDICTION_LAYERS = [
  { layer: "EU", label: "Europese Unie", icon: Globe, color: "text-blue-400", priority: "Hoogste", description: "EU-verordeningen hebben directe werking in alle lidstaten. Gaan boven nationale wetgeving." },
  { layer: "NATIONAL", label: "Nationaal", icon: Landmark, color: "text-amber-400", priority: "Hoog", description: "Nationale wetgeving implementeert EU-regels en voegt eigen regels toe (UAVG, WGBO)." },
  { layer: "REGIONAL", label: "Regionaal", icon: Building2, color: "text-purple-400", priority: "Gemiddeld", description: "Provinciale en regionale protocollen, bijvoorbeeld GGD-richtlijnen." },
  { layer: "MUNICIPAL", label: "Gemeentelijk", icon: MapPin, color: "text-emerald-400", priority: "Laagste", description: "Lokale verordeningen en beleidsregels van de gemeente." },
];

const WOORDENLIJST = [
  { term: "ORFHEUSS", category: "Systeem", definition: "Limiting architecture framework voor AI-systemen die beslissingen be\u00efnvloeden. Geen model, geen methode \u2014 een begrenzende orde die v\u00f3\u00f3r output werkt. Bevat alle modules (ARGOS, OLYMPIA, SCOPES, LEXICON)." },
  { term: "PRSYS", category: "Systeem", definition: "Paontologisch Resonantie Systeem. De runtime-architectuur die ORFHEUSS operationaliseert. ORFHEUSS bepaalt wat geldig is; PRSYS bepaalt hoe requests bewegen, welke module wordt aangesproken, en hoe output wordt gevalideerd." },
  { term: "Canon (Layer 0)", category: "Systeem", definition: "Read-only normatieve kern: axioma\u2019s, formules, definities van geldigheid. Wijzigt alleen via formele Editio-procedure. De canon beweegt eerst, de architectuur volgt, de code implementeert. Nooit omgekeerd." },
  { term: "Editio", category: "Systeem", definition: "Formele versie van de canon. Elke wijziging aan de normatieve kern vereist een Editio-upgrade met impactanalyse op alle lagen. Huidige versie: Editio I." },
  { term: "Paontologie", category: "Filosofie", definition: "Kruising van Merleau-Ponty (het lichaam als kennis) en Tao (de weg, de stroom). Organisaties als vliegwielen die op elkaar inwerken." },
  { term: "ARGOS (TaoGate)", category: "Module", definition: "De poortwachter (Layer 1). Deterministische gate-engine: mandaatcontrole, grensregels, routing, escalatie, audit. Classificeert invoer in 5 gate-beslissingen. Elke invoer passeert eerst ARGOS." },
  { term: "OLYMPIA", category: "Module", definition: "De regeluitvoeringslaag. Lost conflicten op tussen regels uit 4 jurisdictielagen (EU \u2192 Nationaal \u2192 Regionaal \u2192 Gemeentelijk)." },
  { term: "SCOPES", category: "Module", definition: "Organisatorische scope-definitie. Hier definieert u categorie\u00ebn, trefwoorden, escalatiepaden, documenten en regels per organisatie." },
  { term: "MC (Management Console)", category: "Concept", definition: "Elke scope is een MC. Een organisatie definieert haar eigen MC met eigen regels, categorieën en escalatiepaden." },
  { term: "Scope", category: "Concept", definition: "Een begrensde set toegestane acties binnen een organisatie. Bevat categorie\u00ebn, regels, documenten en escalatiepaden die samen de governance vormen." },
  { term: "Mandaat", category: "Concept", definition: "Begrensde autorisatie met scope, vervaltijd en risicotolerantie. Mandaat is relationeel, niet hi\u00ebrarchisch. Geen mandaat = geen actie. (A11: M \u2260 U \u2014 Mandaat is geen autoriteit.)" },
  { term: "Gate-beslissing", category: "Concept", definition: "Het oordeel van de TaoGate over een invoer: PASS, PASS+TRANSPARANTIE, ESCALATIE MENS, ESCALATIE TOEZICHT, of BLOCK." },
  { term: "Regeldruk (F-druk)", category: "Concept", definition: "De som van alle regelgewichten in een scope. Hoge regeldruk = veel regels met hoge impact. Formule: \u03a3(laaggewicht \u00d7 actiegewicht)." },
  { term: "Jurisdictielaag", category: "Concept", definition: "Het bestuursniveau waarop een regel geldt: EU (hoogste), Nationaal, Regionaal, Gemeentelijk (laagste)." },
  { term: "Silent Violence", category: "Concept", definition: "Onzichtbare schade die ontstaat wanneer systemen niet op elkaar zijn afgestemd. Niemand benoemt het, maar iedereen voelt het." },
  { term: "Escalatie", category: "Concept", definition: "Doorverwijzing naar een persoon of instantie die bevoegd is om te oordelen. Niet negatief \u2014 het is een beschermingsmechanisme. Default bij twijfel." },
  { term: "Provenance", category: "Concept", definition: "Herkomstgegevens bij elke output: welke module, welke gate-status, welk mandaat, welk audit-ID. Elke beslissing is herleidbaar." },
  { term: "Cerberus (Boundary Engine)", category: "Module", definition: "Absoluut stoprecht. Deterministische handhaving zonder interpretatie. Cerberus \u201cnee\u201d is niet overrulbaar. Vertaald in code: BLOCK wint altijd." },
  { term: "Audit Log", category: "Functie", definition: "Het geheugen van het systeem. Elke invoer wordt vastgelegd met tijdstip, classificatie, TaoGate-oordeel en Olympia-resultaat. Volledige traceerbaarheid." },
  { term: "BLOCK wint altijd", category: "Regel", definition: "Als \u00e9\u00e9n regel in het systeem BLOCK zegt, dan is het BLOCK. Ongeacht wat andere regels zeggen. Absolute grens. (Cerberus-principe.)" },
  { term: "Hogere laag wint", category: "Regel", definition: "Bij conflict tussen lagen wint de hogere jurisdictie. EU gaat boven Nationaal, Nationaal boven Regionaal, enzovoort." },
];

const VOORBEELDEN = [
  {
    input: "spamfilter",
    taogate: { status: "PASS", category: "Minimaal Risico", escalation: null },
    olympia: { rule: "EU_AI_ART_95", layer: "EU", action: "PASS", title: "Minimaal-risico AI" },
    explanation: "Een spamfilter is een AI-systeem met minimaal risico. Vrije doorgang, geen restricties. De EU AI Act staat dit onbeperkt toe (Art. 95).",
    flow: ["Invoer: \"spamfilter\"", "TaoGate: trefwoord match \u2192 EU_AI_MINIMAL", "Gate: PASS \u2014 geen escalatie", "Olympia: EU_AI_ART_95 \u2192 PASS", "Resultaat: vrije doorgang"],
  },
  {
    input: "chatbot",
    taogate: { status: "PASS_WITH_TRANSPARENCY", category: "Beperkt Risico", escalation: "Transparantieverplichting" },
    olympia: { rule: "EU_AI_ART_50", layer: "EU", action: "PASS_WITH_TRANSPARENCY", title: "Transparantieverplichtingen" },
    explanation: "Een chatbot mag worden ingezet, maar gebruikers moeten weten dat ze met AI praten. De EU AI Act vereist transparantie (Art. 50). De gemeente kan aanvullend een registratie in het algoritmeregister vereisen.",
    flow: ["Invoer: \"chatbot\"", "TaoGate: trefwoord match \u2192 EU_AI_LIMITED_RISK", "Gate: PASS + TRANSPARANTIE", "Olympia: EU_AI_ART_50 \u2192 transparantieverplichting", "Resultaat: doorgang met informatieplicht"],
  },
  {
    input: "biometrisch",
    taogate: { status: "ESCALATE_HUMAN", category: "Hoog Risico", escalation: "DPO / Legal / Conformiteitsbeoordelaar" },
    olympia: { rule: "NL_UAVG_BIO", layer: "NATIONAL", action: "BLOCK", title: "UAVG biometrische gegevens" },
    explanation: "Belangrijk voorbeeld van hoe twee lagen samenwerken. TaoGate classificeert als hoog risico (escalatie mens). Maar Olympia vindt een nationale BLOCK-regel (UAVG Art. 29): biometrische verwerking is verboden. BLOCK wint altijd \u2014 dus het eindresultaat is strenger dan de TaoGate alleen zou geven.",
    flow: ["Invoer: \"biometrisch\"", "TaoGate: trefwoord match \u2192 EU_AI_HIGH_RISK", "Gate: ESCALATIE MENS \u2192 DPO/Legal", "Olympia zoekt regels in domein AI...", "Vindt: NL_UAVG_BIO [NATIONAL] \u2192 BLOCK", "BLOCK wint altijd, ongeacht laag", "Resultaat: verboden (nationale wet)"],
  },
  {
    input: "foundation model",
    taogate: { status: "ESCALATE_REGULATORY", category: "General Purpose AI", escalation: "AI Office / DPO" },
    olympia: { rule: "EU_AI_ART_51", layer: "EU", action: "ESCALATE_REGULATORY", title: "GPAI-modellen" },
    explanation: "Foundation models (LLM's, GPT, etc.) vallen onder de GPAI-regels. Toezichthouder moet betrokken worden. Zowel TaoGate als Olympia komen op hetzelfde uit: regulatoire escalatie. De AI Office is verantwoordelijk.",
    flow: ["Invoer: \"foundation model\"", "TaoGate: trefwoord match \u2192 EU_AI_GPAI", "Gate: ESCALATIE TOEZICHT \u2192 AI Office / DPO", "Olympia: EU_AI_ART_51 \u2192 ESCALATE_REGULATORY", "Resultaat: toezichthouder inschakelen"],
  },
  {
    input: "social scoring",
    taogate: { status: "BLOCK", category: "Verboden AI", escalation: "AI Office / Toezichthouder" },
    olympia: { rule: "EU_AI_ART_5", layer: "EU", action: "BLOCK", title: "Verboden AI-praktijken" },
    explanation: "Social scoring is absoluut verboden onder de EU AI Act (Art. 5). Geen discussie, geen escalatie, geen uitzondering. De TaoGate blokkeert direct en Olympia bevestigt met de hoogst mogelijke jurisdictie (EU). De regeldruk is oneindig (\u221e).",
    flow: ["Invoer: \"social scoring\"", "TaoGate: trefwoord match \u2192 EU_AI_PROHIBITED", "Gate: BLOCK \u2014 verboden", "Olympia: EU_AI_ART_5 [EU] \u2192 BLOCK", "Regeldruk: \u221e (oneindig)", "Resultaat: absoluut verboden"],
  },
  {
    input: "iets onbekends",
    taogate: { status: "PASS", category: "Minimaal Risico (default)", escalation: null },
    olympia: { rule: null, layer: null, action: null, title: null },
    explanation: "Als een invoer geen enkel trefwoord matcht, valt het terug op de standaardcategorie: PASS (minimaal risico). Olympia vindt geen specifieke regel. Dit is het blanco-gedrag \u2014 als niets is gedefinieerd, is alles vrij. Dat maakt het defini\u00ebren van scopes cruciaal.",
    flow: ["Invoer: \"iets onbekends\"", "TaoGate: geen trefwoord match", "Fallback naar standaard: PASS", "Olympia: geen regels gevonden", "Resultaat: vrije doorgang (default)"],
  },
];

function GateDecisionBadge({ status }: { status: string }) {
  const config = GATE_DECISIONS.find(g => g.status === status);
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function ManualPage() {
  const [activeSection, setActiveSection] = useState<Section>("legenda");

  const sections: { id: Section; label: string; icon: any }[] = [
    { id: "legenda", label: "Legenda", icon: Eye },
    { id: "woordenlijst", label: "Woordenlijst", icon: BookOpen },
    { id: "gebruik", label: "Hoe te gebruiken", icon: Terminal },
    { id: "voorbeelden", label: "Invoervoorbeelden", icon: Zap },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">

      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3" data-testid="text-page-title">
          <div className="p-2 bg-primary/20 text-primary rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          ORFHEUSS Handleiding
        </h1>
        <p className="text-xs font-mono text-primary/60 mt-0.5">
          Volledige gebruikershandleiding voor de governance-console
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              data-testid={`tab-manual-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "px-4 py-2.5 rounded-md text-sm font-medium transition-all border flex items-center gap-2",
                activeSection === s.id
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card/30 border-border/50 text-muted-foreground hover:bg-card/80"
              )}
            >
              <Icon className="w-4 h-4" />
              {s.label}
            </button>
          );
        })}
      </div>

      {activeSection === "legenda" && (
        <div className="space-y-8">

          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Legenda</h2>
            <p className="text-sm text-muted-foreground">Alle visuele indicatoren en hun betekenis.</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              TaoGate Beslissingen (5 niveaus)
            </h3>
            <p className="text-sm text-muted-foreground">
              Elke invoer in ARGOS krijgt precies \u00e9\u00e9n van deze vijf beslissingen. Van veilig (groen) naar verboden (rood).
            </p>
            <div className="space-y-3">
              {GATE_DECISIONS.map(g => {
                const Icon = g.icon;
                return (
                  <Card key={g.status} className={`${g.bg} border ${g.border}`}>
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${g.bg} border ${g.border}`}>
                          <Icon className={`w-5 h-5 ${g.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className={`font-mono font-bold text-sm ${g.color}`}>{g.label}</span>
                            <div className={`w-2.5 h-2.5 rounded-full ${g.color.replace("text-", "bg-")} shadow-sm`} />
                          </div>
                          <p className="text-sm text-muted-foreground">{g.description}</p>
                          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">Voorbeeld-trefwoord: "{g.example}"</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              Jurisdictielagen (4 niveaus)
            </h3>
            <p className="text-sm text-muted-foreground">
              Olympia werkt met 4 bestuurslagen. Hogere laag wint bij conflict. De laag bepaalt de kleur en het gewicht van een regel.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {JURISDICTION_LAYERS.map((l, i) => {
                const Icon = l.icon;
                return (
                  <Card key={l.layer} className="bg-card/30 border-border/30">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={`w-5 h-5 ${l.color}`} />
                          <span className="text-[10px] font-mono text-muted-foreground">P{i + 1}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-mono font-bold text-sm ${l.color}`}>{l.label}</span>
                            <Badge variant="outline" className="text-[10px] border-border/40">Prioriteit: {l.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{l.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="bg-card/30 border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Conflictregels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded bg-red-500/5 border border-red-500/10">
                <Shield className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-400">BLOCK wint altijd</p>
                  <p className="text-xs text-muted-foreground">Als \u00e9\u00e9n regel op \u00e9\u00e9n laag BLOCK zegt, is het eindresultaat BLOCK. Altijd. Ongeacht andere regels.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded bg-blue-500/5 border border-blue-500/10">
                <Layers className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-blue-400">Hogere jurisdictie wint</p>
                  <p className="text-xs text-muted-foreground">Bij conflict tussen twee regels met verschillende actie wint de hogere laag. EU gaat boven Nationaal, Nationaal boven Regionaal.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded bg-amber-500/5 border border-amber-500/10">
                <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-400">Regeldruk</p>
                  <p className="text-xs text-muted-foreground">De regeldruk is de optelsom van alle regelgewichten. BLOCK = oneindig (\u221e). Hogere lagen wegen zwaarder. Formule: \u03a3(laaggewicht \u00d7 actiegewicht).</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/30 border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Iconen in de interface
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <span className="text-muted-foreground">ARGOS / TaoGate</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <Scale className="w-4 h-4 text-purple-400" />
                  <span className="text-muted-foreground">OLYMPIA</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">SCOPES</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Audit Log</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <Gavel className="w-4 h-4 text-amber-400" />
                  <span className="text-muted-foreground">Regelconflict</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-background/30">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Lexicon</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {activeSection === "woordenlijst" && (
        <div className="space-y-6">

          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Verklarende Woordenlijst</h2>
            <p className="text-sm text-muted-foreground">Alle termen die u tegenkomt in de ORFHEUSS Console, van A tot Z.</p>
          </div>

          {["Systeem", "Module", "Concept", "Filosofie", "Functie", "Regel"].map(cat => {
            const terms = WOORDENLIJST.filter(w => w.category === cat);
            if (terms.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-sm font-bold text-primary uppercase tracking-wider">{cat}</h3>
                <div className="space-y-2">
                  {terms.map(w => (
                    <div key={w.term} className="p-3 rounded-lg bg-card/30 border border-border/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-sm text-foreground">{w.term}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{w.definition}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {activeSection === "gebruik" && (
        <div className="space-y-8">

          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Hoe te gebruiken</h2>
            <p className="text-sm text-muted-foreground">Stap-voor-stap handleiding per module.</p>
          </div>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Beginprincipe:</strong> ORFHEUSS start als een blanco project. Er zijn geen regels, geen categorie\u00ebn, geen escalatiepaden. Alles begint bij het aanmaken van een <strong className="text-primary">Scope</strong>. Zonder scope is er geen classificatie.
              </p>
              <div className="mt-3 font-mono text-xs text-primary/60">
                Scope \u2192 Categorie\u00ebn \u2192 Trefwoorden \u2192 TaoGate \u2192 Olympia \u2192 Resultaat
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-primary border-primary/30">STAP 1</Badge>
              <h3 className="text-lg font-bold">SCOPES \u2014 Definieer uw organisatie</h3>
            </div>
            <Card className="bg-card/30 border-border/30">
              <CardContent className="pt-5 space-y-4">
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground marker:text-primary">
                  <li>
                    <strong className="text-foreground">Navigeer naar SCOPES</strong> via de navigatiebalk.
                  </li>
                  <li>
                    <strong className="text-foreground">Maak een nieuwe scope aan.</strong> Geef een naam (bijv. "IC", "HR", "Finance") en een beschrijving.
                  </li>
                  <li>
                    <strong className="text-foreground">Voeg categorie\u00ebn toe.</strong> Elke categorie heeft:
                    <ul className="pl-6 mt-2 space-y-1.5 list-disc">
                      <li><strong className="text-foreground">Naam</strong> \u2014 interne ID (bijv. "EU_AI_PROHIBITED")</li>
                      <li><strong className="text-foreground">Label</strong> \u2014 zichtbare naam (bijv. "Verboden AI")</li>
                      <li><strong className="text-foreground">Status</strong> \u2014 \u00e9\u00e9n van de 5 gate-beslissingen</li>
                      <li><strong className="text-foreground">Trefwoorden</strong> \u2014 woorden die deze categorie triggeren</li>
                      <li><strong className="text-foreground">Escalatie</strong> \u2014 naar wie wordt ge\u00ebscaleerd (optioneel)</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-foreground">Voeg regels toe</strong> (optioneel). Regels zijn de juridische basis voor Olympia:
                    <ul className="pl-6 mt-2 space-y-1.5 list-disc">
                      <li><strong className="text-foreground">Laag</strong> \u2014 EU, Nationaal, Regionaal of Gemeentelijk</li>
                      <li><strong className="text-foreground">Domein</strong> \u2014 het domein (bijv. "AI", "Privacy")</li>
                      <li><strong className="text-foreground">Actie</strong> \u2014 wat de regel voorschrijft (PASS, BLOCK, etc.)</li>
                      <li><strong className="text-foreground">Bron</strong> \u2014 de wet of verordening (bijv. "EU AI Act")</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-foreground">Sla op.</strong> De scope is nu actief en beschikbaar in ARGOS en OLYMPIA.
                  </li>
                </ol>
                <Button asChild variant="secondary" size="sm" className="mt-2">
                  <Link href="/scopes">
                    Naar SCOPES <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-blue-400 border-blue-400/30">STAP 2</Badge>
              <h3 className="text-lg font-bold">ARGOS (TaoGate) \u2014 Classificeer invoer</h3>
            </div>
            <Card className="bg-card/30 border-border/30">
              <CardContent className="pt-5 space-y-4">
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground marker:text-primary">
                  <li>
                    <strong className="text-foreground">Navigeer naar ARGOS</strong> (het oog-icoon).
                  </li>
                  <li>
                    <strong className="text-foreground">Controleer de actieve scope</strong> \u2014 rechtsboven ziet u welke MC (organisatie) actief is.
                  </li>
                  <li>
                    <strong className="text-foreground">Typ een invoer</strong> in het tekstveld, of klik op een voorbeeld-trefwoord.
                  </li>
                  <li>
                    <strong className="text-foreground">Klik "Classificeer"</strong> \u2014 het systeem doet twee dingen tegelijk:
                    <ul className="pl-6 mt-2 space-y-1.5 list-disc">
                      <li><strong className="text-blue-400">TaoGate</strong> \u2014 matcht trefwoorden en geeft een gate-beslissing (PASS t/m BLOCK)</li>
                      <li><strong className="text-purple-400">Olympia</strong> \u2014 zoekt regels in het relevante domein en bepaalt de winnende regel (alleen als de scope regels bevat)</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-foreground">Lees het resultaat</strong> in de Audit Log:
                    <ul className="pl-6 mt-2 space-y-1.5 list-disc">
                      <li>De <strong className="text-foreground">kleurcode</strong> toont de gate-beslissing</li>
                      <li>De <strong className="text-foreground">TaoGate-badge</strong> toont de classificatie en escalatie</li>
                      <li>De <strong className="text-foreground">Olympia-badge</strong> toont de winnende regel en jurisdictielaag</li>
                    </ul>
                  </li>
                </ol>

                <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded text-xs text-blue-300/80 flex items-start gap-3">
                  <Info className="w-4 h-4 shrink-0 text-blue-400 mt-0.5" />
                  <p>
                    <strong>Let op:</strong> TaoGate en Olympia kunnen verschillende uitkomsten geven. Dat is precies de bedoeling \u2014 het spanningsveld tussen classificatie en jurisdictie maakt de governance compleet.
                  </p>
                </div>

                <Button asChild variant="secondary" size="sm" className="mt-2">
                  <Link href="/">
                    Naar ARGOS <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-purple-400 border-purple-400/30">STAP 3</Badge>
              <h3 className="text-lg font-bold">OLYMPIA \u2014 Bekijk het regellandschap</h3>
            </div>
            <Card className="bg-card/30 border-border/30">
              <CardContent className="pt-5 space-y-4">
                <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground marker:text-primary">
                  <li>
                    <strong className="text-foreground">Navigeer naar OLYMPIA</strong> (het weegschaal-icoon).
                  </li>
                  <li>
                    <strong className="text-foreground">Bekijk de jurisdictielagen</strong> \u2014 u ziet alle 4 lagen met hun regels, van EU (bovenaan) tot Gemeentelijk (onderaan).
                  </li>
                  <li>
                    <strong className="text-foreground">Klik op een laag</strong> om de regels te zien. Elke regel toont:
                    <ul className="pl-6 mt-2 space-y-1.5 list-disc">
                      <li>De <strong className="text-foreground">titel</strong> en beschrijving</li>
                      <li>De <strong className="text-foreground">actie</strong> (PASS, BLOCK, ESCALATIE)</li>
                      <li>De <strong className="text-foreground">bron</strong> (welke wet of verordening)</li>
                    </ul>
                  </li>
                  <li>
                    <strong className="text-foreground">Bekijk de drukgauge</strong> \u2014 de regeldruk toont hoe zwaar het regellandschap weegt.
                  </li>
                  <li>
                    <strong className="text-foreground">Conflicten</strong> worden automatisch gedetecteerd en getoond.
                  </li>
                </ol>
                <Button asChild variant="secondary" size="sm" className="mt-2">
                  <Link href="/olympia">
                    Naar OLYMPIA <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/30 border-border/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">De volledige stroom</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-2 py-4">
                {[
                  { step: "Scope defini\u00ebren", desc: "Categorie\u00ebn, trefwoorden, regels", color: "text-primary" },
                  { step: "Invoer typen", desc: "Vrije tekst of trefwoord", color: "text-foreground" },
                  { step: "TaoGate classificeert", desc: "Trefwoord \u2192 categorie \u2192 gate-beslissing", color: "text-blue-400" },
                  { step: "Olympia lost op", desc: "Domein \u2192 regels \u2192 winnende regel", color: "text-purple-400" },
                  { step: "Resultaat", desc: "Classificatie + jurisdictie + escalatie", color: "text-green-400" },
                  { step: "Mens beslist", desc: "De AI observeert, de mens autoriseert", color: "text-amber-400" },
                ].map((s, i, arr) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-background/30 border border-border/30 w-full max-w-md">
                      <span className="text-xs font-mono text-muted-foreground/40 w-4">{i + 1}</span>
                      <div>
                        <p className={`text-sm font-bold ${s.color}`}>{s.step}</p>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && <ArrowDown className="w-4 h-4 text-muted-foreground/30 my-1" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {activeSection === "voorbeelden" && (
        <div className="space-y-8">

          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Invoervoorbeelden</h2>
            <p className="text-sm text-muted-foreground">
              Concrete voorbeelden van invoer, de classificatie, en de consequenties. Deze voorbeelden zijn gebaseerd op de meegeleverde EU AI Act scope (LEYEN). Bij een andere scope zullen de resultaten anders zijn \u2014 alles hangt af van welke categorie\u00ebn, trefwoorden en regels u definieert.
            </p>
          </div>

          <Card className="bg-primary/5 border-primary/10">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Hoe te lezen:</strong> Elk voorbeeld toont (1) wat u invoert, (2) wat TaoGate ervan maakt, (3) wat Olympia erover zegt, en (4) een uitleg waarom. De stappenvolgorde toont exact wat er in het systeem gebeurt.
              </p>
            </CardContent>
          </Card>

          {VOORBEELDEN.map((v, idx) => (
            <Card key={idx} className="bg-card/30 border-border/30 overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground/40">#{idx + 1}</span>
                    Invoer: <span className="font-mono text-primary">"{v.input}"</span>
                  </CardTitle>
                  <GateDecisionBadge status={v.taogate.status} />
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-xs font-mono text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> TaoGate
                    </p>
                    <div className="space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        <span className="text-foreground/60">Categorie:</span>{" "}
                        <span className="text-foreground font-medium">{v.taogate.category}</span>
                      </p>
                      <p className="text-muted-foreground">
                        <span className="text-foreground/60">Beslissing:</span>{" "}
                        <GateDecisionBadge status={v.taogate.status} />
                      </p>
                      {v.taogate.escalation && (
                        <p className="text-muted-foreground">
                          <span className="text-foreground/60">Escalatie:</span>{" "}
                          <span className="text-orange-400 text-xs">{v.taogate.escalation}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                    <p className="text-xs font-mono text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Scale className="w-3 h-3" /> Olympia
                    </p>
                    {v.olympia.rule ? (
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          <span className="text-foreground/60">Regel:</span>{" "}
                          <span className="text-foreground font-mono text-xs">{v.olympia.rule}</span>
                        </p>
                        <p className="text-muted-foreground">
                          <span className="text-foreground/60">Laag:</span>{" "}
                          <span className={JURISDICTION_LAYERS.find(l => l.layer === v.olympia.layer)?.color || "text-foreground"}>
                            {JURISDICTION_LAYERS.find(l => l.layer === v.olympia.layer)?.label || v.olympia.layer}
                          </span>
                        </p>
                        <p className="text-muted-foreground">
                          <span className="text-foreground/60">Actie:</span>{" "}
                          <GateDecisionBadge status={v.olympia.action!} />
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground/60 italic">Geen regel gevonden voor dit domein.</p>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-background/30 border border-border/20">
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.explanation}</p>
                </div>

                <div className="p-3 rounded-lg bg-card/50 border border-border/20">
                  <p className="text-xs font-mono text-muted-foreground/40 uppercase tracking-wider mb-2">Stappenvolgorde</p>
                  <div className="space-y-1">
                    {v.flow.map((step, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="font-mono text-muted-foreground/30 mt-0.5 w-3 text-right shrink-0">{i + 1}</span>
                        <span className="font-mono text-muted-foreground">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </CardContent>
            </Card>
          ))}

          <Card className="bg-amber-500/5 border-amber-500/10">
            <CardContent className="pt-5 pb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-400 mb-1">Belangrijk: het spanningsveld</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  TaoGate en Olympia kunnen tot <strong className="text-foreground">verschillende conclusies</strong> komen. Dat is geen fout \u2014 het is het ontwerp. De TaoGate classificeert op basis van trefwoorden (snelheid). Olympia weegt juridische lagen (diepte). Het spanningsveld tussen die twee dwingt bewustzijn af. Hoe dieper u kijkt, hoe scherper het inzicht.
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2 font-mono italic">
                  TaoGate classificeert \u2192 Olympia verdeelt kracht \u2192 De mens autoriseert.
                </p>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      <div className="pt-4 border-t border-border/40 flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Link href="/lexicon">
            <BookOpen className="w-4 h-4" /> Lexicon
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Link href="/readme">
            <FileText className="w-4 h-4" /> Download PDF
          </Link>
        </Button>
      </div>

    </div>
  );
}
