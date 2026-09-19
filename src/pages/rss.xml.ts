import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

/**
 * News, events and notices as one feed.
 *
 * Written by hand rather than pulling in @astrojs/rss: the payload is thirty
 * lines of XML and this keeps the dependency list honest.
 */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://ajascollege.ac.in")).toString().replace(/\/$/, "");

  const [news, events, notices] = await Promise.all([
    getCollection("news", ({ data }) => !data.draft),
    getCollection("events", ({ data }) => !data.draft),
    getCollection("notices", ({ data }) => !data.draft),
  ]);

  const items = [
    ...news.map((e) => ({ ...e.data, kind: "News" })),
    ...events.map((e) => ({ ...e.data, kind: "Event" })),
    ...notices.map((e) => ({ ...e.data, kind: "Notice" })),
  ]
    .filter((e) => e.permalink)
    .sort((a, b) => (b.date ? +new Date(b.date) : 0) - (a.date ? +new Date(a.date) : 0))
    .slice(0, 40);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Al Jamia Arts &amp; Science College — news, events and notices</title>
    <link>${base}/</link>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Announcements, circulars and campus events from Al Jamia Arts &amp; Science College, Perinthalmanna.</description>
    <language>en-in</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items
  .map(
    (i) => `    <item>
      <title>${esc(`[${i.kind}] ${i.title}`)}</title>
      <link>${base}${i.permalink}</link>
      <guid isPermaLink="true">${base}${i.permalink}</guid>
      ${i.date ? `<pubDate>${new Date(i.date).toUTCString()}</pubDate>` : ""}
      ${i.description ? `<description>${esc(i.description)}</description>` : ""}
      <category>${esc(i.kind)}</category>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
