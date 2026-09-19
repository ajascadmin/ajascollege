import { getCollection } from "astro:content";

export interface ChildPageSummary {
  title: string;
  permalink: string;
  image?: string;
  blurb: string;
  /** Programme names pulled from a "Courses Offered" / "Programmes" section. */
  courses: string[];
}

/** Bullet items under a courses/programmes heading, for listing cards. */
function extractCourses(body: string, max = 4): string[] {
  const m = body.match(
    /^##\s*(?:courses?\s+offered|programmes?\s+offered|programmes?|courses?)\s*$([\s\S]*?)(?=^##\s|\Z)/im,
  );
  if (!m) return [];
  return (m[1].match(/^\s*[-*]\s+(.+)$/gm) || [])
    .map((l) => l.replace(/^\s*[-*]\s+/, "").replace(/[*_`]/g, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/** First real prose paragraph of a markdown body — skips headings, images, empty sections. */
function extractBlurb(body: string, maxLen = 150): string {
  const withoutImages = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const paragraphs = withoutImages
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#") && !p.startsWith("|") && !p.startsWith("["));
  const first = paragraphs[0] || "";
  const clean = first.replace(/[*_>]/g, "").replace(/\s+/g, " ").trim();
  return clean.length > maxLen ? clean.slice(0, maxLen - 2).replace(/\s+\S*$/, "") + "…" : clean;
}

/** All non-draft "pages" entries whose permalink sits directly under `prefix` (e.g. "/labs/"). */
export async function getChildPages(prefix: string): Promise<ChildPageSummary[]> {
  const allPages = await getCollection("pages", ({ data }) => !data.draft);
  return allPages
    .filter((p) => p.data.permalink.startsWith(prefix) && p.data.permalink !== prefix)
    .map((p) => {
      const body = (p as { body?: string }).body || "";
      return {
        title: p.data.title,
        permalink: p.data.permalink,
        image: "image" in p.data ? (p.data.image as string | undefined) : undefined,
        blurb: extractBlurb(body),
        courses: extractCourses(body),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
