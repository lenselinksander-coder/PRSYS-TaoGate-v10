import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Lock, ExternalLink, AlertTriangle, CheckCircle, XCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";

type ViewStep = "query" | "research" | "draft" | "locked";

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

export default function IngestPage() {
  const [step, setStep] = useState<ViewStep>("query");
  const [query, setQuery] = useState("");
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [draft, setDraft] = useState<DraftScope | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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
      toast({ title: "Onderzoek mislukt", description: err.message, variant: "destructive" });
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

      <div className="flex items-center gap-2 text-xs font-mono">
        {(["query", "research", "draft", "locked"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground/40">→</span>}
            <span className={step === s ? "text-primary font-bold" : step > s ? "text-green-400" : "text-muted-foreground/40"}>
              {s === "query" && "1. ONDERZOEK"}
              {s === "research" && "2. RESULTATEN"}
              {s === "draft" && "3. DRAFT"}
              {s === "locked" && "4. LOCKED"}
            </span>
          </div>
        ))}
      </div>

      {step === "query" && (
        <Card className="border-primary/20 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-mono flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
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
