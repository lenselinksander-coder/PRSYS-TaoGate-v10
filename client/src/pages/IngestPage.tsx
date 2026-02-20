import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Lock, ExternalLink, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp, Plus, Trash2, PenLine, Zap, Settings2 } from "lucide-react";

type ViewStep = "query" | "research" | "draft" | "locked";
type IngestMode = "auto" | "manual";

interface ResearchResult {
  content: string;
  citations: string[];
  model: string;
}

interface PreflightResult {
  canLock: boolean;
  issues: string[];
  warnings: string[];
  stats: {
    totalRules: number;
    rulesWithSource: number;
    rulesWithoutSource: number;
    totalCategories: number;
    gaps: number;
  };
}

interface DraftScope {
  id: string;
  name: string;
  description: string;
  status: string;
  categories: any[];
  rules: any[];
  ingestMeta: {
    query: string;
    citations: string[];
    researchedAt: string;
    model: string;
    gaps?: string[];
  };
}

interface ManualRule {
  ruleId: string;
  layer: "EU" | "NATIONAL" | "REGIONAL" | "MUNICIPAL";
  domain: string;
  title: string;
  description: string;
  action: "PASS" | "PASS_WITH_TRANSPARENCY" | "ESCALATE_HUMAN" | "ESCALATE_REGULATORY" | "BLOCK";
  overridesLowerLayers: boolean;
  source: string;
  sourceUrl: string;
  article: string;
  citation: string;
  qTriad?: "Mens×Mens" | "Mens×Systeem" | "Systeem×Systeem";
}

interface ManualCategory {
  name: string;
  label: string;
  status: "PASS" | "PASS_WITH_TRANSPARENCY" | "ESCALATE_HUMAN" | "ESCALATE_REGULATORY" | "BLOCK";
  escalation: string | null;
  keywords: string[];
}

const actionColors: Record<string, string> = {
  BLOCK: "bg-red-500/20 text-red-300 border-red-500/30",
  ESCALATE_REGULATORY: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  ESCALATE_HUMAN: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  PASS_WITH_TRANSPARENCY: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  PASS: "bg-green-500/20 text-green-300 border-green-500/30",
};

const layerColors: Record<string, string> = {
  EU: "bg-purple-500/20 text-purple-300",
  NATIONAL: "bg-blue-500/20 text-blue-300",
  REGIONAL: "bg-cyan-500/20 text-cyan-300",
  MUNICIPAL: "bg-teal-500/20 text-teal-300",
};

const actionOptions = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"] as const;
const actionLabels: Record<string, string> = {
  PASS: "Doorlaten",
  PASS_WITH_TRANSPARENCY: "Doorlaten + log",
  ESCALATE_HUMAN: "Escalatie arts",
  ESCALATE_REGULATORY: "Escalatie toezicht",
  BLOCK: "Blokkeren",
};
const layerOptions = ["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"] as const;
const qTriadOptions = ["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"] as const;

function emptyRule(): ManualRule {
  return {
    ruleId: `R-${Date.now().toString(36).toUpperCase()}`,
    layer: "NATIONAL",
    domain: "",
    title: "",
    description: "",
    action: "PASS",
    overridesLowerLayers: false,
    source: "",
    sourceUrl: "",
    article: "",
    citation: "",
  };
}

function emptyCategory(): ManualCategory {
  return {
    name: "",
    label: "",
    status: "PASS",
    escalation: null,
    keywords: [],
  };
}

function templateAMC(): { name: string; description: string; rules: ManualRule[]; categories: ManualCategory[] } {
  const ts = () => `R-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return {
    name: "Academisch Medisch Centrum",
    description: "Governance scope voor academische ziekenhuiszorg — klinisch, onderwijs, onderzoek",
    rules: [
      { ruleId: ts(), layer: "EU", domain: "AI", title: "AI Act — Hoog-risico classificatie medische AI", description: "", action: "BLOCK", overridesLowerLayers: true, source: "EU AI Act", sourceUrl: "", article: "Art. 6 + Annex III", citation: "", qTriad: "Mens×Systeem" },
      { ruleId: ts(), layer: "EU", domain: "Privacy", title: "AVG — Bijzondere persoonsgegevens (gezondheid)", description: "", action: "ESCALATE_REGULATORY", overridesLowerLayers: true, source: "AVG/GDPR", sourceUrl: "", article: "Art. 9", citation: "", qTriad: "Mens×Systeem" },
      { ruleId: ts(), layer: "NATIONAL", domain: "Zorg", title: "Wgbo — Informed consent behandeling", description: "", action: "BLOCK", overridesLowerLayers: false, source: "Wet geneeskundige behandelingsovereenkomst", sourceUrl: "", article: "Art. 7:448 BW", citation: "", qTriad: "Mens×Mens" },
      { ruleId: ts(), layer: "NATIONAL", domain: "Kwaliteit", title: "Wkkgz — Melden van calamiteiten", description: "", action: "ESCALATE_REGULATORY", overridesLowerLayers: false, source: "Wet kwaliteit klachten geschillen zorg", sourceUrl: "", article: "Art. 11", citation: "", qTriad: "Mens×Systeem" },
      { ruleId: ts(), layer: "NATIONAL", domain: "Geneesmiddelen", title: "Opiumwet — Registratie verdovende middelen", description: "", action: "BLOCK", overridesLowerLayers: false, source: "Opiumwet", sourceUrl: "", article: "Art. 3-4", citation: "", qTriad: "Systeem×Systeem" },
      { ruleId: ts(), layer: "REGIONAL", domain: "IC", title: "NVIC — IC-opname criteria", description: "", action: "ESCALATE_HUMAN", overridesLowerLayers: false, source: "NVIC Richtlijn", sourceUrl: "", article: "", citation: "", qTriad: "Mens×Mens" },
    ],
    categories: [
      { name: "HOOG_RISICO_AI", label: "Hoog Risico AI", status: "BLOCK", escalation: "AI Governance Board", keywords: ["AI", "machine learning", "algoritme", "predictief", "decision support"] },
      { name: "PATIENT_VEILIGHEID", label: "Patiëntveiligheid", status: "ESCALATE_HUMAN", escalation: "Medisch Manager", keywords: ["incident", "calamiteit", "valgevaar", "medicatiefout", "sepsis"] },
      { name: "PRIVACY_GEZONDHEID", label: "Privacy Gezondheidsgegevens", status: "ESCALATE_REGULATORY", escalation: "DPO / FG", keywords: ["BSN", "dossier", "lab", "diagnose", "genetisch"] },
      { name: "MEDICATIE", label: "Medicatie & Verdovende Middelen", status: "BLOCK", escalation: "Ziekenhuisapotheker", keywords: ["opium", "morfine", "opiaat", "narcose", "verdovend"] },
      { name: "IC_PROTOCOL", label: "IC Protocol", status: "PASS_WITH_TRANSPARENCY", escalation: "Intensivist", keywords: ["IC", "beademing", "sedatie", "hemodynamiek", "monitor"] },
      { name: "ONDERWIJS_ONDERZOEK", label: "Onderwijs & Onderzoek", status: "PASS", escalation: null, keywords: ["METC", "proefpersoon", "studie", "coschap", "opleiding"] },
    ],
  };
}

export default function IngestPage() {
  const [mode, setMode] = useState<IngestMode>("manual");
  const [step, setStep] = useState<ViewStep>("query");
  const [query, setQuery] = useState("");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [draft, setDraft] = useState<DraftScope | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualRules, setManualRules] = useState<ManualRule[]>([emptyRule()]);
  const [manualCategories, setManualCategories] = useState<ManualCategory[]>([emptyCategory()]);
  const [manualSourceText, setManualSourceText] = useState("");
  const [manualSourceUrls, setManualSourceUrls] = useState("");
  const [keywordInput, setKeywordInput] = useState<Record<number, string>>({});
  const [expandedManualRules, setExpandedManualRules] = useState<Set<number>>(new Set());
  const [expandedManualCats, setExpandedManualCats] = useState<Set<number>>(new Set());

  const researchMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/ingest/research", { query: q });
      return res.json() as Promise<ResearchResult>;
    },
    onSuccess: (data) => {
      setResearch(data);
      setStep("research");
    },
    onError: (err: any) => {
      const msg = err.message || "";
      if (msg.includes("401") || msg.includes("Authorization") || msg.includes("Cloudflare")) {
        toast({
          title: "Perplexity API geblokkeerd",
          description: "Cloudflare blokkeert verzoeken vanuit deze omgeving. Gebruik de handmatige modus om een scope aan te maken.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Onderzoek mislukt", description: msg, variant: "destructive" });
      }
    },
  });

  const draftMutation = useMutation({
    mutationFn: async () => {
      if (!research) throw new Error("Geen onderzoeksdata");
      const res = await apiRequest("POST", "/api/ingest/draft", {
        query,
        content: research.content,
        citations: research.citations,
      });
      return res.json() as Promise<DraftScope>;
    },
    onSuccess: (data) => {
      setDraft(data);
      setStep("draft");
      runPreflight(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Draft aanmaken mislukt", description: err.message, variant: "destructive" });
    },
  });

  const manualDraftMutation = useMutation({
    mutationFn: async () => {
      const urls = manualSourceUrls.split("\n").map(u => u.trim()).filter(Boolean);
      const res = await apiRequest("POST", "/api/ingest/manual-draft", {
        name: manualName,
        description: manualDescription,
        rules: manualRules.filter(r => r.title.trim()),
        categories: manualCategories.filter(c => c.name.trim()),
        sourceText: manualSourceText,
        sourceUrls: urls,
      });
      return res.json() as Promise<DraftScope>;
    },
    onSuccess: (data) => {
      setDraft(data);
      setStep("draft");
      runPreflight(data.id);
    },
    onError: (err: any) => {
      toast({ title: "Draft aanmaken mislukt", description: err.message, variant: "destructive" });
    },
  });

  const preflightMutation = useMutation({
    mutationFn: async (scopeId: string) => {
      const res = await apiRequest("POST", `/api/scopes/${scopeId}/preflight`);
      return res.json() as Promise<PreflightResult>;
    },
    onSuccess: (data) => {
      setPreflight(data);
    },
  });

  const lockMutation = useMutation({
    mutationFn: async (scopeId: string) => {
      const res = await apiRequest("POST", `/api/scopes/${scopeId}/lock`);
      return res.json();
    },
    onSuccess: () => {
      setStep("locked");
      queryClient.invalidateQueries({ queryKey: ["/api/scopes"] });
      toast({ title: "Scope LOCKED", description: "Scope is vergrendeld en klaar voor ARGOS/OLYMPIA." });
    },
    onError: (err: any) => {
      toast({ title: "Lock mislukt", description: err.message, variant: "destructive" });
    },
  });

  function runPreflight(scopeId: string) {
    preflightMutation.mutate(scopeId);
  }

  function toggleRule(ruleId: string) {
    setExpandedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  }

  function resetAll() {
    setStep("query");
    setQuery("");
    setResearch(null);
    setDraft(null);
    setPreflight(null);
    setExpandedRules(new Set());
    setManualName("");
    setManualDescription("");
    setManualRules([emptyRule()]);
    setManualCategories([emptyCategory()]);
    setManualSourceText("");
    setManualSourceUrls("");
  }

  function updateRule(index: number, updates: Partial<ManualRule>) {
    setManualRules(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  }

  function removeRule(index: number) {
    setManualRules(prev => prev.filter((_, i) => i !== index));
  }

  function updateCategory(index: number, updates: Partial<ManualCategory>) {
    setManualCategories(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }

  function removeCategory(index: number) {
    setManualCategories(prev => prev.filter((_, i) => i !== index));
  }

  function addKeyword(catIndex: number) {
    const kw = (keywordInput[catIndex] || "").trim();
    if (!kw) return;
    setManualCategories(prev => prev.map((c, i) =>
      i === catIndex ? { ...c, keywords: [...c.keywords, kw] } : c
    ));
    setKeywordInput(prev => ({ ...prev, [catIndex]: "" }));
  }

  function removeKeyword(catIndex: number, kwIndex: number) {
    setManualCategories(prev => prev.map((c, i) =>
      i === catIndex ? { ...c, keywords: c.keywords.filter((_, j) => j !== kwIndex) } : c
    ));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold tracking-tight flex items-center gap-3">
          <Search className="w-7 h-7 text-primary" />
          INGEST <span className="text-muted-foreground font-normal">| Bronnenmotor</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          Zonder bron geen verhaal. Zonder verhaal geen data. Geen data geen sets.
        </p>
      </div>

      {step === "query" && (
        <div className="flex gap-2 font-mono text-xs">
          <button
            data-testid="button-mode-auto"
            onClick={() => setMode("auto")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
              mode === "auto"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap className="w-3 h-3" />
            Automatisch
          </button>
          <button
            data-testid="button-mode-manual"
            onClick={() => setMode("manual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
              mode === "manual"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            <PenLine className="w-3 h-3" />
            Handmatig
          </button>
        </div>
      )}

      {step !== "query" && (
        <div className="flex items-center gap-2 text-xs font-mono">
          {(["query", "research", "draft", "locked"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground/40">→</span>}
              <span className={step === s ? "text-primary font-bold" : "text-muted-foreground/40"}>
                {s === "query" && "1. INVOER"}
                {s === "research" && "2. RESULTATEN"}
                {s === "draft" && "3. DRAFT"}
                {s === "locked" && "4. LOCKED"}
              </span>
            </div>
          ))}
        </div>
      )}

      {step === "query" && mode === "auto" && (
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Onderzoeksvraag
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              data-testid="input-research-query"
              placeholder="Bijv: 'Welke regelgeving geldt voor AI-triage op de SEH?' of 'EU AI Act classificatie voor predictieve modellen in de zorg'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={4}
              className="font-mono text-sm bg-background/50"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Perplexity doorzoekt actuele bronnen en levert verifieerbare citaten.
              </p>
              <Button
                data-testid="button-research"
                onClick={() => researchMutation.mutate(query)}
                disabled={!query.trim() || researchMutation.isPending}
                className="font-mono"
              >
                {researchMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Onderzoeken...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Onderzoek starten
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "query" && mode === "manual" && (
        <div className="space-y-4">
          {!manualName.trim() && (
            <Card className="border-dashed border-primary/30 bg-primary/5 backdrop-blur">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono text-foreground">Snel starten?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Laad een voorgevulde template met relevante regels en categorieën.</p>
                  </div>
                  <Button
                    data-testid="button-template-amc"
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs border-primary/40 hover:bg-primary/10"
                    onClick={() => {
                      const t = templateAMC();
                      setManualName(t.name);
                      setManualDescription(t.description);
                      setManualRules(t.rules);
                      setManualCategories(t.categories);
                    }}
                  >
                    <FileText className="w-3 h-3 mr-1.5" />
                    Academisch Medisch Centrum
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-mono flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" />
                Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Input
                    data-testid="input-manual-name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Naam *"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    data-testid="input-manual-description"
                    value={manualDescription}
                    onChange={(e) => setManualDescription(e.target.value)}
                    placeholder="Beschrijving (optioneel)"
                    className="font-mono text-sm bg-background/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-mono flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Regels ({manualRules.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManualRules(prev => [...prev, emptyRule()])}
                  className="font-mono text-xs"
                  data-testid="button-add-rule"
                >
                  <Plus className="w-3 h-3 mr-1" /> Regel
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualRules.map((rule, idx) => {
                const isExpanded = expandedManualRules.has(idx);
                return (
                  <div key={idx} className="border border-border/30 rounded-lg p-3 bg-background/30 space-y-2" data-testid={`manual-rule-${idx}`}>
                    <div className="flex items-center gap-2">
                      <Input
                        value={rule.title}
                        onChange={(e) => updateRule(idx, { title: e.target.value })}
                        placeholder="Titel van de regel"
                        className="font-mono text-sm bg-background/50 flex-1"
                      />
                      <select
                        value={rule.action}
                        onChange={(e) => updateRule(idx, { action: e.target.value as any })}
                        className="text-xs font-mono bg-background/50 border border-border/30 rounded px-2 py-1.5"
                      >
                        {actionOptions.map(a => <option key={a} value={a}>{actionLabels[a]}</option>)}
                      </select>
                      <select
                        value={rule.layer}
                        onChange={(e) => updateRule(idx, { layer: e.target.value as any })}
                        className="text-xs font-mono bg-background/50 border border-border/30 rounded px-2 py-1.5 w-28"
                      >
                        {layerOptions.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <Button size="icon" variant="ghost" onClick={() => removeRule(idx)} className="h-8 w-8 text-red-400 hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={rule.source}
                        onChange={(e) => updateRule(idx, { source: e.target.value })}
                        placeholder="Bron (wet/richtlijn)"
                        className="font-mono text-xs bg-background/50 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedManualRules(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          return next;
                        })}
                        className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                      >
                        <Settings2 className="w-3 h-3" />
                        {isExpanded ? "minder" : "meer"}
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="space-y-2 pt-1 border-t border-border/20">
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={rule.domain}
                            onChange={(e) => updateRule(idx, { domain: e.target.value })}
                            placeholder="Domein (bijv. AI, Privacy)"
                            className="font-mono text-xs bg-background/50"
                          />
                          <select
                            value={rule.qTriad || ""}
                            onChange={(e) => updateRule(idx, { qTriad: (e.target.value || undefined) as any })}
                            className="text-xs font-mono bg-background/50 border border-border/30 rounded px-2 py-1.5"
                          >
                            <option value="">Q-Triad...</option>
                            {qTriadOptions.map(q => <option key={q} value={q}>{q}</option>)}
                          </select>
                        </div>
                        <Textarea
                          value={rule.description}
                          onChange={(e) => updateRule(idx, { description: e.target.value })}
                          placeholder="Toelichting (optioneel)"
                          rows={2}
                          className="font-mono text-xs bg-background/50"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <Input
                            value={rule.sourceUrl}
                            onChange={(e) => updateRule(idx, { sourceUrl: e.target.value })}
                            placeholder="URL naar bron"
                            className="font-mono text-xs bg-background/50"
                          />
                          <Input
                            value={rule.article}
                            onChange={(e) => updateRule(idx, { article: e.target.value })}
                            placeholder="Artikel"
                            className="font-mono text-xs bg-background/50"
                          />
                          <Input
                            value={rule.citation}
                            onChange={(e) => updateRule(idx, { citation: e.target.value })}
                            placeholder="Citaat"
                            className="font-mono text-xs bg-background/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-mono flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Categorieën ({manualCategories.length})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setManualCategories(prev => [...prev, emptyCategory()])}
                  className="font-mono text-xs"
                  data-testid="button-add-category"
                >
                  <Plus className="w-3 h-3 mr-1" /> Categorie
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualCategories.map((cat, idx) => {
                const isCatExpanded = expandedManualCats.has(idx);
                return (
                  <div key={idx} className="border border-border/30 rounded-lg p-3 bg-background/30 space-y-2" data-testid={`manual-category-${idx}`}>
                    <div className="flex items-center gap-2">
                      <Input
                        value={cat.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          const name = label.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
                          updateCategory(idx, { label, name });
                        }}
                        placeholder="Naam (bijv. Hoog Risico AI)"
                        className="font-mono text-sm bg-background/50 flex-1"
                      />
                      <select
                        value={cat.status}
                        onChange={(e) => updateCategory(idx, { status: e.target.value as any })}
                        className="text-xs font-mono bg-background/50 border border-border/30 rounded px-2 py-1.5"
                      >
                        {actionOptions.map(a => <option key={a} value={a}>{actionLabels[a]}</option>)}
                      </select>
                      <Button size="icon" variant="ghost" onClick={() => removeCategory(idx)} className="h-8 w-8 text-red-400 hover:text-red-300">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 flex-wrap">
                        {cat.keywords.map((kw, j) => (
                          <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground flex items-center gap-1">
                            {kw}
                            <button onClick={() => removeKeyword(idx, j)} className="text-red-400 hover:text-red-300">×</button>
                          </span>
                        ))}
                        <Input
                          value={keywordInput[idx] || ""}
                          onChange={(e) => setKeywordInput(prev => ({ ...prev, [idx]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(idx); } }}
                          placeholder="Trefwoord + Enter"
                          className="font-mono text-xs bg-background/50 w-32 h-6"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedManualCats(prev => {
                          const next = new Set(prev);
                          if (next.has(idx)) next.delete(idx); else next.add(idx);
                          return next;
                        })}
                        className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                      >
                        <Settings2 className="w-3 h-3" />
                        {isCatExpanded ? "minder" : "meer"}
                      </button>
                    </div>
                    {isCatExpanded && (
                      <div className="pt-1 border-t border-border/20">
                        <Input
                          value={cat.escalation || ""}
                          onChange={(e) => updateCategory(idx, { escalation: e.target.value || null })}
                          placeholder="Escalatiedoel (bijv. DPO, AI Office)"
                          className="font-mono text-xs bg-background/50"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <details className="group">
            <summary className="flex items-center gap-2 text-xs font-mono text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-2">
              <ExternalLink className="w-3 h-3" />
              Brontekst & URLs (optioneel)
              <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
            </summary>
            <Card className="border-cyan-500/20 bg-card/50 backdrop-blur mt-2">
              <CardContent className="space-y-3 pt-4">
                <Textarea
                  data-testid="input-manual-sourcetext"
                  value={manualSourceText}
                  onChange={(e) => setManualSourceText(e.target.value)}
                  placeholder="Plak hier brontekst, beleidsdocumenten, rapporten..."
                  rows={3}
                  className="font-mono text-xs bg-background/50"
                />
                <Textarea
                  data-testid="input-manual-sourceurls"
                  value={manualSourceUrls}
                  onChange={(e) => setManualSourceUrls(e.target.value)}
                  placeholder="URLs naar bronnen (één per regel)"
                  rows={2}
                  className="font-mono text-xs bg-background/50"
                />
              </CardContent>
            </Card>
          </details>

          <div className="flex items-center justify-between border-t border-border/20 pt-4">
            <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
              <span>{manualRules.length} regels</span>
              <span className="text-border/40">|</span>
              <span>{manualCategories.length} categorieën</span>
              {manualRules.filter(r => r.source).length > 0 && (
                <>
                  <span className="text-border/40">|</span>
                  <span className="text-green-400">{manualRules.filter(r => r.source).length} bronnen</span>
                </>
              )}
              {manualRules.filter(r => !r.source).length > 0 && (
                <>
                  <span className="text-border/40">|</span>
                  <span className="text-yellow-400">{manualRules.filter(r => !r.source).length} zonder bron</span>
                </>
              )}
            </div>
            <Button
              data-testid="button-manual-draft"
              onClick={() => manualDraftMutation.mutate()}
              disabled={!manualName.trim() || manualDraftMutation.isPending}
              className="font-mono"
            >
              {manualDraftMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Draft aanmaken...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Draft Scope
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "research" && research && (
        <div className="space-y-4">
          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-mono flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Onderzoeksresultaten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose prose-invert prose-sm max-w-none font-mono text-sm whitespace-pre-wrap bg-background/30 p-4 rounded-lg border border-border/30 max-h-96 overflow-y-auto">
                {research.content}
              </div>
            </CardContent>
          </Card>

          {research.citations.length > 0 && (
            <Card className="border-cyan-500/20 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base font-mono flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  Bronnen ({research.citations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {research.citations.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`link-citation-${i}`}
                      className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors py-1"
                    >
                      <span className="text-muted-foreground">[{i + 1}]</span>
                      <span className="truncate">{url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setStep("query")} className="font-mono" data-testid="button-back-query">
              Terug
            </Button>
            <Button
              data-testid="button-create-draft"
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending}
              className="font-mono"
            >
              {draftMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Scope draft genereren...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Genereer Scope Draft
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "draft" && draft && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-300 border-yellow-500/30 font-mono">
              DRAFT
            </Badge>
            <h2 className="text-lg font-mono font-bold" data-testid="text-draft-name">{draft.name}</h2>
          </div>

          {draft.description && (
            <p className="text-sm text-muted-foreground font-mono">{draft.description}</p>
          )}

          {preflight && (
            <Card className={`border ${preflight.canLock ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"} backdrop-blur`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  {preflight.canLock ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                  Preflight: {preflight.canLock ? "PASS — klaar om te locken" : "FAIL — los issues op"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                  <span>Regels: {preflight.stats.totalRules}</span>
                  <span>Met bron: {preflight.stats.rulesWithSource}</span>
                  <span>Zonder bron: {preflight.stats.rulesWithoutSource}</span>
                  <span>Categorieën: {preflight.stats.totalCategories}</span>
                  <span>Gaps: {preflight.stats.gaps}</span>
                </div>
                {preflight.issues.length > 0 && (
                  <div className="space-y-1">
                    {preflight.issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-red-300">
                        <XCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
                {preflight.warnings.length > 0 && (
                  <div className="space-y-1">
                    {preflight.warnings.map((warn, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-mono text-yellow-300">
                        <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        {warn}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-mono">Regels ({draft.rules?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(draft.rules || []).map((rule: any) => (
                <div
                  key={rule.ruleId}
                  data-testid={`card-rule-${rule.ruleId}`}
                  className="border border-border/30 rounded-lg p-3 bg-background/30 space-y-2"
                >
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => toggleRule(rule.ruleId)}
                  >
                    <Badge className={`${actionColors[rule.action] || ""} text-xs font-mono`}>
                      {rule.action}
                    </Badge>
                    <Badge className={`${layerColors[rule.layer] || ""} text-xs font-mono`}>
                      {rule.layer}
                    </Badge>
                    {rule.qTriad && (
                      <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                        {rule.qTriad}
                      </Badge>
                    )}
                    <span className="text-sm font-mono font-medium flex-1">{rule.title}</span>
                    {expandedRules.has(rule.ruleId) ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {expandedRules.has(rule.ruleId) && (
                    <div className="pl-2 space-y-1 text-xs font-mono text-muted-foreground border-l-2 border-primary/20 ml-1">
                      <p>{rule.description}</p>
                      {rule.source && (
                        <p className="text-cyan-400">
                          Bron: {rule.source}
                          {rule.article && <span> — {rule.article}</span>}
                        </p>
                      )}
                      {rule.sourceUrl && (
                        <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          {rule.sourceUrl}
                        </a>
                      )}
                      {rule.citation && (
                        <p className="italic text-muted-foreground/70 border-l border-muted-foreground/20 pl-2">
                          "{rule.citation}"
                        </p>
                      )}
                      <p className="text-muted-foreground/50">ID: {rule.ruleId} | Domein: {rule.domain}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base font-mono">Categorieën ({draft.categories?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(draft.categories || []).map((cat: any, i: number) => (
                  <div key={i} data-testid={`card-category-${cat.name}`} className="border border-border/30 rounded-lg p-3 bg-background/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${actionColors[cat.status] || ""} text-xs font-mono`}>
                        {cat.status}
                      </Badge>
                      <span className="text-sm font-mono font-medium">{cat.label || cat.name}</span>
                    </div>
                    {cat.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cat.keywords.map((kw: string, j: number) => (
                          <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {cat.escalation && (
                      <p className="text-[10px] font-mono text-yellow-400 mt-1">→ {cat.escalation}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {draft.ingestMeta?.citations && draft.ingestMeta.citations.length > 0 && (
            <Card className="border-cyan-500/20 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                  Provenance — {draft.ingestMeta.citations.length} bronnen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {draft.ingestMeta.citations.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 py-0.5">
                      <span className="text-muted-foreground">[{i + 1}]</span>
                      <span className="truncate">{url}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {draft.ingestMeta?.gaps && draft.ingestMeta.gaps.length > 0 && (
            <Card className="border-yellow-500/20 bg-card/50 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-sm font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  Gaps — ontbrekende informatie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {draft.ingestMeta.gaps.map((gap: string, i: number) => (
                    <p key={i} className="text-xs font-mono text-yellow-300">• {gap}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={resetAll} className="font-mono" data-testid="button-reset">
              Opnieuw
            </Button>
            <Button
              data-testid="button-lock-scope"
              onClick={() => draft && lockMutation.mutate(draft.id)}
              disabled={lockMutation.isPending || (preflight !== null && !preflight.canLock)}
              className="font-mono bg-green-600 hover:bg-green-700"
            >
              {lockMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  LOCK Scope
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {step === "locked" && (
        <Card className="border-green-500/30 bg-green-500/5 backdrop-blur">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
            <h2 className="text-xl font-mono font-bold text-green-300">Scope LOCKED</h2>
            <p className="text-sm font-mono text-muted-foreground">
              De scope is vergrendeld met {draft?.rules?.length || 0} regels en {draft?.categories?.length || 0} categorieën.
              <br />
              Alle regels zijn verankerd in verifieerbare bronnen.
            </p>
            <p className="text-xs font-mono text-muted-foreground/60">
              De scope is nu beschikbaar in ARGOS en OLYMPIA.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={resetAll} className="font-mono" data-testid="button-new-research">
                Nieuw onderzoek
              </Button>
              <Button
                variant="outline"
                className="font-mono"
                onClick={() => window.location.href = "/scopes"}
                data-testid="button-go-scopes"
              >
                Naar Scopes
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
