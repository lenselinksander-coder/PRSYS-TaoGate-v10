import { useEffect, useState } from "react";
import { FileInput, Upload, FileJson, FileSpreadsheet, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Organization = { id: string; name: string; slug: string };

export default function ImportPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [tab, setTab] = useState<"json" | "csv">("json");
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [csvType, setCsvType] = useState<"categories" | "rules">("categories");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/organizations").then(r => r.json()).then(setOrgs).catch(() => {});
  }, []);

  const handleJsonImport = async () => {
    setError(null); setResult(null);
    if (!orgId || !name) { setError("Organisatie en naam zijn verplicht"); return; }
    let parsed;
    try { parsed = JSON.parse(jsonContent); } catch { setError("Ongeldig JSON formaat"); return; }
    setImporting(true);
    try {
      const r = await fetch("/api/import/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, description, data: parsed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data.error) || "Import mislukt");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCsvImport = async () => {
    setError(null); setResult(null);
    if (!orgId || !name || !csvContent) { setError("Organisatie, naam en CSV-inhoud zijn verplicht"); return; }
    setImporting(true);
    try {
      const mapping = {
        type: csvType,
        columns: csvType === "categories"
          ? { name: "name", label: "label", status: "status", escalation: "escalation", keywords: "keywords" }
          : { ruleId: "ruleId", layer: "layer", domain: "domain", title: "title", description: "description", action: "action", source: "source" },
      };
      const r = await fetch("/api/import/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, description, csvContent, mapping }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify(data.error) || "CSV import mislukt");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "json" | "csv") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (type === "json") setJsonContent(content);
      else setCsvContent(content);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 data-testid="text-page-title" className="text-2xl font-bold font-mono flex items-center gap-3">
          <FileInput className="w-6 h-6 text-green-400" />
          Dataset Import
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Importeer datasets als JSON of CSV om automatisch een nieuwe Scope aan te maken</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Organisatie</label>
          <select
            data-testid="select-import-org"
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Kies organisatie...</option>
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Scope Naam</label>
          <Input data-testid="input-import-name" value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. GDPR Compliance 2026" />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          data-testid="tab-json"
          onClick={() => setTab("json")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
            tab === "json" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <FileJson className="w-4 h-4" /> JSON Import
        </button>
        <button
          data-testid="tab-csv"
          onClick={() => setTab("csv")}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
            tab === "csv" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> CSV Import
        </button>
      </div>

      {tab === "json" ? (
        <div className="rounded-xl bg-card/50 border border-border/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">JSON Dataset</h3>
            <label className="cursor-pointer">
              <input type="file" accept=".json" className="hidden" onChange={e => handleFileUpload(e, "json")} />
              <span className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Upload className="w-3 h-3" /> Bestand uploaden
              </span>
            </label>
          </div>
          <textarea
            data-testid="input-json-content"
            value={jsonContent}
            onChange={e => setJsonContent(e.target.value)}
            placeholder={`{
  "categories": [
    { "name": "PRIVACY", "label": "Privacy", "status": "ESCALATE_HUMAN", "keywords": ["persoonsgegevens", "avg"] }
  ],
  "rules": [
    { "ruleId": "RULE-1", "layer": "EU", "domain": "privacy", "title": "AVG", "description": "...", "action": "ESCALATE_HUMAN" }
  ]
}`}
            className="w-full min-h-[200px] resize-y rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm font-mono"
          />
          <Button data-testid="button-import-json" onClick={handleJsonImport} disabled={importing} size="sm" className="mt-3">
            {importing ? "Importeren..." : "Importeer als Scope"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-card/50 border border-border/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">CSV Dataset</h3>
            <label className="cursor-pointer">
              <input type="file" accept=".csv" className="hidden" onChange={e => handleFileUpload(e, "csv")} />
              <span className="text-xs text-primary flex items-center gap-1 hover:underline">
                <Upload className="w-3 h-3" /> Bestand uploaden
              </span>
            </label>
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Importtype</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCsvType("categories")}
                className={`px-3 py-1.5 rounded text-xs ${csvType === "categories" ? "bg-primary/10 text-primary border border-primary/20" : "border border-border/40"}`}
              >
                Categorieën
              </button>
              <button
                onClick={() => setCsvType("rules")}
                className={`px-3 py-1.5 rounded text-xs ${csvType === "rules" ? "bg-primary/10 text-primary border border-primary/20" : "border border-border/40"}`}
              >
                Regels
              </button>
            </div>
          </div>
          <textarea
            data-testid="input-csv-content"
            value={csvContent}
            onChange={e => setCsvContent(e.target.value)}
            placeholder={csvType === "categories"
              ? `name,label,status,escalation,keywords\nPRIVACY,Privacy,ESCALATE_HUMAN,DPO,persoonsgegevens;avg;dossier`
              : `ruleId,layer,domain,title,description,action,source\nRULE-1,EU,privacy,AVG Art 5,Verwerking moet rechtmatig zijn,ESCALATE_HUMAN,AVG`
            }
            className="w-full min-h-[200px] resize-y rounded-lg border border-border/40 bg-background/50 px-3 py-2 text-sm font-mono"
          />
          <Button data-testid="button-import-csv" onClick={handleCsvImport} disabled={importing} size="sm" className="mt-3">
            {importing ? "Importeren..." : "Importeer CSV als Scope"}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
          <div className="flex items-center gap-2 text-green-400 font-bold mb-2">
            <Check className="w-4 h-4" /> Import succesvol
          </div>
          <div className="text-sm text-muted-foreground">
            Scope <span className="font-mono text-foreground">{result.scope?.name || result.name}</span> aangemaakt als DRAFT.
            {result.imported && (
              <span> ({result.imported.categories} categorieën, {result.imported.rules} regels)</span>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 rounded-xl bg-card/30 border border-border/30 p-5">
        <h3 className="font-bold font-mono mb-3">JSON Format Specificatie</h3>
        <pre className="bg-background/50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`{
  "categories": [
    {
      "name": "CATEGORIE_ID",
      "label": "Leesbare naam",
      "status": "PASS | PASS_WITH_TRANSPARENCY | ESCALATE_HUMAN | ESCALATE_REGULATORY | BLOCK",
      "escalation": "Naar wie escaleren (of null)",
      "keywords": ["trefwoord1", "trefwoord2"]
    }
  ],
  "rules": [
    {
      "ruleId": "UNIEK-ID",
      "layer": "EU | NATIONAL | REGIONAL | MUNICIPAL",
      "domain": "domein",
      "title": "Regel titel",
      "description": "Beschrijving",
      "action": "PASS | ESCALATE_HUMAN | BLOCK",
      "source": "Bron (wet/richtlijn)"
    }
  ],
  "documents": [
    {
      "type": "visiedocument | mandaat | huisregel | protocol | overig",
      "title": "Document titel",
      "content": "Inhoud"
    }
  ]
}`}
        </pre>
      </div>
    </div>
  );
}
