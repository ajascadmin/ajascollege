import { getCollection, type CollectionEntry } from "astro:content";

export type AnyEntry =
  | CollectionEntry<"pages">
  | CollectionEntry<"news">
  | CollectionEntry<"events">
  | CollectionEntry<"faculty">;

/**
 * A page saved without a permalink gets one from its file path:
 * content/pages/labs/physics-lab.md → /labs/physics-lab/. Editors only type
 * a permalink when they want a URL that differs from the file name.
 */
export function fillPermalink<T extends { id: string; data: { permalink?: string } }>(
  entry: T,
): T & { data: { permalink: string } } {
  if (!entry.data.permalink || !entry.data.permalink.trim()) {
    entry.data.permalink = `/${entry.id.replace(/(^|\/)index$/, "")}/`.replace(/\/+/g, "/");
  }
  return entry as T & { data: { permalink: string } };
}

/** Non-draft pages, each with a permalink filled in. */
export async function getPages() {
  const pages = await getCollection("pages", ({ data }) => !data.draft);
  return pages.map(fillPermalink);
}

export async function getAllEntries(): Promise<AnyEntry[]> {
  const [pages, news, events, faculty] = await Promise.all([
    getPages(),
    getCollection("news", ({ data }) => !data.draft),
    getCollection("events", ({ data }) => !data.draft),
    getCollection("faculty", ({ data }) => !data.draft),
  ]);
  return [...pages, ...news, ...events, ...faculty];
}

export async function getEntryByPermalink(
  permalink: string,
): Promise<AnyEntry | undefined> {
  const normalized = normalizePermalink(permalink);
  const all = await getAllEntries();
  return all.find((e) => normalizePermalink(e.data.permalink) === normalized);
}

export function normalizePermalink(p: string | undefined): string {
  if (!p || p === "/") return "/";
  let s = p.startsWith("/") ? p : `/${p}`;
  if (!s.endsWith("/")) s += "/";
  return s;
}

/** Astro route path without trailing slash (except home). */
export function routeFromPermalink(permalink: string | undefined): string {
  const n = normalizePermalink(permalink);
  if (n === "/") return "/";
  return n.replace(/\/$/, "") || "/";
}
