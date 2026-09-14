/**
 * Bridge CMS public URLs (/assets/uploads/...) → Astro ImageMetadata in src/assets/uploads.
 * Sveltia keeps writing paths like /assets/uploads/...; Astro optimizes from src/.
 */
import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

/** Lazy glob of every CMS image under src/assets/uploads */
const imageModules = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/uploads/**/*.{jpeg,jpg,png,gif,webp,avif,JPEG,JPG,PNG,GIF,WEBP,AVIF}",
);

const metaCache = new Map<string, ImageMetadata | null>();

/** Normalize CMS / public-style path to a glob key under /src/assets/uploads/ */
export function toSrcAssetPath(src: string | undefined | null): string | null {
  if (!src) return null;
  let p = src.trim();
  if (!p) return null;
  // strip origin if absolute same-site
  p = p.replace(/^https?:\/\/[^/]+/i, "");
  // decode and collapse
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  if (p.startsWith("./")) p = p.slice(1);
  if (!p.startsWith("/")) p = `/${p}`;

  // /assets/uploads/... → /src/assets/uploads/...
  if (p.startsWith("/assets/uploads/")) {
    return `/src/assets/uploads/${p.slice("/assets/uploads/".length)}`;
  }
  if (p.startsWith("/src/assets/uploads/")) return p;
  // already relative under uploads
  if (p.startsWith("/uploads/")) {
    return `/src/assets/uploads${p}`;
  }
  return null;
}

export async function resolveCmsImage(
  src: string | undefined | null,
): Promise<ImageMetadata | null> {
  const key = toSrcAssetPath(src);
  if (!key) return null;
  if (metaCache.has(key)) return metaCache.get(key) ?? null;

  const loader = imageModules[key];
  if (!loader) {
    // try case-insensitive match once
    const lower = key.toLowerCase();
    const found = Object.keys(imageModules).find((k) => k.toLowerCase() === lower);
    if (!found) {
      metaCache.set(key, null);
      return null;
    }
    const mod = await imageModules[found]();
    metaCache.set(key, mod.default);
    return mod.default;
  }
  try {
    const mod = await loader();
    metaCache.set(key, mod.default);
    return mod.default;
  } catch {
    metaCache.set(key, null);
    return null;
  }
}

export type OptimizePreset = "card" | "hero" | "poster" | "avatar" | "inline" | "logo";

const presets: Record<
  OptimizePreset,
  { widths: number[]; sizes: string; width: number; quality: number }
> = {
  card: {
    widths: [320, 480, 640, 800],
    sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px",
    width: 640,
    quality: 75,
  },
  hero: {
    widths: [640, 960, 1280, 1600],
    sizes: "100vw",
    width: 1280,
    quality: 78,
  },
  poster: {
    widths: [480, 720, 960, 1200],
    sizes: "(max-width: 768px) 100vw, 720px",
    width: 960,
    quality: 78,
  },
  avatar: {
    widths: [120, 200, 320, 400],
    sizes: "(max-width: 768px) 40vw, 200px",
    width: 320,
    quality: 78,
  },
  inline: {
    widths: [480, 720, 960, 1200],
    sizes: "(max-width: 768px) 100vw, 720px",
    width: 960,
    quality: 75,
  },
  logo: {
    widths: [160, 240, 320],
    sizes: "200px",
    width: 240,
    quality: 85,
  },
};

/** Build optimized src/srcset attributes via Astro getImage (Sharp). */
export async function optimizeCmsImage(
  src: string | undefined | null,
  preset: OptimizePreset = "inline",
): Promise<{
  src: string;
  srcset?: string;
  width: number;
  height: number;
  optimized: boolean;
} | null> {
  if (!src) return null;
  const meta = await resolveCmsImage(src);
  if (!meta) {
    // fallback: leave original public URL (PDF thumbs won't hit this; missing files keep path)
    return {
      src,
      width: 0,
      height: 0,
      optimized: false,
    };
  }

  const cfg = presets[preset];
  try {
    const maxW = Math.min(cfg.width, meta.width);
    const result = await getImage({
      src: meta,
      width: maxW,
      widths: cfg.widths.filter((w) => w <= meta.width),
      sizes: cfg.sizes,
      format: "webp",
      quality: cfg.quality,
      layout: "constrained",
    });
    const attrs = result.attributes as {
      width?: number | string;
      height?: number | string;
      srcset?: string;
    };
    return {
      src: result.src,
      srcset: result.srcSet?.attribute || attrs.srcset,
      width: Number(attrs.width) || maxW,
      height: Number(attrs.height) || Math.round((maxW / meta.width) * meta.height),
      optimized: true,
    };
  } catch {
    return {
      src: meta.src,
      width: meta.width,
      height: meta.height,
      optimized: false,
    };
  }
}

/**
 * Rewrite <img src="/assets/uploads/..."> and CSS background-image URLs
 * to optimized webp (Astro getImage / Sharp).
 */
export async function optimizeHtmlImages(
  html: string,
  preset: OptimizePreset = "inline",
): Promise<string> {
  if (!html) return html;
  const hasImg = /<img\b/i.test(html);
  const hasBg = /background-image\s*:\s*url\(/i.test(html);
  const hasLinkedCmsImage = /href\s*=\s*["']\/assets\/uploads\/[^"']+\.(?:jpe?g|png|gif|webp|avif)["']/i.test(html);
  if (!hasImg && !hasBg && !hasLinkedCmsImage) return html;

  let out = html;
  const srcMap = new Map<string, Awaited<ReturnType<typeof optimizeCmsImage>>>();

  async function ensure(rawSrc: string) {
    if (!toSrcAssetPath(rawSrc)) return null;
    if (!srcMap.has(rawSrc)) {
      srcMap.set(rawSrc, await optimizeCmsImage(rawSrc, preset));
    }
    return srcMap.get(rawSrc) ?? null;
  }

  // Gallery/lightbox anchors can survive after the markdown image itself has
  // been pulled into a structured gallery by splitSections(). Resolve those
  // links independently so they never point at unpublished src/ originals.
  if (hasLinkedCmsImage) {
    const hrefRe = /\bhref\s*=\s*["']([^"']+\.(?:jpe?g|png|gif|webp|avif))["']/gi;
    for (const m of html.matchAll(hrefRe)) await ensure(m[1]);
  }

  // ——— <img> tags ———
  if (hasImg) {
    const re = /<img\b([^>]*?)>/gi;
    const matches = [...html.matchAll(re)];
    for (const m of matches) {
      const srcM = m[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (srcM) await ensure(srcM[1]);
    }
    for (const m of matches) {
      const full = m[0];
      const attrs = m[1];
      const srcM = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
      if (!srcM) continue;
      const opt = srcMap.get(srcM[1]);
      if (!opt || !opt.optimized) continue;

      let next = attrs;
      next = next.replace(/\bsrc\s*=\s*["'][^"']+["']/i, `src="${opt.src}"`);
      if (opt.srcset) {
        if (/\bsrcset\s*=/i.test(next)) {
          next = next.replace(/\bsrcset\s*=\s*["'][^"']*["']/i, `srcset="${opt.srcset}"`);
        } else {
          next += ` srcset="${opt.srcset}"`;
        }
      }
      if (opt.width) {
        if (/\bwidth\s*=/i.test(next)) {
          next = next.replace(/\bwidth\s*=\s*["']?[\d.]+["']?/i, `width="${opt.width}"`);
        } else {
          next += ` width="${opt.width}"`;
        }
      }
      if (opt.height) {
        if (/\bheight\s*=/i.test(next)) {
          next = next.replace(/\bheight\s*=\s*["']?[\d.]+["']?/i, `height="${opt.height}"`);
        } else {
          next += ` height="${opt.height}"`;
        }
      }
      if (!/\bloading\s*=/i.test(next)) next += ` loading="lazy"`;
      if (!/\bdecoding\s*=/i.test(next)) next += ` decoding="async"`;
      if (!/\bsizes\s*=/i.test(next)) {
        next += ` sizes="${presets[preset].sizes}"`;
      }
      out = out.replace(full, `<img${next}>`);
    }

  }

  // Point every resolvable linked CMS image at its generated asset. This is
  // intentionally outside the <img> branch because structured page parsing
  // may remove the nested image while retaining its lightbox anchor.
  if (hasLinkedCmsImage || hasImg) {
    out = out.replace(/\bhref\s*=\s*(["'])([^"']+)\1/gi, (full, _q, href: string) => {
      const opt = srcMap.get(href);
      return opt?.optimized ? `href="${opt.src}"` : full;
    });
  }

  // ——— CSS background-image:url(...) (hero layers etc.) ———
  if (hasBg) {
    const bgRe = /background-image\s*:\s*url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    const bgMatches = [...out.matchAll(bgRe)];
    for (const m of bgMatches) {
      await ensure(m[2]);
    }
    out = out.replace(bgRe, (full, _q, url: string) => {
      const opt = srcMap.get(url);
      if (!opt || !opt.optimized) return full;
      return `background-image:url(${opt.src})`;
    });
  }

  return out;
}
