import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, FileText, Tag, Trash2, Save, ChevronDown, ChevronRight, Edit2, Shield, CheckCircle, BookOpen, ScrollText, Scale, FolderOpen, AlertTriangle, Info, Building2, Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { fetchScopes, createScope, updateScope, deleteScope } from "@/lib/api";
import type { Scope, ScopeCategory, ScopeDocument } from "@shared/schema";

const DECISION_STYLE: Record<string, { color: string; variant: "secondary" | "destructive" | "outline"; icon: "check" | "info" | "alert" | "shield" }> = {
  PASS: { color: "text-green-500", variant: "secondary", icon: "check" },
  PASS_WITH_TRANSPARENCY: { color: "text-blue-400", variant: "outline", icon: "info" },
  ESCALATE_HUMAN: { color: "text-orange-400", variant: "outline", icon: "alert" },
  ESCALATE_REGULATORY: { color: "text-amber-500", variant: "outline", icon: "alert" },
  BLOCK: { color: "text-red-500", variant: "destructive", icon: "shield" },
};

function StatusIcon({ status, className }: { status: string; className?: string }) {
  const style = DECISION_STYLE[status] || DECISION_STYLE["PASS"];
  const cn = `${className || ""} ${style.color}`;
  switch (style.icon) {
    case "check": return <CheckCircle className={cn} />;
    case "info": return <Info className={cn} />;
    case "alert": return <AlertTriangle className={cn} />;
    case "shield": return <Shield className={cn} />;
  }
}

const DOC_TYPE_LABELS: Record<string, { label: string; icon: typeof FileText }> = {
  visiedocument: { label: "Visiedocument", icon: BookOpen },
  mandaat: { label: "Mandaat", icon: Scale },
  huisregel: { label: "Huisregel", icon: ScrollText },
  protocol: { label: "Protocol", icon: FileText },
  overig: { label: "Overig", icon: FolderOpen },
};

const CATEGORY_COLORS = [
  "text-green-400",
  "text-red-400",
  "text-orange-400",
  "text-amber-400",
  "text-blue-400",
  "text-purple-400",
  "text-pink-400",
  "text-teal-400",
];

type Org = { id: string; name: string; slug: string; sector: string; gateProfile: string };

const EMPTY_CATEGORY: ScopeCategory = { name: "", label: "", status: "PASS", escalation: null, keywords: [], color: "" };
const EMPTY_DOC: ScopeDocument = { type: "visiedocument", title: "", content: "" };

function ScopeEditor({ scope, onClose }: { scope?: Scope; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!scope;

  const [name, setName] = useState(scope?.name || "");
  const [description, setDescription] = useState(scope?.description || "");
  const [orgId, setOrgId] = useState(scope?.orgId || "");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [categories, setCategories] = useState<ScopeCategory[]>(scope?.categories || [{ ...EMPTY_CATEGORY, name: "Observation", label: "Observatie", status: "PASS", color: "text-green-400" }]);
  const [documents, setDocuments] = useState<ScopeDocument[]>(scope?.documents || []);
  const [isDefault, setIsDefault] = useState(scope?.isDefault === "true");
  const [expandedCat, setExpandedCat] = useState<number | null>(0);
  const [expandedDoc, setExpandedDoc] = useState<number | null>(null);
  const [keywordInput, setKeywordInput] = useState<Record<number, string>>({});

  useEffect(() => {
    fetch("/api/organizations").then(r => r.json()).then(setOrgs).catch(() => {});
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name,
        description: description || undefined,
        orgId: orgId || null,
        categories,
        documents,
        isDefault: isDefault ? "true" : "false",
      };
      if (isEditing) {
        return updateScope(scope.id, data);
      }
      return createScope(data as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scopes"] });
      onClose();
    },
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!saveMutation.isPending && name.trim()) {
          saveMutation.mutate();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveMutation.isPending, name]);

  const addCategory = () => {
    const colorIndex = categories.length % CATEGORY_COLORS.length;
    setCategories([...categories, { ...EMPTY_CATEGORY, color: CATEGORY_COLORS[colorIndex] }]);
    setExpandedCat(categories.length);
  };

  const updateCategory = (index: number, updates: Partial<ScopeCategory>) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], ...updates };
    if (updates.status === "PASS") {
      updated[index].escalation = null;
    }
    setCategories(updated);
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
    setExpandedCat(null);
  };

  const addKeyword = (catIndex: number) => {
    const kw = (keywordInput[catIndex] || "").trim();
    if (!kw) return;
    const updated = [...categories];
    updated[catIndex] = { ...updated[catIndex], keywords: [...updated[catIndex].keywords, kw] };
    setCategories(updated);
    setKeywordInput({ ...keywordInput, [catIndex]: "" });
  };

  const removeKeyword = (catIndex: number, kwIndex: number) => {
    const updated = [...categories];
    updated[catIndex] = { ...updated[catIndex], keywords: updated[catIndex].keywords.filter((_, i) => i !== kwIndex) };
    setCategories(updated);
  };

  const addDocument = () => {
    setDocuments([...documents, { ...EMPTY_DOC }]);
    setExpandedDoc(documents.length);
  };

  const updateDocument = (index: number, updates: Partial<ScopeDocument>) => {
    const updated = [...documents];
    updated[index] = { ...updated[index], ...updates };
    setDocuments(updated);
  };

  const removeDocument = (index: number) => {
    setDocuments(documents.filter((_, i) => i !== index));
    setExpandedDoc(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold font-mono">{isEditing ? <><span className="text-primary">MC</span> {scope.name} — Bewerken</> : <><span className="text-primary">MC</span> Nieuwe Scope</>}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="button-cancel-scope">Annuleren</Button>
          <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={!name.trim() || saveMutation.isPending}
            data-testid="button-save-scope"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Opslaan..." : "Opslaan"}
            <kbd className="ml-2 text-[10px] font-mono px-1 py-0.5 rounded bg-primary/10 text-primary/60 border border-primary/20">⌘S</kbd>
          </Button>
        </div>
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Scope naam *</label>
              <div className="flex items-center gap-0">
                <span className="inline-flex items-center px-3 h-9 rounded-l-md border border-r-0 border-input bg-muted text-sm font-mono font-bold text-primary">MC</span>
                <Input 
                  data-testid="input-scope-name"
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="bijv. Kliniek, Ziekenhuis, Verpleeghuis, Rechtbank, Gemeente..." 
                  className="font-mono rounded-l-none"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Organisatie</label>
              <select
                data-testid="select-scope-org"
                value={orgId}
                onChange={e => setOrgId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-mono shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— Geen organisatie —</option>
                {orgs.map(o => (
                  <option key={o.id} value={o.id}>{o.name} ({o.sector})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isDefault} 
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded border-primary/30"
              />
              <span className="text-sm text-muted-foreground">Standaard scope</span>
            </label>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5 block">Beschrijving</label>
            <Textarea 
              data-testid="input-scope-description"
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              placeholder="Beschrijf de context en reikwijdte van deze scope..." 
              rows={2}
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Classificatiecategorieën
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addCategory} data-testid="button-add-category">
              <Plus className="w-3 h-3 mr-1" /> Categorie
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center py-4">
              Voeg categorieën toe om de classificatieregels te definiëren.
            </p>
          )}
          {categories.map((cat, i) => (
            <div key={i} className="border border-border/40 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCat(expandedCat === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  {expandedCat === i ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  <StatusIcon status={cat.status} className="w-4 h-4" />
                  <span className="font-mono text-sm font-semibold">{cat.label || cat.name || `Categorie ${i + 1}`}</span>
                  <Badge variant={(DECISION_STYLE[cat.status] || DECISION_STYLE["PASS"]).variant} className="text-[10px]">{cat.status}</Badge>
                  {cat.escalation && <span className="text-[10px] font-mono text-muted-foreground">→ {cat.escalation}</span>}
                  <span className="text-[10px] text-muted-foreground">{cat.keywords.length} trefwoorden</span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); removeCategory(i); }}>
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
              
              <AnimatePresence>
                {expandedCat === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-2 border-t border-border/30 space-y-3 bg-background/30">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Interne naam</label>
                          <Input 
                            value={cat.name} 
                            onChange={e => updateCategory(i, { name: e.target.value })} 
                            placeholder="Observation" 
                            className="font-mono text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Label (NL)</label>
                          <Input 
                            value={cat.label} 
                            onChange={e => updateCategory(i, { label: e.target.value })} 
                            placeholder="Observatie" 
                            className="font-mono text-sm h-8"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Status</label>
                          <select 
                            value={cat.status} 
                            onChange={e => updateCategory(i, { status: e.target.value as any })}
                            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm font-mono"
                          >
                            <option value="PASS">PASS — doorlaten</option>
                            <option value="PASS_WITH_TRANSPARENCY">PASS + TRANSPARANTIE</option>
                            <option value="ESCALATE_HUMAN">ESCALATIE — menselijk mandaat</option>
                            <option value="ESCALATE_REGULATORY">ESCALATIE — toezichthouder</option>
                            <option value="BLOCK">BLOCK — verboden</option>
                          </select>
                        </div>
                      </div>

                      {cat.status !== "PASS" && (
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Escalatie naar</label>
                          <Input 
                            value={cat.escalation || ""} 
                            onChange={e => updateCategory(i, { escalation: e.target.value || null })} 
                            placeholder="bijv. Intensivist, OvD, Afdelingshoofd..." 
                            className="font-mono text-sm h-8"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">
                          Trefwoorden ({cat.keywords.length})
                        </label>
                        <div className="flex gap-2 mb-2">
                          <Input 
                            value={keywordInput[i] || ""} 
                            onChange={e => setKeywordInput({ ...keywordInput, [i]: e.target.value })}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(i); } }}
                            placeholder="Typ trefwoord + Enter..."
                            className="font-mono text-sm h-8"
                          />
                          <Button variant="outline" size="sm" className="h-8" onClick={() => addKeyword(i)}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.keywords.map((kw, ki) => (
                            <Badge 
                              key={ki} 
                              variant="secondary" 
                              className="font-mono text-[10px] cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                              onClick={() => removeKeyword(i, ki)}
                            >
                              {kw} ×
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documenten
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addDocument} data-testid="button-add-document">
              <Plus className="w-3 h-3 mr-1" /> Document
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">Visiedocumenten, mandaten, huisregels, protocollen — de bouwstenen van de scope.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center py-4">
              Nog geen documenten. Voeg visiedocumenten, mandaten of huisregels toe.
            </p>
          )}
          {documents.map((doc, i) => (
            <div key={i} className="border border-border/40 rounded-lg overflow-hidden">
              <div 
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedDoc(expandedDoc === i ? null : i)}
              >
                <div className="flex items-center gap-3">
                  {expandedDoc === i ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  {(() => { const DocIcon = DOC_TYPE_LABELS[doc.type]?.icon || FileText; return <DocIcon className="w-4 h-4 text-primary/70" />; })()}
                  <span className="text-sm font-medium">{doc.title || `Nieuw document`}</span>
                  <Badge variant="outline" className="text-[10px]">{DOC_TYPE_LABELS[doc.type]?.label || doc.type}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); removeDocument(i); }}>
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>

              <AnimatePresence>
                {expandedDoc === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 pt-2 border-t border-border/30 space-y-3 bg-background/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Type</label>
                          <select 
                            value={doc.type} 
                            onChange={e => updateDocument(i, { type: e.target.value as any })}
                            className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm font-mono"
                          >
                            <option value="visiedocument">Visiedocument</option>
                            <option value="mandaat">Mandaat</option>
                            <option value="huisregel">Huisregel</option>
                            <option value="protocol">Protocol</option>
                            <option value="overig">Overig</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Titel</label>
                          <Input 
                            value={doc.title} 
                            onChange={e => updateDocument(i, { title: e.target.value })} 
                            placeholder="bijv. Visie IC 2025, Mandaat Intensivist..." 
                            className="font-mono text-sm h-8"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Inhoud</label>
                        <Textarea 
                          value={doc.content} 
                          onChange={e => updateDocument(i, { content: e.target.value })} 
                          placeholder="Plak hier de inhoud van het document..."
                          rows={6}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ScopeCard({ scope, onEdit, orgName, orgs }: { scope: Scope; onEdit: (scope: Scope) => void; orgName?: string; orgs: Org[] }) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: () => deleteScope(scope.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scopes"] }),
  });

  const linkOrgMutation = useMutation({
    mutationFn: async (newOrgId: string | null) => {
      return updateScope(scope.id, { orgId: newOrgId });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scopes"] }),
  });

  const lockMutation = useMutation({
    mutationFn: async () => {
      const newStatus = scope.status === "LOCKED" ? "DRAFT" : "LOCKED";
      return updateScope(scope.id, { status: newStatus });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scopes"] }),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors" data-testid={`card-scope-${scope.id}`}>
        <CardContent className="pt-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-mono font-bold text-lg"><span className="text-primary">MC</span> {scope.name}</h3>
                <select
                  data-testid={`select-link-org-${scope.id}`}
                  value={scope.orgId || ""}
                  onChange={e => linkOrgMutation.mutate(e.target.value || null)}
                  className="h-6 text-[10px] font-mono rounded border border-border/40 bg-muted/30 px-1.5 max-w-[160px]"
                >
                  <option value="">Geen organisatie</option>
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
                {scope.isDefault === "true" && (
                  <Badge variant="secondary" className="text-[10px]">standaard</Badge>
                )}
              </div>
              {scope.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{scope.description}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className={`h-8 w-8 ${scope.status === "LOCKED" ? "text-green-400 hover:text-yellow-400" : "text-muted-foreground hover:text-green-400"}`}
                onClick={() => lockMutation.mutate()}
                title={scope.status === "LOCKED" ? "Ontgrendelen" : "Vergrendelen"}
                data-testid={`button-lock-scope-${scope.id}`}
              >
                {scope.status === "LOCKED" ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(scope)} data-testid={`button-edit-scope-${scope.id}`}>
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive" 
                onClick={() => { if (confirm("Weet je zeker dat je deze scope wilt verwijderen?")) deleteMutation.mutate(); }}
                data-testid={`button-delete-scope-${scope.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {scope.categories.map((cat, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px] font-mono bg-muted/40 px-2 py-1 rounded">
                <StatusIcon status={cat.status} className="w-3 h-3" />
                <span>{cat.label || cat.name}</span>
                {cat.escalation && <span className="text-muted-foreground">→ {cat.escalation}</span>}
                <span className="text-muted-foreground/50">({cat.keywords.length})</span>
              </div>
            ))}
          </div>

          {scope.documents.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scope.documents.map((doc, i) => {
                const DocIcon = DOC_TYPE_LABELS[doc.type]?.icon || FileText;
                return (
                  <div key={i} className="flex items-center gap-1 text-[10px] font-mono text-primary/60">
                    <DocIcon className="w-3 h-3" />
                    <span>{doc.title}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-[10px] font-mono text-muted-foreground/50">
            <span>{scope.categories.length} categorieën · {scope.documents.length} documenten</span>
            <span>{new Date(scope.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ScopesPage() {
  const [editingScope, setEditingScope] = useState<Scope | null>(null);
  const [creating, setCreating] = useState(false);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [filterOrgId, setFilterOrgId] = useState<string | null>(null);

  const { data: scopeList = [] } = useQuery({
    queryKey: ["scopes"],
    queryFn: fetchScopes,
  });

  useEffect(() => {
    fetch("/api/organizations").then(r => r.json()).then(setOrgs).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const orgIdParam = params.get("orgId");
    if (orgIdParam) setFilterOrgId(orgIdParam);
  }, []);

  const orgMap = Object.fromEntries(orgs.map(o => [o.id, o.name]));
  const filteredScopes = filterOrgId
    ? scopeList.filter(s => s.orgId === filterOrgId)
    : scopeList;

  if (creating || editingScope) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
        <ScopeEditor 
          scope={editingScope || undefined} 
          onClose={() => { setEditingScope(null); setCreating(false); }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 bg-primary/20 text-primary rounded-lg">
              <Layers className="w-6 h-6" />
            </div>
            SCOPES
          </h1>
          <p className="text-xs font-mono text-primary/60 mt-0.5">MC — Management Console per organisatie</p>
          <p className="text-muted-foreground mt-1 font-mono text-sm">Definieer classificatieregels, escalatiepaden en documenten per organisatie</p>
        </div>
        <Button onClick={() => setCreating(true)} data-testid="button-new-scope">
          <Plus className="w-4 h-4 mr-2" />
          Nieuwe Scope
        </Button>
      </div>

      <Card className="bg-card/50 border-primary/10">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded bg-primary/10 mt-0.5">
              <Layers className="w-4 h-4 text-primary/70" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Elke <span className="text-primary font-mono font-bold">MC</span> scope definieert hoe de TaoGate classificeert binnen een specifieke organisatorische context.</p>
              <p className="text-xs text-muted-foreground/60">Visiedocumenten, mandaten en huisregels vormen samen het fundament. Categorieën bepalen welke invoer doorgelaten (PASS) of geblokkeerd en geëscaleerd (BLOCK) wordt — en naar wie. MC = Management Console.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {filterOrgId && (
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="w-4 h-4 text-primary" />
          <span className="font-mono text-primary">{orgMap[filterOrgId] || "Organisatie"}</span>
          <span className="text-muted-foreground">— {filteredScopes.length} scope(s)</span>
          <Button variant="ghost" size="sm" className="text-xs ml-2" onClick={() => setFilterOrgId(null)}>
            Toon alle
          </Button>
        </div>
      )}

      {filteredScopes.length === 0 ? (
        <Card className="bg-card/30 border-dashed border-border/40">
          <CardContent className="py-12 text-center">
            <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground/20" />
            <h3 className="font-mono font-semibold mb-2 text-lg">Blanco Project</h3>
            <p className="text-sm text-muted-foreground mb-1">Geen scopes gedefinieerd. Het systeem wacht op jouw organisatie.</p>
            <p className="text-xs text-muted-foreground/60 mb-6">Maak je eerste MC scope aan — kliniek, ziekenhuis, verpleeghuis, rechtbank, gemeente — en de TaoGate, classificatie en escalatiepaden worden automatisch ingevuld.</p>
            <Button onClick={() => setCreating(true)} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              Eerste MC Scope aanmaken
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredScopes.map(scope => (
            <ScopeCard key={scope.id} scope={scope} onEdit={setEditingScope} orgName={scope.orgId ? orgMap[scope.orgId] : undefined} orgs={orgs} />
          ))}
        </div>
      )}
    </div>
  );
}
