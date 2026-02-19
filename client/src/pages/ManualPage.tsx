import { FileText, Eye, Activity, Shield, Info, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function ManualPage() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <div className="p-2 bg-primary/20 text-primary rounded-lg">
            <Info className="w-6 h-6" />
          </div>
          ORFHEUSS | Field Manual
        </h1>
        <p className="text-muted-foreground mt-1 font-mono text-sm">
          Operating Protocols for Mechanical Governance
        </p>
      </div>

      {/* Introduction */}
      <Card className="bg-card/50 backdrop-blur-md border-primary/20">
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed text-foreground/90">
            Welkom in de <strong>ORFHEUSS Console</strong>. Dit systeem is geen traditioneel management dashboard. 
            Het is een <em>fysisch instrument</em> om organisatorische druk en beweging te meten en te begrenzen.
          </p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-background/50 border border-border/50">
              <h3 className="font-bold flex items-center gap-2 mb-2 text-primary">
                <Eye className="w-4 h-4" />
                ARGOS (TaoGate)
              </h3>
              <p className="text-sm text-muted-foreground">
                De poortwachter. Hier toetst u of input <em>veilig</em> is. 
                Het systeem filtert automatisch tussen <strong>Observatie</strong> (toegestaan) en <strong>Interventie</strong> (geblokkeerd zonder mandaat).
              </p>
            </div>
            <div className="p-4 rounded-md bg-background/50 border border-border/50">
              <h3 className="font-bold flex items-center gap-2 mb-2 text-primary">
                <Activity className="w-4 h-4" />
                OLYMPIA (Decathlon)
              </h3>
              <p className="text-sm text-muted-foreground">
                De monitor. Hier ziet u de <em>kosten</em> van beweging. 
                Elke modus (Sprint, Marathon, etc.) heeft een unieke balans tussen Snelheid (Omega) en Draagkracht (Tau).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Protocol 1: ARGOS */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-primary border-primary/30">PROTOCOL I</Badge>
          <h2 className="text-xl font-bold">Gebruik van ARGOS (TaoGate)</h2>
        </div>
        
        <Card className="bg-card/30 border-border/30">
          <CardHeader>
            <CardTitle className="text-base">Doel: Pre-Governance & Classificatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground marker:text-primary">
              <li>
                <strong className="text-foreground">Navigeer naar ARGOS:</strong> Klik op het oog-icoon in de navigatiebalk.
              </li>
              <li>
                <strong className="text-foreground">Voer een input in:</strong> Typ een zin in het invoerveld of klik op een van de voorbeeld-regels (bijv. "Saturatie daalt").
              </li>
              <li>
                <strong className="text-foreground">Observeer de Gate-Beslissing:</strong>
                <ul className="pl-6 mt-2 space-y-2 list-disc">
                  <li>
                    <span className="text-green-500 font-mono text-xs border border-green-500/30 px-1 rounded">PASS</span> — Dit betekent dat uw input een <strong>Observatie</strong> is. Het beschrijft de werkelijkheid zonder in te grijpen. Dit is veilig en mag door.
                  </li>
                  <li>
                    <span className="text-destructive font-mono text-xs border border-destructive/30 px-1 rounded">BLOCK</span> — Dit betekent dat uw input een <strong>Interventie</strong> of <strong>Commando</strong> is (bijv. "Start medicatie"). Zonder expliciet mandaat wordt dit direct geblokkeerd om <em>Quiet Violence</em> te voorkomen.
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Audit Log:</strong> Elke poging wordt vastgelegd in de log aan de rechterkant. Dit vormt het geheugen van het systeem.
              </li>
            </ol>
            
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-sm text-blue-200/80 flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 text-blue-400" />
              <p>
                <strong>Tip:</strong> Probeer het verschil tussen "Ik zie dat het druk is" (Observatie → PASS) en "Iedereen moet nu harder werken" (Commando → BLOCK).
              </p>
            </div>
            
            <Button asChild variant="secondary" className="mt-2">
              <Link href="/">
                Naar ARGOS Console <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Protocol 2: OLYMPIA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-purple-400 border-purple-400/30">PROTOCOL II</Badge>
          <h2 className="text-xl font-bold">Gebruik van OLYMPIA (Decathlon)</h2>
        </div>
        
        <Card className="bg-card/30 border-border/30">
          <CardHeader>
            <CardTitle className="text-base">Doel: Mechanische Analyse & Belasting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground marker:text-primary">
              <li>
                <strong className="text-foreground">Navigeer naar OLYMPIA:</strong> Klik op het golf-icoon in de navigatiebalk.
              </li>
              <li>
                <strong className="text-foreground">Kies een Discipline:</strong> Selecteer links een modus (bijv. <em>Sprint</em> of <em>Marathon</em>). Dit vertegenwoordigt de huidige staat van uw team of organisatie.
              </li>
              <li>
                <strong className="text-foreground">Lees de Meters:</strong>
                <ul className="pl-6 mt-2 space-y-2 list-disc">
                  <li>
                    <strong>Omega (Snelheid):</strong> Hoeveel besluiten per minuut? (Hoge Omega = Hoge Slijtage).
                  </li>
                  <li>
                    <strong>Tau (Draagkracht):</strong> Hoeveel gewicht kan de structuur dragen? (Bij <em>Sprint</em> zakt dit snel in).
                  </li>
                  <li>
                    <strong>Herstel:</strong> De prijs die betaald moet worden. Een volle balk betekent dat er na deze actie <em>verplicht</em> rust moet volgen.
                  </li>
                </ul>
              </li>
              <li>
                <strong className="text-foreground">Resonance Monitor:</strong> De grafiek toont de stabiliteit. Een grillige lijn betekent instabiliteit (Silent Violence). Een golvende lijn (zoals bij Marathon) betekent duurzaamheid.
              </li>
            </ol>

            <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded text-sm text-purple-200/80 flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 text-purple-400" />
              <p>
                <strong>Inzicht:</strong> Klik eens op <em>Turks Worstelen</em>. U zult zien dat wrijving (grip) wegvalt. Dit is een metafoor voor situaties waarin u geen controle heeft, maar alleen balans kunt zoeken.
              </p>
            </div>
            
            <Button asChild variant="secondary" className="mt-2">
              <Link href="/olympia">
                Naar OLYMPIA Monitor <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Footer / Readme Link */}
      <div className="pt-8 border-t border-border/40 flex justify-center">
        <Button asChild variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5">
          <Link href="/readme">
            <FileText className="w-4 h-4" /> Download Jip & Janneke Handleiding (PDF)
          </Link>
        </Button>
      </div>

    </div>
  );
}
