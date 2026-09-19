/**
 * SEO helpers.
 *
 * The site shipped with one boilerplate description repeated across 160 of its
 * 190 pages ("Al Jamia Arts & Science College, Perinthalmanna — affiliated to
 * the University of Calicut."). Search engines treat that as duplicate
 * metadata and write their own snippet instead, so the college loses control
 * of how every one of those pages is described in results.
 */

/** The boilerplate that was pasted into most frontmatter. */
const BOILERPLATE =
  /^al jamia arts (&|and) science college,? perinthalmanna\s*[—-]\s*affiliated to the university of calicut\.?$/i;

export const isBoilerplate = (d?: string) => !d || BOILERPLATE.test(d.trim());

/**
 * First real sentence(s) of a markdown body, trimmed to a length search
 * engines will actually show.
 */
export function describeFromBody(body: string, max = 165): string {
  const text = (body || "")
    .replace(/^---[\s\S]*?---/, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")          // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")        // links → their text
    .replace(/^#{1,6}\s+.*$/gm, "")                 // headings
    .replace(/^\s*\|.*$/gm, "")                     // table rows
    .replace(/<[^>]+>/g, " ")                       // raw html
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1).trim();
  return cut.replace(/\s+\S*$/, "").trim() + "…";
}

/** Page description: the author's, if they wrote a real one; else the body. */
export function pageDescription(opts: {
  frontmatter?: string;
  body?: string;
  fallback: string;
}): string {
  if (!isBoilerplate(opts.frontmatter)) return opts.frontmatter!.trim();
  const fromBody = describeFromBody(opts.body || "");
  return fromBody || opts.fallback;
}
