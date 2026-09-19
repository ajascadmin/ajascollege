import { marked } from "marked";

export type FactRow = { label: string; value: string };
/** A markdown table too big/irregular to be a compact "at a glance" fact sheet. */
export type DataTable = { headers: string[]; rows: string[][] };
export type ContentSection = {
  id: string;
  title: string;
  level: 2 | 3;
  bodyMd: string;
  bodyHtml: string;
  facts: FactRow[];
  tables: DataTable[];
  images: string[];
  empty: boolean;
};

export type ProgrammeBlock = {
  title: string;
  duration?: string;
  fee?: string;
  intake?: string;
  complementary?: string;
  eligibility?: string;
  extraHtml: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function isSeparatorLine(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line);
}

function splitTableLine(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/**
 * Parses a markdown table keeping every column — the old version collapsed
 * anything past column 2 into a joined string, silently dropping data on
 * wider tables (e.g. a 5-column feedback-by-year table lost 3 columns).
 * Standard shape is header row, separator row, data rows; a blank header
 * row ("|  |  |", common in these scraped pages) means "no real header".
 */
function parseFullTable(md: string): DataTable | null {
  const lines = md
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2 || !lines[0].includes("|")) return null;

  if (isSeparatorLine(lines[1])) {
    const headerCells = splitTableLine(lines[0]);
    const hasHeader = headerCells.some((h) => h.length > 0);
    const rows = lines
      .slice(2)
      .filter((l) => !isSeparatorLine(l))
      .map(splitTableLine)
      .filter((r) => r.some((c) => c.length > 0));
    return { headers: hasHeader ? headerCells : [], rows };
  }
  // No separator row found — malformed table, treat every line as data.
  const rows = lines
    .filter((l) => !isSeparatorLine(l))
    .map(splitTableLine)
    .filter((r) => r.some((c) => c.length > 0));
  return { headers: [], rows };
}

/**
 * A table only reads well as a 2-column "at a glance" fact sheet when it's
 * actually small and short — genuine label:value stats, not a 40-row list
 * of event names or a 5-column report-by-year grid. Everything else should
 * render as a real table instead of being squeezed into a narrow sidebar.
 */
function isCompactTable(t: DataTable): boolean {
  if (t.rows.length === 0 || t.rows.length > 8) return false;
  const cols = Math.max(t.headers.length, ...t.rows.map((r) => r.length));
  if (cols !== 2) return false;
  const cells = [...t.headers, ...t.rows.flat()];
  return cells.every((c) => c.length <= 90);
}

function tableToFacts(t: DataTable): FactRow[] {
  return t.rows
    .map((r) => ({ label: r[0] || "", value: r[1] || "" }))
    .filter((r) => r.label || r.value);
}

/** Split raw table blocks out of a chunk of markdown into facts (compact
 * 2-col tables) vs. tables (everything else), plus the text with tables
 * removed. */
function extractTables(md: string): { facts: FactRow[]; tables: DataTable[]; rest: string } {
  const facts: FactRow[] = [];
  const tables: DataTable[] = [];
  let rest = md;
  const blocks = md.match(/(?:^\|.+\|$\n?)+/gm);
  if (blocks) {
    for (const block of blocks) {
      const t = parseFullTable(block);
      rest = rest.replace(block, "").trim();
      if (!t || t.rows.length === 0) continue;
      if (isCompactTable(t)) facts.push(...tableToFacts(t));
      else tables.push(t);
    }
  }
  return { facts, tables, rest };
}

function extractImages(md: string): string[] {
  const out: string[] = [];
  const re = /!\[[^\]]*\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push(m[1]);
  return out;
}

function stripImages(md: string): string {
  return md.replace(/!\[[^\]]*\]\(([^)]+)\)\s*/g, "").trim();
}

function mdToHtml(md: string): string {
  if (!md.trim()) return "";
  return marked.parse(md, { async: false }) as string;
}

/** Split page body into H2 sections (+ leading intro). */
export function splitSections(body: string): {
  introMd: string;
  introHtml: string;
  introImages: string[];
  introFacts: FactRow[];
  introTables: DataTable[];
  sections: ContentSection[];
} {
  const text = body.replace(/\r\n/g, "\n").trim();
  const parts = text.split(/(?=^## )/m);
  let introMd = "";
  const sections: ContentSection[] = [];

  for (const part of parts) {
    if (!part.trim()) continue;
    if (part.startsWith("## ")) {
      const nl = part.indexOf("\n");
      const title = part.slice(3, nl === -1 ? undefined : nl).trim();
      const bodyMd = (nl === -1 ? "" : part.slice(nl + 1)).trim();
      const { facts, tables, rest } = extractTables(bodyMd);
      const images = extractImages(bodyMd);
      const textOnly = stripImages(rest).trim();
      const empty = !textOnly && facts.length === 0 && tables.length === 0 && images.length === 0;
      sections.push({
        id: slugify(title),
        title,
        level: 2,
        bodyMd: rest,
        bodyHtml: mdToHtml(rest),
        facts,
        tables,
        images,
        empty,
      });
    } else {
      introMd += (introMd ? "\n\n" : "") + part.trim();
    }
  }

  const { facts: introFacts, tables: introTables, rest: introRest } = extractTables(introMd);
  const introImages = extractImages(introMd);
  const introHtml = mdToHtml(stripImages(introRest).trim());

  return {
    introMd: introRest,
    introHtml,
    introImages,
    introFacts,
    introTables,
    sections: sections.filter((s) => !s.empty),
  };
}

/** Parse admission-style ### programme blocks. */
export function parseProgrammes(body: string): {
  leadHtml: string;
  programmes: ProgrammeBlock[];
  tailHtml: string;
} {
  const text = body.replace(/\r\n/g, "\n");
  // Drop a top ## Programme Offered wrapper title for cleaner UI
  const cleaned = text.replace(/^## Programme Offered\s*\n+/i, "");
  const chunks = cleaned.split(/(?=^### )/m);
  let lead = "";
  const programmes: ProgrammeBlock[] = [];
  let tail = "";

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    if (!chunk.startsWith("### ")) {
      if (programmes.length === 0) lead += chunk;
      else tail += chunk;
      continue;
    }
    const nl = chunk.indexOf("\n");
    const title = chunk.slice(4, nl === -1 ? undefined : nl).trim();
    const bodyMd = (nl === -1 ? "" : chunk.slice(nl + 1)).trim();

    const pick = (label: string) => {
      const re = new RegExp(
        `(?:^|\\n)[-*]\\s*${label}\\s*[:\\s]*([^\\n]+)`,
        "i",
      );
      const m = bodyMd.match(re);
      return m ? m[1].replace(/^[:\\s]+/, "").trim() : undefined;
    };

    // Duration06 sem / Fee19500 patterns without space after label
    const duration =
      pick("Duration") ||
      bodyMd.match(/Duration\s*([^\n]+)/i)?.[1]?.trim();
    const fee =
      pick("Fee") || bodyMd.match(/Fee\s*([^\n]+)/i)?.[1]?.trim();
    const intake =
      pick("Intake") || bodyMd.match(/Intake\s*([^\n]+)/i)?.[1]?.trim();

    let eligibility: string | undefined;
    const elig = bodyMd.match(
      /\*\*Eligibility\*\*\s*([\s\S]*?)(?=\n### |\n\*\*|$)/i,
    );
    if (elig) eligibility = elig[1].trim();

    let complementary: string | undefined;
    const comp = bodyMd.match(
      /\*\*Complementary\*\*\s*([\s\S]*?)(?=\n### |\n\*\*|$)/i,
    );
    if (comp) complementary = comp[1].replace(/^Complementary:\s*/i, "").trim();

    // remaining narrative
    let extra = bodyMd
      .replace(/(?:^|\n)[-*]\s*Duration[^\n]*/gi, "")
      .replace(/(?:^|\n)[-*]\s*Fee[^\n]*/gi, "")
      .replace(/(?:^|\n)[-*]\s*Intake[^\n]*/gi, "")
      .replace(/Duration[^\n]*/gi, "")
      .replace(/Fee[^\n]*/gi, "")
      .replace(/Intake[^\n]*/gi, "")
      .replace(/\*\*Eligibility\*\*[\s\S]*?(?=\n### |\n\*\*|$)/i, "")
      .replace(/\*\*Complementary\*\*[\s\S]*?(?=\n### |\n\*\*|$)/i, "")
      .trim();

    programmes.push({
      title,
      duration,
      fee,
      intake,
      complementary,
      eligibility,
      extraHtml: mdToHtml(extra),
    });
  }

  return {
    leadHtml: mdToHtml(lead.trim()),
    programmes,
    tailHtml: mdToHtml(tail.trim()),
  };
}

/**
 * The programme-card layout is for a body that actually lists programmes as
 * `### Name` blocks with `Fee :` / `Intake :` lines under them.
 *
 * This used to return true for the /admission/ permalink whatever the page
 * said. When that page's content changed to prose and tables, parseProgrammes
 * found no blocks and the page rendered as an unstyled dump — no document
 * shell, no table, no list markers. Match the shape of the content instead,
 * so the layout follows the body rather than the URL.
 */
export function looksLikeAdmission(body: string): boolean {
  return body
    .split(/^###\s+/m)
    .slice(1)
    .some((block) => /^\s*(Fee|Intake|Duration)\s*:/im.test(block));
}

/**
 * Only the dedicated Vision & Mission page should get the 2-panel layout.
 * Matching on "has a Vision heading and a Mission heading" false-positives on
 * every department/club/cell page (they almost all have their own Vision +
 * Mission subsections among several other sections) and wrecks them — see
 * incident where placement-cell/department pages rendered as two giant
 * cartoon panels with every other section (tables, galleries) silently
 * dropped. Scope this to pages that are ONLY Vision + Mission.
 */
export function looksLikeVision(body: string, title: string, permalink?: string): boolean {
  if (permalink && normalizeForVisionCheck(permalink) === "/vision-mission/") return true;
  if (!/vision/i.test(title)) return false;
  const headings = (body.match(/^##\s+(.+)$/gm) || []).map((h) =>
    h.replace(/^##\s+/, "").trim().toLowerCase(),
  );
  return (
    headings.length > 0 &&
    headings.length <= 2 &&
    headings.every((h) => h === "vision" || h === "mission")
  );
}

function normalizeForVisionCheck(p: string): string {
  const s = p.startsWith("/") ? p : `/${p}`;
  return s.endsWith("/") ? s : `${s}/`;
}
