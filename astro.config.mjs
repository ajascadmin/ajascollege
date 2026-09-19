// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Static site → Cloudflare Pages (no adapter needed for pure SSG).
// Images: built-in Sharp service optimizes files under src/assets/ (not public/).
// Sitemap: regenerated on every `astro build` from all routes.
export default defineConfig({
  // The canonical host. Every canonical tag, Open Graph URL, sitemap entry and
  // RSS link is built from this — pointing it at the pages.dev preview tells
  // search engines the preview is the authoritative copy.
  site: "https://ajascollege.ac.in",
  trailingSlash: "always",
  build: {
    format: "directory",
    assets: "_astro",
  },
  integrations: [
    sitemap({
      // Skip CMS chrome and private-ish paths
      filter: (page) =>
        !page.includes("/admin") &&
        !page.includes("/pagefind"),
      changefreq: "weekly",
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
  image: {
    layout: "constrained",
    responsiveStyles: true,
    service: {
      entrypoint: "astro/assets/services/sharp",
      config: {
        limitInputPixels: false,
      },
    },
  },
  markdown: {
    syntaxHighlight: false,
  },
  vite: {
    server: {
      proxy: {},
    },
  },
});
