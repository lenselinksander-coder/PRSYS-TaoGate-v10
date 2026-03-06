import { useEffect, useState, useRef } from "react";
import { FileInput, Upload, FileJson, FileSpreadsheet, Check, AlertTriangle, CheckCircle, XCircle, FileText, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Organization = { id: string; name: string; slug: string };

const VALID_STATUS = ["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"] as const;
const VALID_LAYER = ["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"] as const;
const VALID_ACTION = VALID_STATUS;
const VALID_DOC_TYPE = ["visiedocument", "mandaat", "huisregel", "protocol", "overig"] as const;

interface ValidationIssue {
  path: string;
  message: string;
  severity: "error" | "warning";
}

function validateImportJson(raw: unknown): { valid: boolean; issues: ValidationIssue[]; summary: string } {
  const issues: ValidationIssue[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, issues: [{ path: "(root)", message: "JSON moet een object zijn met categories, rules, en/of documents", severity: "error" }], summary: "Geen geldig object" };
  }

  const obj = raw as Record<string, unknown>;
  const hasCategories = "categories" in obj;
  const hasRules = "rules" in obj;
  const hasDocuments = "documents" in obj;

  if (!hasCategories && !hasRules && !hasDocuments) {
    issues.push({ path: "(root)", message: "Minstens één van: categories, rules, of documents verwacht", severity: "error" });
  }

  const knownKeys = new Set(["categories", "rules", "documents"]);
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      issues.push({ path: key, message: `Onbekend veld "${key}" — wordt genegeerd`, severity: "warning" });
    }
  }

  if (hasCategories) {
    if (!Array.isArray(obj.categories)) {
      issues.push({ path: "categories", message: "Moet een array zijn", severity: "error" });
    } else {
      (obj.categories as any[]).forEach((cat, i) => {
        const p = `categories[${i}]`;
        if (!cat || typeof cat !== "object") { issues.push({ path: p, message: "Moet een object zijn", severity: "error" }); return; }
        if (!cat.name || typeof cat.name !== "string") issues.push({ path: `${p}.name`, message: "Verplicht (string)", severity: "error" });
        if (!cat.label || typeof cat.label !== "string") issues.push({ path: `${p}.label`, message: "Verplicht (string)", severity: "error" });
        if (!cat.status || !VALID_STATUS.includes(cat.status)) {
          issues.push({ path: `${p}.status`, message: `Verplicht, moet één van: ${VALID_STATUS.join(", ")}. Kreeg: "${cat.status || "(leeg)"}"`, severity: "error" });
        }
        if (cat.keywords !== undefined && !Array.isArray(cat.keywords)) {
          issues.push({ path: `${p}.keywords`, message: "Moet een array van strings zijn", severity: "error" });
        }
        if (cat.escalation !== undefined && cat.escalation !== null && typeof cat.escalation !== "string") {
          issues.push({ path: `${p}.escalation`, message: "Moet een string of null zijn", severity: "error" });
        }
      });
    }
  }

  if (hasRules) {
    if (!Array.isArray(obj.rules)) {
      issues.push({ path: "rules", message: "Moet een array zijn", severity: "error" });
    } else {
      (obj.rules as any[]).forEach((rule, i) => {
        const p = `rules[${i}]`;
        if (!rule || typeof rule !== "object") { issues.push({ path: p, message: "Moet een object zijn", severity: "error" }); return; }
        if (!rule.ruleId || typeof rule.ruleId !== "string") issues.push({ path: `${p}.ruleId`, message: "Verplicht (string)", severity: "error" });
        if (!rule.layer || !VALID_LAYER.includes(rule.layer)) {
          issues.push({ path: `${p}.layer`, message: `Verplicht, moet één van: ${VALID_LAYER.join(", ")}. Kreeg: "${rule.layer || "(leeg)"}"`, severity: "error" });
        }
        if (!rule.domain || typeof rule.domain !== "string") issues.push({ path: `${p}.domain`, message: "Verplicht (string)", severity: "error" });
        if (!rule.title || typeof rule.title !== "string") issues.push({ path: `${p}.title`, message: "Verplicht (string)", severity: "error" });
        if (!rule.description || typeof rule.description !== "string") issues.push({ path: `${p}.description`, message: "Verplicht (string)", severity: "error" });
        if (!rule.action || !VALID_ACTION.includes(rule.action)) {
          issues.push({ path: `${p}.action`, message: `Verplicht, moet één van: ${VALID_ACTION.join(", ")}. Kreeg: "${rule.action || "(leeg)"}"`, severity: "error" });
        }
      });
    }
  }

  if (hasDocuments) {
    if (!Array.isArray(obj.documents)) {
      issues.push({ path: "documents", message: "Moet een array zijn", severity: "error" });
    } else {
      (obj.documents as any[]).forEach((doc, i) => {
        const p = `documents[${i}]`;
        if (!doc || typeof doc !== "object") { issues.push({ path: p, message: "Moet een object zijn", severity: "error" }); return; }
        if (!doc.type || !VALID_DOC_TYPE.includes(doc.type)) {
          issues.push({ path: `${p}.type`, message: `Verplicht, moet één van: ${VALID_DOC_TYPE.join(", ")}. Kreeg: "${doc.type || "(leeg)"}"`, severity: "error" });
        }
        if (!doc.title || typeof doc.title !== "string") issues.push({ path: `${p}.title`, message: "Verplicht (string)", severity: "error" });
        if (!doc.content || typeof doc.content !== "string") issues.push({ path: `${p}.content`, message: "Verplicht (string)", severity: "error" });
      });
    }
  }

  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");
  const cats = hasCategories && Array.isArray(obj.categories) ? (obj.categories as any[]).length : 0;
  const rules = hasRules && Array.isArray(obj.rules) ? (obj.rules as any[]).length : 0;
  const docs = hasDocuments && Array.isArray(obj.documents) ? (obj.documents as any[]).length : 0;

  if (errors.length === 0) {
    return { valid: true, issues, summary: `Valide — ${cats} categorieën, ${rules} regels, ${docs} documenten${warnings.length > 0 ? ` (${warnings.length} waarschuwingen)` : ""}` };
  }
  return { valid: false, issues, summary: `${errors.length} fouten gevonden${warnings.length > 0 ? `, ${warnings.length} waarschuwingen` : ""}` };
}

function formatZodError(error: any): string {
  if (typeof error === "string") return error;
  if (error?.fieldErrors) {
    const parts: string[] = [];
    for (const [field, msgs] of Object.entries(error.fieldErrors)) {
      if (Array.isArray(msgs) && msgs.length > 0) {
        parts.push(`${field}: ${msgs.join(", ")}`);
      }
    }
    if (error.formErrors && Array.isArray(error.formErrors) && error.formErrors.length > 0) {
      parts.push(...error.formErrors);
    }
    return parts.join("\n") || JSON.stringify(error);
  }
  return JSON.stringify(error, null, 2);
}

function parseCsvSmart(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = csvContent.split("\n").map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else if (ch === ";" && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const delim = lines[0].includes(",") ? "," : ";";
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });

  return { headers, rows };
}

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
  const [validation, setValidation] = useState<ReturnType<typeof validateImportJson> | null>(null);
  const [pdfSections, setPdfSections] = useState<{ type: string; title: string; content: string }[] | null>(null);
  const [pdfMeta, setPdfMeta] = useState<{ fileName: string; pages: number; totalChars: number } | null>(null);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/organizations").then(r => r.json()).then(setOrgs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!jsonContent.trim()) { setValidation(null); return; }
    try {
      const parsed = JSON.parse(jsonContent);
      setValidation(validateImportJson(parsed));
    } catch {
      setValidation({ valid: false, issues: [{ path: "(root)", message: "Ongeldige JSON syntax — controleer haakjes en komma's", severity: "error" }], summary: "JSON parse error" });
    }
  }, [jsonContent]);

  const tryParsePdfJson = (text: string): any => {
    const cleaned = text
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/g, "\n")
      .trim();
    try { return JSON.parse(cleaned); } catch {}

    const joined = cleaned.replace(/\n/g, " ").replace(/\s+/g, " ");
    try { return JSON.parse(joined); } catch {}

    const truncFixed = cleaned.replace(/([a-zA-Zà-ÿ0-9 ])\n"([a-zA-Z_]+":\s*")/g, '$1", "$2');
    const truncJoined = truncFixed.replace(/\n/g, " ").replace(/\s+/g, " ");
    try { return JSON.parse(truncJoined); } catch {}

    const parts: string[] = [];
    let inString = false;
    let escaped = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escaped) { parts.push(ch); escaped = false; continue; }
      if (ch === '\\') { parts.push(ch); escaped = true; continue; }
      if (ch === '"') { inString = !inString; parts.push(ch); continue; }
      if (ch === '\n' && inString) { parts.push(' '); continue; }
      parts.push(ch);
    }
    try { return JSON.parse(parts.join('')); } catch {}

    return null;
  };

  const buildPdfData = () => {
    if (!pdfSections) return null;
    const result: any = {};
    const cats: any[] = [];
    const rules: any[] = [];
    const docs: any[] = [];

    const allContent = pdfSections.map(s => s.content).join("\n");
    const fullParsed = tryParsePdfJson(allContent);
    if (fullParsed && typeof fullParsed === "object" && !Array.isArray(fullParsed)) {
      if (Array.isArray(fullParsed.categories)) cats.push(...fullParsed.categories);
      if (Array.isArray(fullParsed.rules)) rules.push(...fullParsed.rules);
      if (Array.isArray(fullParsed.documents)) docs.push(...fullParsed.documents);
      if (cats.length || rules.length) {
        if (cats.length) result.categories = cats;
        if (rules.length) result.rules = rules;
        if (docs.length) result.documents = docs;
        return result;
      }
    }

    for (const s of pdfSections) {
      const p = tryParsePdfJson(s.content);
      if (p && typeof p === "object" && !Array.isArray(p)) {
        if (Array.isArray(p.categories)) cats.push(...p.categories);
        if (Array.isArray(p.rules)) rules.push(...p.rules);
        if (Array.isArray(p.documents)) docs.push(...p.documents);
        if (!p.categories && !p.rules && !p.documents) docs.push({ type: s.type, title: s.title, content: s.content });
      } else if (Array.isArray(p)) {
        const looksLikeCats = p.length > 0 && p[0].name && p[0].keywords;
        const looksLikeRules = p.length > 0 && p[0].ruleId && p[0].layer;
        if (looksLikeCats) cats.push(...p);
        else if (looksLikeRules) rules.push(...p);
        else docs.push({ type: s.type, title: s.title, content: s.content });
      } else {
        docs.push({ type: s.type, title: s.title, content: s.content });
      }
    }
    if (cats.length) result.categories = cats;
    if (rules.length) result.rules = rules;
    if (docs.length) result.documents = docs;
    return result;
  };

  const handleJsonImport = async () => {
    setError(null); setResult(null);
    if (!orgId) { setError("Selecteer een organisatie"); return; }
    if (!name) { setError("Vul een scope naam in"); return; }
    let parsed;
    if (pdfSections && pdfSections.length > 0 && !jsonContent.trim()) {
      parsed = buildPdfData();
      if (!parsed || (!parsed.categories && !parsed.rules && !parsed.documents)) {
        setError("PDF bevat geen herkenbare scope-data (categories, rules of documents)");
        return;
      }
    } else {
      try { parsed = JSON.parse(jsonContent); } catch { setError("Ongeldige JSON syntax — controleer haakjes en komma's"); return; }
    }

    const check = validateImportJson(parsed);
    if (!check.valid) {
      const errorLines = check.issues
        .filter(i => i.severity === "error")
        .map(i => `• ${i.path}: ${i.message}`);
      setError(`Validatie mislukt:\n${errorLines.join("\n")}`);
      return;
    }

    setImporting(true);
    try {
      const r = await fetch("/api/import/json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, name, description, data: parsed }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(formatZodError(data.error));
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const handleCsvImport = async () => {
    setError(null); setResult(null);
    if (!orgId) { setError("Selecteer een organisatie"); return; }
    if (!name) { setError("Vul een scope naam in"); return; }
    if (!csvContent.trim()) { setError("CSV-inhoud is leeg"); return; }
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
      if (!r.ok) throw new Error(formatZodError(data.error));
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

    if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
      handlePdfUpload(file);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (type === "json") setJsonContent(content);
      else setCsvContent(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const [pdfExtracted, setPdfExtracted] = useState<{ categories?: any[]; rules?: any[] } | null>(null);

  const handlePdfUpload = async (file: File) => {
    setError(null);
    setPdfSections(null);
    setPdfMeta(null);
    setPdfExtracted(null);
    setPdfParsing(true);
    setExpandedSections(new Set());
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const r = await fetch("/api/import/parse-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
      setPdfMeta({ fileName: data.fileName, pages: data.pages, totalChars: data.totalChars });
      setPdfSections(data.sections);
      if (data.extracted) {
        setPdfExtracted(data.extracted);
        const importData: any = {};
        if (data.extracted.categories) importData.categories = data.extracted.categories;
        if (data.extracted.rules) importData.rules = data.extracted.rules;
        setJsonContent(JSON.stringify(importData, null, 2));
      }
    } catch (e: any) {
      setError(`PDF parsing mislukt: ${e.message}`);
    } finally {
      setPdfParsing(false);
    }
  };

  const applyPdfAsDocuments = () => {
    if (!pdfSections) return;
    const current = jsonContent.trim() ? (() => { try { return JSON.parse(jsonContent); } catch { return {}; } })() : {};
    const extractedCategories: any[] = [...(current.categories || [])];
    const extractedRules: any[] = [...(current.rules || [])];
    const extractedDocs: any[] = [...(current.documents || [])];

    const allContent = pdfSections.map(s => s.content).join("\n");
    const fullParsed = tryParsePdfJson(allContent);
    if (fullParsed && typeof fullParsed === "object" && !Array.isArray(fullParsed)) {
      if (Array.isArray(fullParsed.categories)) extractedCategories.push(...fullParsed.categories);
      if (Array.isArray(fullParsed.rules)) extractedRules.push(...fullParsed.rules);
      if (Array.isArray(fullParsed.documents)) extractedDocs.push(...fullParsed.documents);
      if (extractedCategories.length || extractedRules.length) {
        current.categories = extractedCategories;
        current.rules = extractedRules;
        current.documents = extractedDocs;
        setJsonContent(JSON.stringify(current, null, 2));
        setPdfSections(null);
        setPdfMeta(null);
        return;
      }
    }

    for (const s of pdfSections) {
      const parsed = tryParsePdfJson(s.content);

      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
          extractedCategories.push(...parsed.categories);
        }
        if (Array.isArray(parsed.rules) && parsed.rules.length > 0) {
          extractedRules.push(...parsed.rules);
        }
        if (Array.isArray(parsed.documents) && parsed.documents.length > 0) {
          extractedDocs.push(...parsed.documents);
        }
        if (!parsed.categories && !parsed.rules && !parsed.documents) {
          extractedDocs.push({ type: s.type, title: s.title, content: s.content });
        }
      } else if (Array.isArray(parsed)) {
        const looksLikeCategories = parsed.length > 0 && parsed[0].name && parsed[0].keywords;
        const looksLikeRules = parsed.length > 0 && parsed[0].ruleId && parsed[0].layer;
        if (looksLikeCategories) extractedCategories.push(...parsed);
        else if (looksLikeRules) extractedRules.push(...parsed);
        else extractedDocs.push({ type: s.type, title: s.title, content: s.content });
      } else {
        extractedDocs.push({ type: s.type, title: s.title, content: s.content });
      }
    }

    current.categories = extractedCategories;
    current.rules = extractedRules;
    current.documents = extractedDocs;
    setJsonContent(JSON.stringify(current, null, 2));
    setPdfSections(null);
    setPdfMeta(null);
  };

  const removePdfSection = (index: number) => {
    if (!pdfSections) return;
    const updated = pdfSections.filter((_, i) => i !== index);
    setPdfSections(updated.length > 0 ? updated : null);
    const newExpanded = new Set<number>();
    expandedSections.forEach(i => {
      if (i < index) newExpanded.add(i);
      else if (i > index) newExpanded.add(i - 1);
    });
    setExpandedSections(newExpanded);
  };

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const validationErrors = validation?.issues.filter(i => i.severity === "error") || [];
  const validationWarnings = validation?.issues.filter(i => i.severity === "warning") || [];

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
          <Input data-testid="input-import-name" value={name} onChange={e => setName(e.target.value)} placeholder="Bijv. BBL Compliance 2026" />
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
            <span>
              <input ref={jsonFileRef} type="file" accept=".json,application/json,.pdf,application/pdf" className="sr-only" onChange={e => handleFileUpload(e, "json")} />
              <button type="button" onClick={() => jsonFileRef.current?.click()} className="text-xs text-primary flex items-center gap-1 hover:underline cursor-pointer" data-testid="button-upload-json">
                <Upload className="w-3 h-3" /> Bestand uploaden
              </button>
            </span>
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

          {validation && (
            <div data-testid="json-validation-result" className={`mt-3 rounded-lg border p-3 text-sm ${
              validation.valid
                ? "bg-green-500/10 border-green-500/30"
                : "bg-red-500/10 border-red-500/30"
            }`}>
              <div className={`flex items-center gap-2 font-bold mb-1 ${validation.valid ? "text-green-400" : "text-red-400"}`}>
                {validation.valid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {validation.summary}
              </div>
              {validationErrors.length > 0 && (
                <ul className="text-red-400/90 text-xs mt-1 space-y-0.5">
                  {validationErrors.map((issue, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-red-300">{issue.path}</span>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {validationWarnings.length > 0 && (
                <ul className="text-yellow-400/90 text-xs mt-1 space-y-0.5">
                  {validationWarnings.map((issue, i) => (
                    <li key={i} className="font-mono">
                      <span className="text-yellow-300">{issue.path}</span>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {pdfParsing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> PDF wordt verwerkt...
            </div>
          )}

          {pdfExtracted && (
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="font-bold">Scope-data geëxtraheerd uit PDF</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {pdfExtracted.categories ? `${pdfExtracted.categories.length} categorieën` : ""}
                {pdfExtracted.categories && pdfExtracted.rules ? " · " : ""}
                {pdfExtracted.rules ? `${pdfExtracted.rules.length} regels` : ""}
                {" — klaar om te importeren"}
              </p>
            </div>
          )}

          {pdfSections && pdfMeta && (
            <div data-testid="pdf-sections-preview" className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-bold text-sm">{pdfMeta.fileName}</span>
                  <span className="text-xs text-muted-foreground">
                    {pdfMeta.pages} pagina{pdfMeta.pages !== 1 ? "'s" : ""} — {pdfSections.length} secties gevonden
                  </span>
                </div>
                {!pdfExtracted && (
                  <Button size="sm" variant="outline" onClick={applyPdfAsDocuments} data-testid="button-apply-pdf" className="text-xs">
                    Toevoegen als documents
                  </Button>
                )}
              </div>
              <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                {pdfSections.map((section, i) => (
                  <div key={i} className="rounded border border-border/40 bg-background/50">
                    <div className="flex items-center justify-between px-3 py-2 cursor-pointer" onClick={() => toggleSection(i)}>
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono shrink-0">{section.type}</span>
                        <span className="font-medium truncate">{section.title}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{section.content.length} tekens</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); removePdfSection(i); }} className="text-red-400/60 hover:text-red-400 p-1" data-testid={`button-remove-section-${i}`}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {expandedSections.has(i) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedSections.has(i) && (
                      <div className="px-3 pb-3 border-t border-border/30">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 max-h-[200px] overflow-y-auto">{section.content}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button data-testid="button-import-json" onClick={handleJsonImport} disabled={importing || (validation !== null && !validation.valid && !(pdfSections && pdfSections.length > 0))} size="sm" className="mt-3">
            {importing ? "Importeren..." : "Importeer als Scope"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-card/50 border border-border/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold">CSV Dataset</h3>
            <span>
              <input ref={csvFileRef} type="file" accept=".csv,text/csv,.pdf,application/pdf" className="sr-only" onChange={e => handleFileUpload(e, "csv")} />
              <button type="button" onClick={() => csvFileRef.current?.click()} className="text-xs text-primary flex items-center gap-1 hover:underline cursor-pointer" data-testid="button-upload-csv">
                <Upload className="w-3 h-3" /> Bestand uploaden
              </button>
            </span>
          </div>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground block mb-1">Importtype</label>
            <div className="flex gap-2">
              <button
                data-testid="btn-csv-type-categories"
                onClick={() => setCsvType("categories")}
                className={`px-3 py-1.5 rounded text-xs ${csvType === "categories" ? "bg-primary/10 text-primary border border-primary/20" : "border border-border/40"}`}
              >
                Categorieën
              </button>
              <button
                data-testid="btn-csv-type-rules"
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
              ? `name,label,status,escalation,keywords\nPRIVACY,Privacy,ESCALATE_HUMAN,DPO,"persoonsgegevens;avg;dossier"`
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
        <div data-testid="import-error" className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-sm text-red-400 whitespace-pre-wrap font-mono">
          {error}
        </div>
      )}

      {result && (
        <div data-testid="import-success" className="mt-4 rounded-xl bg-green-500/10 border border-green-500/30 p-4">
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
        <h3 className="font-bold font-mono mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          JSON Format Specificatie
        </h3>
        <div className="text-xs text-muted-foreground mb-3 space-y-1">
          <p>Plak je JSON hieronder. Alle drie de secties (categories, rules, documents) zijn optioneel — maar minstens één moet aanwezig zijn.</p>
          <p>Organisatie en naam kies je in het formulier hierboven, die hoeven niet in de JSON.</p>
        </div>
        <pre className="bg-background/50 rounded-lg p-4 text-xs font-mono overflow-x-auto">
{`{
  "categories": [
    {
      "name": "CATEGORIE_ID",         ← verplicht (string)
      "label": "Leesbare naam",       ← verplicht (string)
      "status": "PASS",               ← verplicht: PASS | PASS_WITH_TRANSPARENCY
                                         | ESCALATE_HUMAN | ESCALATE_REGULATORY | BLOCK
      "escalation": "DPO",            ← optioneel (string of null)
      "keywords": ["woord1", "w2"]    ← optioneel (array van strings)
    }
  ],
  "rules": [
    {
      "ruleId": "UNIEK-ID",           ← verplicht (string)
      "layer": "EU",                  ← verplicht: EU | NATIONAL | REGIONAL | MUNICIPAL
      "domain": "domein",             ← verplicht (string)
      "title": "Regel titel",        ← verplicht (string)
      "description": "Beschrijving",  ← verplicht (string)
      "action": "BLOCK",              ← verplicht: PASS | PASS_WITH_TRANSPARENCY
                                         | ESCALATE_HUMAN | ESCALATE_REGULATORY | BLOCK
      "source": "Bron",              ← optioneel (string)
      "article": "Art. 5",           ← optioneel (string)
      "overridesLowerLayers": false   ← optioneel (boolean, default false)
    }
  ],
  "documents": [
    {
      "type": "mandaat",              ← verplicht: visiedocument | mandaat
                                         | huisregel | protocol | overig
      "title": "Document titel",     ← verplicht (string)
      "content": "Inhoud"            ← verplicht (string)
    }
  ]
}`}
        </pre>

        <h4 className="font-bold font-mono mt-4 mb-2 text-sm">Minimale testcase</h4>
        <pre className="bg-background/50 rounded-lg p-4 text-xs font-mono overflow-x-auto text-green-400/80">
{`{
  "categories": [
    { "name": "TEST", "label": "Test categorie", "status": "PASS" }
  ],
  "rules": [
    {
      "ruleId": "TEST-001",
      "layer": "NATIONAL",
      "domain": "test",
      "title": "Test regel",
      "description": "Minimale testregel",
      "action": "PASS"
    }
  ]
}`}
        </pre>
      </div>
    </div>
  );
}
