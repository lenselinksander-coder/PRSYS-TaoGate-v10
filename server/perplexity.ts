import OpenAI from "openai";

const MODEL = "sonar";

export interface ResearchResult {
  content: string;
  citations: string[];
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function getClient(): OpenAI {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: "https://api.perplexity.ai",
  });
}

export async function researchTopic(query: string): Promise<ResearchResult> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Je bent een onderzoeksassistent voor ORFHEUSS, een governance-systeem voor organisaties. 
Je taak is bronnen zoeken en gestructureerde informatie leveren over regelgeving, risico's en compliance.

Antwoord ALTIJD in het Nederlands.
Verwijs ALTIJD naar specifieke artikelen, wetten of richtlijnen met bronvermelding.
Structureer je antwoord als volgt:

## Samenvatting
Korte beschrijving van het onderwerp en de belangrijkste bevindingen.

## Regelgeving & Bronnen
Per gevonden regel/richtlijn:
- **Titel**: naam van de wet/richtlijn/norm
- **Bron**: waar dit vandaan komt
- **Artikel**: specifiek artikel/sectie indien van toepassing
- **Impact**: HOOG/MIDDEL/LAAG
- **Actie**: BLOCK (verboden), ESCALATE (menselijke review vereist), of PASS (toegestaan onder voorwaarden)
- **Domein**: welk domein dit raakt (bijv. technisch, sociaal, ecologisch, bestuurlijk, juridisch, ethisch)
- **Toelichting**: korte uitleg

## Ontbrekende Informatie
Wat is nog onduidelijk of niet gevonden? Dit worden de "gaps" in de scope.`
      },
      {
        role: "user",
        content: query
      }
    ],
    temperature: 0.2,
    top_p: 0.9,
    stream: false,
  } as any);

  const raw = response as any;

  return {
    content: response.choices[0]?.message?.content || "",
    citations: raw.citations || [],
    model: response.model,
    usage: {
      prompt_tokens: response.usage?.prompt_tokens || 0,
      completion_tokens: response.usage?.completion_tokens || 0,
      total_tokens: response.usage?.total_tokens || 0,
    },
  };
}

export interface ExtractedRule {
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

export interface ExtractedCategory {
  name: string;
  label: string;
  status: "PASS" | "PASS_WITH_TRANSPARENCY" | "ESCALATE_HUMAN" | "ESCALATE_REGULATORY" | "BLOCK";
  escalation: string | null;
  keywords: string[];
}

export interface ExtractionResult {
  name: string;
  description: string;
  rules: ExtractedRule[];
  categories: ExtractedCategory[];
  gaps: string[];
}

export async function extractScopeFromResearch(
  query: string,
  researchContent: string,
  citations: string[]
): Promise<ExtractionResult> {
  const client = getClient();
  const citationsList = citations.map((c, i) => `[${i + 1}] ${c}`).join("\n");

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `Je bent een scope-extractie engine voor ORFHEUSS. Je ontvangt onderzoeksresultaten en zet deze om naar gestructureerde scope-objecten.

BELANGRIJK: Antwoord UITSLUITEND met een geldig JSON object. Geen markdown, geen uitleg, alleen JSON.

Het JSON object moet dit exacte format hebben:
{
  "name": "Korte scope naam",
  "description": "Beschrijving van de scope",
  "rules": [
    {
      "ruleId": "UNIEK-ID",
      "layer": "EU" | "NATIONAL" | "REGIONAL" | "MUNICIPAL",
      "domain": "domein naam",
      "title": "regel titel",
      "description": "wat de regel inhoudt",
      "action": "BLOCK" | "ESCALATE_REGULATORY" | "ESCALATE_HUMAN" | "PASS_WITH_TRANSPARENCY" | "PASS",
      "overridesLowerLayers": true/false,
      "source": "naam van wet/richtlijn",
      "sourceUrl": "URL naar bron",
      "article": "specifiek artikel indien bekend",
      "citation": "relevante quote uit de bron",
      "qTriad": "Mens×Mens" | "Mens×Systeem" | "Systeem×Systeem"
    }
  ],
  "categories": [
    {
      "name": "CATEGORIE_NAAM",
      "label": "Leesbare naam",
      "status": "BLOCK" | "ESCALATE_REGULATORY" | "ESCALATE_HUMAN" | "PASS_WITH_TRANSPARENCY" | "PASS",
      "escalation": "naar wie escaleren of null",
      "keywords": ["trefwoord1", "trefwoord2"]
    }
  ],
  "gaps": ["Wat ontbreekt nog aan informatie"]
}

REGELS:
- Elke regel MOET een sourceUrl hebben (gebruik de beschikbare bronnen)
- Elke regel MOET een source hebben (naam van de wet/richtlijn)
- BLOCK = verboden, mag niet zonder menselijke interventie
- ESCALATE_REGULATORY = moet naar toezichthouder
- ESCALATE_HUMAN = menselijke review vereist
- PASS_WITH_TRANSPARENCY = toegestaan met transparantie-eis
- PASS = toegestaan
- layer: EU voor Europese wetgeving, NATIONAL voor nationale wetten, REGIONAL voor provinciale regels, MUNICIPAL voor gemeentelijke regels
- qTriad: Mens×Mens = frictie tussen mensen, Mens×Systeem = frictie tussen mens en technologie/proces, Systeem×Systeem = frictie tussen systemen onderling`
      },
      {
        role: "user",
        content: `Onderzoeksvraag: "${query}"

Onderzoeksresultaten:
${researchContent}

Beschikbare bronnen:
${citationsList}

Zet dit om naar een scope JSON object.`
      }
    ],
    temperature: 0.1,
    top_p: 0.9,
    stream: false,
  } as any);

  const content = response.choices[0]?.message?.content || "{}";

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not extract JSON from Perplexity response");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ExtractionResult;
  return parsed;
}

export async function fetchOnderbouwing(ruleTitle: string, source: string): Promise<string> {
  try {
    const client = getClient();
    const query = `${ruleTitle} ${source} Nederlandse bouwregelgeving`;
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "Je bent een juridisch assistent. Geef een korte onderbouwing in 2-3 zinnen in het Nederlands. Verwijs naar specifieke artikelen of wetten. Geen opsommingen, geen markdown — alleen vloeiende tekst.",
        },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      top_p: 0.9,
      stream: false,
    } as any);
    return response.choices[0]?.message?.content?.trim() || "";
  } catch {
    return "";
  }
}

export interface PreflightResult {
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

export function preflightCheck(scope: {
  rules: ExtractedRule[];
  categories: ExtractedCategory[];
  gaps?: string[];
}): PreflightResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!scope.rules || scope.rules.length === 0) {
    issues.push("Geen regels gedefinieerd — scope is leeg");
  }

  if (!scope.categories || scope.categories.length === 0) {
    issues.push("Geen categorieën gedefinieerd");
  }

  const rulesWithoutSource = (scope.rules || []).filter(r => !r.source && !r.sourceUrl);
  if (rulesWithoutSource.length > 0) {
    issues.push(`${rulesWithoutSource.length} regel(s) zonder bron: ${rulesWithoutSource.map(r => r.ruleId).join(", ")}`);
  }

  const blockRules = (scope.rules || []).filter(r => r.action === "BLOCK");
  const blockWithoutArticle = blockRules.filter(r => !r.article && !r.citation);
  if (blockWithoutArticle.length > 0) {
    warnings.push(`${blockWithoutArticle.length} BLOCK-regel(s) zonder specifiek artikel/citaat: ${blockWithoutArticle.map(r => r.ruleId).join(", ")}`);
  }

  const escalateRules = (scope.rules || []).filter(r => r.action === "ESCALATE_HUMAN" || r.action === "ESCALATE_REGULATORY");
  const escalateCats = (scope.categories || []).filter(c => c.status === "ESCALATE_HUMAN" || c.status === "ESCALATE_REGULATORY");
  const hasEscalationTarget = escalateCats.some(c => c.escalation && c.escalation.trim() !== "");
  if (escalateRules.length > 0 && !hasEscalationTarget) {
    warnings.push("Escalatieregels gevonden maar geen escalatiedoel gedefinieerd in categorieën");
  }

  if (scope.gaps && scope.gaps.length > 0) {
    warnings.push(`${scope.gaps.length} gap(s) geïdentificeerd: ${scope.gaps.join("; ")}`);
  }

  return {
    canLock: issues.length === 0,
    issues,
    warnings,
    stats: {
      totalRules: (scope.rules || []).length,
      rulesWithSource: (scope.rules || []).filter(r => r.source || r.sourceUrl).length,
      rulesWithoutSource: rulesWithoutSource.length,
      totalCategories: (scope.categories || []).length,
      gaps: (scope.gaps || []).length,
    },
  };
}
