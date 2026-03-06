import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import type { InsertScope } from "@shared/schema";
import { repairPdfJson, extractJsonObject, structurePdfText } from "../services/pdfParser";
import { researchTopic, extractScopeFromResearch } from "../perplexity";

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const pdfParseSchema = z.object({
  pdfBase64: z.string().min(1, "PDF data is verplicht"),
  fileName: z.string().optional(),
});

const importJsonSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  data: z.object({
    categories: z.array(z.object({
      name: z.string(), label: z.string(),
      status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      escalation: z.string().nullable().optional().default(null),
      keywords: z.array(z.string()).optional().default([]),
    })).optional().default([]),
    rules: z.array(z.object({
      ruleId: z.string(), layer: z.enum(["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"]),
      domain: z.string(), title: z.string(), description: z.string(),
      action: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
      overridesLowerLayers: z.boolean().optional().default(false),
      source: z.string().optional().default(""), sourceUrl: z.string().optional().default(""),
      article: z.string().optional().default(""), citation: z.string().optional().default(""),
      qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
    })).optional().default([]),
    documents: z.array(z.object({
      type: z.enum(["visiedocument", "mandaat", "huisregel", "protocol", "overig"]),
      title: z.string(), content: z.string(),
    })).optional().default([]),
  }),
});

const importCsvSchema = z.object({
  orgId: z.string(), name: z.string().min(1), description: z.string().optional(),
  csvContent: z.string(),
  mapping: z.object({ type: z.enum(["categories", "rules"]), columns: z.record(z.string()) }),
});

const researchSchema = z.object({ query: z.string().min(3, "Zoekvraag moet minimaal 3 tekens zijn") });
const extractSchema = z.object({ query: z.string(), content: z.string(), citations: z.array(z.string()) });

const manualDraftSchema = z.object({
  name: z.string().min(1), description: z.string().optional().default(""), orgId: z.string().optional(),
  rules: z.array(z.object({
    ruleId: z.string(), layer: z.enum(["EU", "NATIONAL", "REGIONAL", "MUNICIPAL"]),
    domain: z.string(), title: z.string(), description: z.string(),
    action: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
    overridesLowerLayers: z.boolean().optional().default(false),
    source: z.string().optional().default(""), sourceUrl: z.string().optional().default(""),
    article: z.string().optional().default(""), citation: z.string().optional().default(""),
    qTriad: z.enum(["Mens×Mens", "Mens×Systeem", "Systeem×Systeem"]).optional(),
  })).optional().default([]),
  categories: z.array(z.object({
    name: z.string(), label: z.string(),
    status: z.enum(["PASS", "PASS_WITH_TRANSPARENCY", "ESCALATE_HUMAN", "ESCALATE_REGULATORY", "BLOCK"]),
    escalation: z.string().nullable().optional().default(null),
    keywords: z.array(z.string()).optional().default([]),
  })).optional().default([]),
  sourceText: z.string().optional().default(""), sourceUrls: z.array(z.string()).optional().default([]),
});

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
    else if ((ch === "," || ch === ";") && !inQuotes) { fields.push(current.trim()); current = ""; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export function registerImportRoutes(app: Express): void {
  app.post("/api/import/parse-pdf", async (req, res) => {
    const parsed = pdfParseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const { PDFParse } = (await import("pdf-parse")) as unknown as { PDFParse: new (opts: unknown) => { load(): Promise<void>; getText(): Promise<{ text?: string; total?: number } | string>; destroy(): Promise<void>; doc?: { numPages?: number } } };
      const buffer = Buffer.from(parsed.data.pdfBase64, "base64");
      const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
      await parser.load();
      const textResult = await parser.getText();
      const fullText = typeof textResult === "string" ? textResult : (textResult?.text || "");
      const numPages = typeof textResult === "object" && textResult?.total ? textResult.total : (parser.doc?.numPages || 1);
      await parser.destroy();

      const extracted: { categories?: unknown[]; rules?: unknown[]; documents?: unknown[] } = {};

      const rawCleaned = fullText
        .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\n*--\s*\d+\s+of\s+\d+\s*--\n*/g, "\n");

      let jsonBlock = extractJsonObject(rawCleaned);
      if (!jsonBlock) {
        const firstBrace = rawCleaned.indexOf('{');
        const lastBrace = rawCleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          jsonBlock = rawCleaned.substring(firstBrace, lastBrace + 1);
        }
      }
      if (jsonBlock) {
        const parsed2 = repairPdfJson(jsonBlock) as { categories?: unknown[]; rules?: unknown[]; documents?: unknown[] } | null;
        if (parsed2 && typeof parsed2 === "object") {
          if (Array.isArray(parsed2.categories)) extracted.categories = parsed2.categories;
          if (Array.isArray(parsed2.rules)) extracted.rules = parsed2.rules;
          if (Array.isArray(parsed2.documents)) extracted.documents = parsed2.documents;
        }
      }

      const sections = structurePdfText(fullText, numPages);

      if (!extracted.categories && !extracted.rules) {
        const allContent = sections.map((s: { content: string }) => s.content).join("\n");
        const fullParsed = repairPdfJson(allContent) as { categories?: unknown[]; rules?: unknown[] } | null;
        if (fullParsed && typeof fullParsed === "object" && !Array.isArray(fullParsed)) {
          if (Array.isArray(fullParsed.categories)) extracted.categories = fullParsed.categories;
          if (Array.isArray(fullParsed.rules)) extracted.rules = fullParsed.rules;
        }
      }

      if (!extracted.categories && !extracted.rules) {
        for (const s of sections as { content: string }[]) {
          const obj = repairPdfJson(s.content) as { categories?: unknown[]; rules?: unknown[] } | unknown[] | null;
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            const typed = obj as { categories?: unknown[]; rules?: unknown[] };
            if (Array.isArray(typed.categories) && typed.categories.length > 0) extracted.categories = [...(extracted.categories || []), ...typed.categories];
            if (Array.isArray(typed.rules) && typed.rules.length > 0) extracted.rules = [...(extracted.rules || []), ...typed.rules];
          } else if (Array.isArray(obj) && obj.length > 0) {
            const first = obj[0] as Record<string, unknown>;
            if (first.name && first.keywords) extracted.categories = [...(extracted.categories || []), ...obj];
            else if (first.ruleId && first.layer) extracted.rules = [...(extracted.rules || []), ...obj];
          }
        }
      }

      return res.json({
        fileName: parsed.data.fileName || "document.pdf",
        pages: numPages,
        totalChars: fullText.length,
        sections,
        extracted: Object.keys(extracted).length > 0 ? extracted : undefined,
      });
    } catch (err: unknown) {
      return res.status(400).json({ error: `PDF parsing mislukt: ${errMsg(err)}` });
    }
  });

  app.post("/api/import/json", async (req, res) => {
    const parsed = importJsonSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const { orgId, name, description, data } = parsed.data;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });
      const scope = await storage.createScope({
        name, description: description || `Geïmporteerd dataset voor ${org.name}`, status: "DRAFT", orgId,
        categories: data.categories, rules: data.rules, documents: data.documents,
        ingestMeta: { query: `Import: ${name}`, citations: [], researchedAt: new Date().toISOString(), model: "import-json", gaps: [] },
      });
      return res.status(201).json(scope);
    } catch (err: unknown) {
      return res.status(500).json({ error: errMsg(err) || "Import mislukt" });
    }
  });

  app.post("/api/import/csv", async (req, res) => {
    const parsed = importCsvSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const { orgId, name, description, csvContent, mapping } = parsed.data;
      const org = await storage.getOrganization(orgId);
      if (!org) return res.status(404).json({ error: "Organisatie niet gevonden" });

      const lines = csvContent.split("\n").map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return res.status(400).json({ error: "CSV moet minimaal een header en één rij bevatten" });

      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(line => {
        const values = parseCsvLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });

      type CategoryRow = NonNullable<InsertScope["categories"]>[number];
      type RuleRow = NonNullable<InsertScope["rules"]>[number];
      const categories: CategoryRow[] = [];
      const rules: RuleRow[] = [];

      if (mapping.type === "categories") {
        for (const row of rows) {
          categories.push({
            name: row[mapping.columns.name || "name"] || "",
            label: row[mapping.columns.label || "label"] || "",
            status: (row[mapping.columns.status || "status"] || "PASS") as CategoryRow["status"],
            escalation: row[mapping.columns.escalation || "escalation"] || null,
            keywords: (row[mapping.columns.keywords || "keywords"] || "").split(";").map(k => k.trim()).filter(k => k),
          });
        }
      } else {
        for (const row of rows) {
          rules.push({
            ruleId: row[mapping.columns.ruleId || "ruleId"] || `RULE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            layer: (row[mapping.columns.layer || "layer"] || "NATIONAL") as RuleRow["layer"],
            domain: row[mapping.columns.domain || "domain"] || "general",
            title: row[mapping.columns.title || "title"] || "",
            description: row[mapping.columns.description || "description"] || "",
            action: (row[mapping.columns.action || "action"] || "PASS") as RuleRow["action"],
            overridesLowerLayers: row[mapping.columns.overrides || "overrides"] === "true",
            source: row[mapping.columns.source || "source"] || "",
            sourceUrl: row[mapping.columns.sourceUrl || "sourceUrl"] || "",
            article: row[mapping.columns.article || "article"] || "",
            citation: row[mapping.columns.citation || "citation"] || "",
          });
        }
      }

      const scope = await storage.createScope({
        name, description: description || `CSV import voor ${org.name}`, status: "DRAFT", orgId,
        categories, rules, documents: [],
        ingestMeta: { query: `CSV Import: ${name}`, citations: [], researchedAt: new Date().toISOString(), model: "import-csv", gaps: [] },
      });
      return res.status(201).json({ scope, imported: { categories: categories.length, rules: rules.length } });
    } catch (err: unknown) {
      return res.status(500).json({ error: errMsg(err) || "CSV import mislukt" });
    }
  });

  app.post("/api/ingest/research", async (req, res) => {
    const parsed = researchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(await researchTopic(parsed.data.query));
    } catch (err: unknown) {
      return res.status(502).json({ error: errMsg(err) || "Perplexity API error" });
    }
  });

  app.post("/api/ingest/extract", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      return res.json(await extractScopeFromResearch(parsed.data.query, parsed.data.content, parsed.data.citations));
    } catch (err: unknown) {
      return res.status(502).json({ error: errMsg(err) || "Extraction failed" });
    }
  });

  app.post("/api/ingest/draft", async (req, res) => {
    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const extraction = await extractScopeFromResearch(parsed.data.query, parsed.data.content, parsed.data.citations);
      const scope = await storage.createScope({
        name: extraction.name, description: extraction.description, status: "DRAFT",
        categories: extraction.categories, rules: extraction.rules, documents: [],
        ingestMeta: { query: parsed.data.query, citations: parsed.data.citations, researchedAt: new Date().toISOString(), model: "sonar", gaps: extraction.gaps },
      });
      return res.status(201).json(scope);
    } catch (err: unknown) {
      return res.status(502).json({ error: errMsg(err) || "Draft creation failed" });
    }
  });

  app.post("/api/ingest/manual-draft", async (req, res) => {
    const parsed = manualDraftSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const data = parsed.data;
      const scope = await storage.createScope({
        name: data.name, description: data.description, status: "DRAFT", orgId: data.orgId,
        categories: data.categories, rules: data.rules, documents: [],
        ingestMeta: { query: `Handmatig: ${data.name}`, citations: data.sourceUrls, researchedAt: new Date().toISOString(), model: "manual", gaps: [], sourceText: data.sourceText },
      });
      return res.status(201).json(scope);
    } catch (err: unknown) {
      return res.status(500).json({ error: errMsg(err) || "Draft creation failed" });
    }
  });
}
