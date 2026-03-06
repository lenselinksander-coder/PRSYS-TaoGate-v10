/**
 * fetchRegister.ts
 *
 * Fetches and normalises the Dutch Government Algoritmeregister CSV dataset.
 * The fetch is deterministic: same HTTP response → same output.
 * No LLM or non-deterministic components.
 */

const REGISTER_CSV_URL =
  "https://algoritmes.overheid.nl/api/downloads/ENG?filetype=csv";

// ── Public shape ────────────────────────────────────────────────────────────

export interface RawRegisterItem {
  id: string;
  name: string;
  organization: string;
  purpose: string;
  legal_basis: string;
  impact_category: string;
  human_intervention: string;
  dataset: string;
  description: string;
}

// ── Minimal RFC-4180 CSV parser (deterministic, no external deps) ────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && i + 1 < text.length && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i += 2;
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Flush last field/row
  if (row.length > 0 || field !== "") {
    row.push(field);
    // Skip trailing empty row produced by a final newline
    if (row.some((f) => f !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

// ── Column-name resolution (deterministic: first match wins) ─────────────────

/**
 * Returns the value from `record` for the first header name in `candidates`
 * that exists in `headers`. Returns "" if none match.
 */
function pick(
  headers: string[],
  record: string[],
  ...candidates: string[]
): string {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate);
    if (idx !== -1) {
      return (record[idx] ?? "").trim();
    }
  }
  return "";
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches the Algoritmeregister CSV and returns normalised items.
 * Throws a descriptive error on HTTP or parse failure.
 */
export async function fetchRegister(): Promise<RawRegisterItem[]> {
  let csvText: string;

  try {
    const response = await fetch(REGISTER_CSV_URL);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} — ${REGISTER_CSV_URL}`
      );
    }
    csvText = await response.text();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`fetchRegister: request failed — ${msg}`);
  }

  let rows: string[][];
  try {
    rows = parseCSV(csvText);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`fetchRegister: CSV parse failed — ${msg}`);
  }

  if (rows.length < 2) {
    throw new Error(
      `fetchRegister: CSV contains fewer than 2 rows (headers + data required)`
    );
  }

  // Normalise headers: lowercase + trim
  const headers = rows[0].map((h) => h.toLowerCase().trim());

  const items: RawRegisterItem[] = [];

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    const record = rows[rowIdx];
    if (record.every((f) => f.trim() === "")) continue; // skip blank rows

    // id — prefer 'id', fall back to row index as string
    const id =
      pick(headers, record, "id", "algoritme_id", "algorithm_id") ||
      String(rowIdx);

    // name
    const name = pick(
      headers,
      record,
      "name",
      "naam",
      "algorithm_name",
      "title"
    );

    // organization
    const organization = pick(
      headers,
      record,
      "organization",
      "organisation",
      "organization_name",
      "overheidsorganisatie",
      "owner"
    );

    // purpose — prefer long description of purpose, fall back to shorter
    const purpose = pick(
      headers,
      record,
      "purpose_and_impact",
      "goal",
      "doel_en_impact",
      "doel",
      "purpose",
      "goal_and_impact"
    );

    // legal_basis
    const legal_basis = pick(
      headers,
      record,
      "legal_base",
      "legal_basis",
      "wettelijke_grondslag",
      "legal_ground",
      "legal_framework"
    );

    // impact_category — prefer explicit risk/impact field
    const impact_category = pick(
      headers,
      record,
      "impact_assessment",
      "type_systeem",
      "risk_category",
      "impact_category",
      "impacttoetsingsplichtig",
      "category",
      "type"
    );

    // human_intervention
    const human_intervention = pick(
      headers,
      record,
      "human_intervention",
      "menselijke_tussenkomst",
      "human_oversight",
      "human_review"
    );

    // dataset — prefer explicit dataset field, fall back to broader data field
    const dataset = pick(
      headers,
      record,
      "datasets",
      "dataset",
      "data",
      "training_data",
      "input_data"
    );

    // description — prefer long, fall back to short
    const description =
      pick(
        headers,
        record,
        "description",
        "long_description",
        "beschrijving",
        "uitgebreide_beschrijving"
      ) ||
      pick(
        headers,
        record,
        "short_description",
        "korte_beschrijving",
        "summary"
      );

    items.push({
      id,
      name,
      organization,
      purpose,
      legal_basis,
      impact_category,
      human_intervention,
      dataset,
      description,
    });
  }

  return items;
}
