export function repairPdfJson(text: string): unknown {
  let cleaned = text
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
  try { return JSON.parse(truncJoined); } catch {
    console.log("[PDF] truncFixed parse failed, sample:", truncJoined.substring(0, 500));
  }

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
}

export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (!inStr) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return text.substring(start, i + 1); }
    }
  }
  return null;
}

export function structurePdfText(text: string, numPages: number): { type: string; title: string; content: string }[] {
  const lines = text.split("\n");
  const sections: { type: string; title: string; content: string }[] = [];

  const headingPatterns = [
    /^(#{1,3})\s+(.+)/,
    /^(\d+\.(?:\d+\.?)*)\s+(.+)/,
    /^(Artikel|Art\.?|Hoofdstuk|Afdeling|Paragraaf|Sectie|Section|Chapter|Part)\s+[\dIVXivx]+[.:]\s*(.+)/i,
    /^([A-Z][A-Z\s\-]{4,})$/,
  ];

  let currentTitle = "";
  let currentLines: string[] = [];
  let sectionCount = 0;

  const flushSection = () => {
    const content = currentLines.join("\n").trim();
    if (!content) return;
    sectionCount++;
    const type = sectionCount === 1 && !currentTitle ? "visiedocument" : "protocol";
    sections.push({
      type,
      title: currentTitle || `Sectie ${sectionCount}`,
      content,
    });
    currentLines = [];
    currentTitle = "";
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentLines.length > 0) currentLines.push("");
      continue;
    }

    let isHeading = false;
    let headingText = "";

    for (const pattern of headingPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        if (pattern === headingPatterns[3]) {
          if (trimmed.length >= 5 && trimmed.length <= 80) {
            isHeading = true;
            headingText = trimmed;
          }
        } else {
          isHeading = true;
          headingText = match[2] ? `${match[1]} ${match[2]}`.trim() : trimmed;
        }
        break;
      }
    }

    if (isHeading && currentLines.length > 3) {
      flushSection();
      currentTitle = headingText;
    } else if (isHeading && currentLines.length <= 3) {
      currentTitle = currentTitle || headingText;
      currentLines.push(trimmed);
    } else {
      currentLines.push(trimmed);
    }
  }

  flushSection();

  if (sections.length === 0 && text.trim()) {
    sections.push({
      type: "visiedocument",
      title: "Volledige tekst",
      content: text.trim(),
    });
  }

  return sections;
}
