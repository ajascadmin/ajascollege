/**
 * /admin/preview-samples.json — one real, published entry per collection.
 *
 * The CMS live preview (public/admin/cms-init.js) shows the actual page an
 * entry produces. A brand-new entry has no page yet, so the preview borrows a
 * sibling's page as a template and swaps the new entry's text and photos in.
 * This file tells it which page to borrow and what that page originally said.
 */
import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getPages } from "../../lib/content";

type Sample = { url: string; data: Record<string, unknown> };

function pick<T extends { body?: string; data: { image?: string; permalink?: string } }>(
  entries: T[],
): T | undefined {
  return (
    entries.find((e) => e.data.image && (e.body || "").length > 300) ??
    entries.find((e) => (e.body || "").length > 100) ??
    entries[0]
  );
}

function sample(e: { body?: string; data: Record<string, unknown> } | undefined): Sample | null {
  if (!e || typeof e.data.permalink !== "string") return null;
  return { url: e.data.permalink, data: { ...e.data, body: e.body ?? "" } };
}

export const GET: APIRoute = async () => {
  const live = <T extends { data: { draft?: boolean } }>(e: T) => !e.data.draft;
  const [news, events, faculty, programmes, pages] = await Promise.all([
    getCollection("news", live),
    getCollection("events", live),
    getCollection("faculty", live),
    getCollection("programmes", live),
    getPages(),
  ]);
  const body = {
    news: sample(pick(news)),
    events: sample(pick(events)),
    faculty: sample(pick(faculty)),
    programmes: sample(pick(programmes as never)),
    pages: sample(pick(pages.filter((p) => p.data.type === "page"))),
  };
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
