/**
 * Shared page-matching engine for the AJAS editing tools.
 *
 * Used by BOTH the CMS live preview (cms-init.js) and the on-page editor
 * (inline-editor.js). Given an entry's data and a rendered page, it finds
 * where each field's text and photos appear and tags those spots with
 * data-key-path="<field path>", so they can be updated or edited in place.
 * No markup is duplicated from the site, so it cannot drift from the design.
 */
(function () {
  function norm(s) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
  }
  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  /** Every leaf value of an object as [path, value] pairs: "items.0.title". */
  function leaves(obj, prefix, out) {
    out = out || [];
    if (obj == null) return out;
    if (Array.isArray(obj)) {
      obj.forEach(function (v, i) {
        leaves(v, prefix ? prefix + "." + i : String(i), out);
      });
    } else if (typeof obj === "object" && !(obj instanceof Date)) {
      Object.keys(obj).forEach(function (k) {
        leaves(obj[k], prefix ? prefix + "." + k : k, out);
      });
    } else {
      out.push([prefix, obj]);
    }
    return out;
  }
  /** Ways the site shortens text before showing it (see shortDept() in HomeSections.astro). */
  var DISPLAY_FORMS = [
    function (v) {
      return String(v).replace(/^(pg\s+)?department\s+of\s+/i, "").replace(/\s*&\s*/g, " & ");
    },
  ];
  var IMG_RE = /\.(jpe?g|png|webp|gif|avif|svg)$/i;
  var VIDEO_RE = /\.(mp4|webm|mov)$/i;
  function isLinkish(path, v) {
    var key = path.split(".").pop();
    return (
      /(^|_)(url|href|link|permalink|file|video|document|pdf|icon|style|type|level|category|frequency|pages)$/.test(key) ||
      /^(\/|https?:|mailto:|tel:|#|blob:)/.test(String(v))
    );
  }
  function stem(path) {
    var base = String(path).split("?")[0].split("/").pop() || "";
    return base.replace(/\.[a-z0-9]+$/i, "");
  }

  /** Markdown line → the plain text it renders to, roughly. */
  function mdPlain(line) {
    return norm(
      String(line)
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]+>/g, "")
        .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/, "")
        .replace(/(\*\*|__|~~|`)/g, "")
        .replace(/(^|\W)[*_](\S[^*_]*?)[*_](?=\W|$)/g, "$1$2")
        .replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1"),
    );
  }
  function mdUnits(md) {
    return String(md || "")
      .split(/\n/)
      .map(function (raw, index) {
        // index = line number in the body, so an edit can be written back
        return { raw: raw, plain: mdPlain(raw), index: index };
      })
      .filter(function (u) {
        return !/^\s*\|/.test(u.raw);
      })
      .filter(function (u) {
        return u.plain.length >= 3;
      });
  }


  function setPath(obj, path, value) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== "object") return false;
      cur = cur[parts[i]];
    }
    if (!(parts[parts.length - 1] in cur)) return false;
    cur[parts[parts.length - 1]] = value;
    return true;
  }

  var NOT_CHROME = "#footer, .ajn, [data-eb]";

  // ─── tagging the page ───────────────────────────────────────────────────

  function textNodes(root, skipSel) {
    var out = [];
    var w = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|svg|path)$/i.test(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest("[data-cms-t]")) return NodeFilter.FILTER_REJECT;
        // carousel clones (owl "loop") repeat the real slides
        if (p.closest(".owl-item.cloned")) return NodeFilter.FILTER_REJECT;
        if (skipSel && p.closest(skipSel)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var n;
    while ((n = w.nextNode())) out.push(n);
    return out;
  }

  /** Wrap occurrences of `value` inside `root` in tagged spans. */
  function tagText(root, skipSel, path, value, wholeOnly) {
    var found = [];
    var v = String(value);
    var nv = norm(v);
    if (nv.length < 2) return found;
    // Short values only claim a whole piece of text, never part of a longer
    // one ("Food Technology" must not grab half of "B.Sc. Food Technology").
    if (nv.length < 20) wholeOnly = true;
    textNodes(root, skipSel).forEach(function (node) {
      var doc = node.ownerDocument;
      var text = node.nodeValue;
      var idx = wholeOnly ? -1 : text.indexOf(v);
      if (idx === -1 && norm(text) === nv) {
        // same words, different spacing/line breaks — take the whole node
        var whole = doc.createElement("cms-t");
        whole.setAttribute("data-cms-t", "");
        whole.setAttribute("data-key-path", path);
        whole.textContent = text;
        node.parentNode.replaceChild(whole, node);
        found.push(whole);
        return;
      }
      while (idx !== -1) {
        var after = node.splitText(idx);
        node = after.splitText(v.length);
        var span = doc.createElement("cms-t");
        span.setAttribute("data-cms-t", "");
        span.setAttribute("data-key-path", path);
        after.parentNode.replaceChild(span, after);
        span.textContent = v;
        found.push(span);
        idx = node.nodeValue.indexOf(v);
      }
    });
    return found;
  }

  function tagImages(root, path, value) {
    var s = stem(value);
    if (s.length < 3) return [];
    var found = [];
    Array.prototype.forEach.call(root.querySelectorAll("img, video source, video"), function (el) {
      if (el.closest(".owl-item.cloned")) return;
      var hay = (el.getAttribute("src") || "") + " " + (el.getAttribute("srcset") || "") + " " + (el.getAttribute("data-src") || "");
      if (hay.indexOf(s) === -1) {
        try {
          if (decodeURIComponent(hay).indexOf(s) === -1) return;
        } catch (e) {
          return;
        }
      }
      found.push({
        el: el,
        // exact original path, when the page still uses it (videos, PDFs thumbs)
        full: (el.getAttribute("src") || "").replace(location.origin, ""),
        src: el.getAttribute("src"),
        srcset: el.getAttribute("srcset"),
        sizes: el.getAttribute("sizes"),
      });
    });
    return found;
  }

  /** Find the element holding the body text and tag its lines. */
  function tagBody(root, skipSel, body) {
    // Templates mark where the body goes with data-cms-body
    // (EntityArticle, ArticleShell, SmartPage, faculty bio).
    var marked = root.querySelector("[data-cms-body]");
    if (marked) root = marked;
    var units = mdUnits(body);
    var spans = [];
    if (!units.length) {
      if (!marked) return null;
      marked.setAttribute("data-key-path", "body");
      return { box: marked, units: units, spans: spans, html: marked.innerHTML, rerendered: false };
    }
    var nodes = textNodes(root, skipSel);
    units.forEach(function (u, i) {
      for (var k = 0; k < nodes.length; k++) {
        var n = nodes[k];
        if (n.parentNode && norm(n.nodeValue) === u.plain) {
          var span = n.ownerDocument.createElement("cms-t");
          span.setAttribute("data-cms-t", "");
          span.setAttribute("data-cms-line", String(i));
          n.parentNode.replaceChild(span, n);
          span.textContent = n.nodeValue;
          spans[i] = span;
          nodes.splice(k, 1);
          return;
        }
      }
    });
    var hits = spans.filter(Boolean);
    if (marked) {
      marked.setAttribute("data-key-path", "body");
      return { box: marked, units: units, spans: spans, html: marked.innerHTML, rerendered: false };
    }
    if (!hits.length) return null;
    // container = nearest ancestor holding every matched line
    var box = hits[0].parentElement;
    while (box && box !== root && !hits.every(function (h) { return box.contains(h); })) box = box.parentElement;
    if (!box) return null;
    // prefer a real content wrapper over a single paragraph
    while (box !== root && /^(P|LI|SPAN|STRONG|EM|A|H[1-6]|UL|OL|TD|TR|TBODY|TABLE)$/.test(box.tagName)) {
      box = box.parentElement;
    }
    box.setAttribute("data-key-path", "body");
    return { box: box, units: units, spans: spans, html: box.innerHTML, rerendered: false };
  }

  /**
   * Tag every text/photo field of `original` that appears inside `root`.
   * Returns { texts: {path: [el]}, images: {path: [rec]}, body }.
   */
  function tagEntry(root, skip, original) {
    var texts = {};
    var images = {};
    var pairs = leaves(original).filter(function (p) {
      return p[0] !== "body" && typeof p[1] === "string" && p[1].trim();
    });
    // Longest first, so a short value never claims part of a longer one.
    pairs.sort(function (a, b) {
      return String(b[1]).length - String(a[1]).length;
    });
    // Group fields that hold the same text ("Read full message" twice):
    // the page's copies are handed out to them in order.
    var groups = [];
    var byValue = {};
    pairs.forEach(function (p) {
      var path = p[0];
      var v = p[1];
      if (IMG_RE.test(v) || VIDEO_RE.test(v)) {
        // Several files can share a name (every department's
        // "Tile-Image.jpg"), so each photo field takes the next unclaimed
        // matching image on the page, in page order.
        var imgs = tagImages(root, path, v).filter(function (rec) {
          return !rec.el.hasAttribute("data-cms-img");
        });
        if (imgs.length) {
          var same = imgs.filter(function (rec) {
            return rec.full === v;
          });
          var mine = same.length ? same : [imgs[0]];
          mine.forEach(function (rec) {
            rec.el.setAttribute("data-cms-img", "");
            (rec.el.tagName === "SOURCE" ? rec.el.parentElement : rec.el).setAttribute("data-key-path", path);
          });
          images[path] = mine;
        }
        return;
      }
      if (isLinkish(path, v)) return;
      if (!byValue[v]) {
        byValue[v] = { value: v, paths: [] };
        groups.push(byValue[v]);
      }
      byValue[v].paths.push(path);
    });
    groups.forEach(function (g) {
      var spans = tagText(root, skip, g.paths[0], g.value);
      var x = -1;
      if (!spans.length) {
        // the site shows some text shortened — try those forms too
        for (var t = 0; t < DISPLAY_FORMS.length && !spans.length; t++) {
          var shown = DISPLAY_FORMS[t](g.value);
          if (shown !== g.value) {
            spans = tagText(root, skip, g.paths[0], shown, true);
            x = t;
          }
        }
      }
      if (!spans.length) return;
      spans.forEach(function (span, i) {
        var path = g.paths[Math.min(i, g.paths.length - 1)];
        span.setAttribute("data-key-path", path);
        if (x >= 0) span.setAttribute("data-cms-form", String(x));
        (texts[path] = texts[path] || []).push(span);
      });
      // a field whose copy wasn't found still counts as shown via its twin
      g.paths.forEach(function (path) {
        if (!texts[path]) texts[path] = [];
      });
    });
    return {
      texts: texts,
      images: images,
      body: typeof original.body === "string" ? tagBody(root, skip, original.body) : null,
    };
  }

  function stripWords(raw) {
    // the markdown "shape" of a line, without its words: "## ", "- **x** y" → "-****"
    return String(raw).replace(/[\p{L}\p{N}\s.,;:'"’“”!?()\-–—&/]+/gu, "");
  }
  function toggle(el, attr, on) {
    if (on) {
      if (!el.hasAttribute(attr)) el.setAttribute(attr, "");
    } else if (el.hasAttribute(attr)) el.removeAttribute(attr);
  }
  window.AjasLive = {
    norm: norm,
    getPath: getPath,
    setPath: setPath,
    leaves: leaves,
    DISPLAY_FORMS: DISPLAY_FORMS,
    IMG_RE: IMG_RE,
    VIDEO_RE: VIDEO_RE,
    isLinkish: isLinkish,
    stem: stem,
    mdPlain: mdPlain,
    mdUnits: mdUnits,
    textNodes: textNodes,
    tagText: tagText,
    tagImages: tagImages,
    tagBody: tagBody,
    tagEntry: tagEntry,
    stripWords: stripWords,
    toggle: toggle,
    NOT_CHROME: NOT_CHROME,
  };
})();
