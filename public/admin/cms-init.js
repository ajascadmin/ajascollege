/**
 * AJAS branding + LIVE PAGE PREVIEW for Sveltia CMS.
 * Runs after sveltia-cms.js exposes window.CMS.
 *
 * ─── How the live preview works ───────────────────────────────────────────
 * The preview pane shows the REAL page the entry produces: it fetches the
 * published HTML of that page (same origin) together with its stylesheets, and
 * then, on every keystroke, swaps the editor's current text and photos into it.
 *
 * Nothing here copies the site's markup, so it can never drift from the real
 * design (the previous hand-built homepage preview did exactly that).
 *
 *  1. On load, every text and image value of the entry is looked up on the
 *     page. Each match is tagged with data-key-path="<field path>", which
 *     Sveltia uses for click-to-highlight: clicking anything on the page jumps
 *     to the field that controls it.
 *  2. On every edit, tagged text is replaced and tagged images get the new
 *     file. Changed spots are tinted yellow so the editor sees what moved.
 *  3. The body (Markdown) is updated line by line; if the structure changes
 *     too much it is re-rendered with `marked` inside the page's own content
 *     container, so it still picks up the site's typography.
 *  4. Anything that can't be shown live (new list items, switches, links) is
 *     counted in the banner: "N changes will appear after you save".
 *  5. A new entry has no page yet, so it borrows a sibling's page
 *     (/admin/preview-samples.json) and fills its fields in.
 */
(function () {
  var COLLEGE = "Al Jamia Arts & Science College";
  var TITLE = COLLEGE + " · CMS";

  function forceTitle() {
    if (document.title !== TITLE && document.title.indexOf("Sveltia") !== -1) {
      document.title = TITLE;
    } else if (!document.title || document.title === "Sveltia CMS") {
      document.title = TITLE;
    }
  }
  forceTitle();
  var titleEl = document.querySelector("title");
  if (titleEl && window.MutationObserver) {
    new MutationObserver(forceTitle).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
  setInterval(forceTitle, 1500);

  // Lets the live site know this browser belongs to an editor, so pages show
  // the "Edit this page" bar (src/components/EditorBar.astro). Not a security
  // boundary — the bar only links back here, and the CMS still needs a login.
  try {
    localStorage.setItem("ajas-cms-editor", "1");
  } catch (e) {
    /* private mode — the bar can still be opened with ?edit */
  }

  function whenCMS(cb) {
    if (window.CMS && typeof window.CMS.registerPreviewTemplate === "function" && window.createClass) {
      cb(window.CMS);
      return;
    }
    var n = 0;
    var id = setInterval(function () {
      n += 1;
      if (window.CMS && typeof window.CMS.registerPreviewTemplate === "function" && window.createClass) {
        clearInterval(id);
        cb(window.CMS);
      } else if (n > 150) {
        clearInterval(id);
      }
    }, 100);
  }

  // ─── small helpers ──────────────────────────────────────────────────────

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toJS(v) {
    return v && typeof v.toJS === "function" ? v.toJS() : v;
  }
  var A = window.AjasLive;
  var norm = A.norm, getPath = A.getPath, leaves = A.leaves, DISPLAY_FORMS = A.DISPLAY_FORMS;
  var IMG_RE = A.IMG_RE, VIDEO_RE = A.VIDEO_RE, isLinkish = A.isLinkish, mdUnits = A.mdUnits;
  var tagEntry = A.tagEntry, stripWords = A.stripWords, toggle = A.toggle, NOT_CHROME = A.NOT_CHROME;

  // ─── fetching ───────────────────────────────────────────────────────────

  var pageCache = {};
  function fetchPage(url) {
    if (!pageCache[url]) {
      pageCache[url] = fetch(url, { credentials: "same-origin", cache: "no-cache" })
        .then(function (r) {
          return r.ok ? r.text() : null;
        })
        .catch(function () {
          return null;
        });
    }
    return pageCache[url];
  }
  var samplesPromise;
  function samples() {
    if (!samplesPromise) {
      samplesPromise = fetch("/admin/preview-samples.json", { cache: "no-cache" })
        .then(function (r) {
          return r.ok ? r.json() : {};
        })
        .catch(function () {
          return {};
        });
    }
    return samplesPromise;
  }

  // ─── which page does an entry live on? ──────────────────────────────────

  var ROUTES = {
    news: { prefix: "/college-news/", sample: "news" },
    events: { prefix: "/event/", sample: "events" },
    faculty: { prefix: "/faculties/", sample: "faculty" },
    programmes: { prefix: "/programmes/", sample: "programmes" },
    pages: { pages: true, sample: "pages" },
    homepage: { url: "/", scope: "main" },
    prospectus: { url: "/prospectus-2026-27/", scope: "main" },
    footer: { url: "/", scope: "#footer", only: true },
    main_menu: { url: "/", scope: ".ajn", only: true },
    site: { url: "/", scope: "body", only: true },
    listings: { url: "/college-news/", scope: "main" },
  };

  function pageUrlFor(key, entry, data) {
    var r = ROUTES[key];
    if (r.url) return r.url;
    var slug = entry.get("slug");
    if (r.pages) {
      var p = data.permalink && String(data.permalink).trim();
      if (p) return p.charAt(0) === "/" ? p : "/" + p;
      return slug ? "/" + slug + "/" : null;
    }
    return slug ? r.prefix + slug + "/" : null;
  }

  // ─── the preview iframe's own <head> ────────────────────────────────────

  var PREVIEW_CSS =
    // Carousels and sliders are started by scripts that don't run here — lay
    // their slides out side by side so they are still visible and clickable.
    ".owl-carousel{display:flex!important;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory}" +
    ".owl-carousel>*{flex:0 0 min(86%,560px);scroll-snap-align:start}" +
    ".flexslider .slides>li{display:block!important}" +
    "#loading-overlay,[data-eb],[data-sp-root],.ajn-scrim,.ajn-drawer{display:none!important}" +
    "a[data-href]{cursor:pointer}" +
    "[data-key-path]{cursor:pointer;transition:outline-color .15s}" +
    "[data-key-path]:hover{outline:2px dashed rgba(179,36,43,.75);outline-offset:3px}" +
    "cms-t{display:inline;font:inherit;color:inherit;letter-spacing:inherit;text-transform:inherit}" +
    "[data-cms-changed]{background:rgba(255,214,0,.35)!important;box-shadow:0 0 0 3px rgba(255,214,0,.35)}" +
    "img[data-cms-changed]{outline:4px solid #ffd600;outline-offset:-4px}" +
    "[data-cms-placeholder]{opacity:.35}" +
    ".ajas-live-banner{position:sticky;top:0;z-index:2147483000;display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;" +
    "background:#0d2039;color:#fff;font:500 13px/1.45 system-ui,sans-serif;padding:9px 14px;box-shadow:0 2px 10px rgba(0,0,0,.25)}" +
    ".ajas-live-banner b{color:#ffd27a;font-weight:600}" +
    ".ajas-live-banner .warn{color:#ffd27a}" +
    ".ajas-live-msg{font:15px/1.5 system-ui,sans-serif;color:#334155;padding:40px 24px;text-align:center}";

  function injectHead(previewDoc, srcDoc) {
    var head = previewDoc.head;
    if (!head || head.querySelector("style[data-ajas-live-base]")) {
      // stylesheets already injected for an earlier page — add only new ones below
    }
    Array.prototype.forEach.call(srcDoc.head.querySelectorAll('link[rel="stylesheet"], style'), function (el) {
      var id = el.tagName === "LINK" ? el.getAttribute("href") : "s:" + el.textContent.length + ":" + el.textContent.slice(0, 80);
      if (!id) return;
      var exists = Array.prototype.some.call(head.querySelectorAll("[data-ajas-live]"), function (x) {
        return x.getAttribute("data-ajas-live") === id;
      });
      if (exists) return;
      var copy = previewDoc.createElement(el.tagName.toLowerCase());
      if (el.tagName === "LINK") {
        copy.rel = "stylesheet";
        copy.href = new URL(el.getAttribute("href"), location.origin).href;
        // Deferred stylesheets use media="print" + onload; load them normally.
      } else {
        copy.textContent = el.textContent;
      }
      copy.setAttribute("data-ajas-live", id);
      head.appendChild(copy);
    });
    if (!head.querySelector("style[data-ajas-live-base]")) {
      var s = previewDoc.createElement("style");
      s.setAttribute("data-ajas-live-base", "");
      s.textContent = PREVIEW_CSS;
      head.appendChild(s);
    }
  }

  // ─── the template ───────────────────────────────────────────────────────

  function makeLivePreview(key) {
    var route = ROUTES[key];
    return createClass({
      getInitialState: function () {
        return { status: "loading", message: "" };
      },
      componentDidMount: function () {
        this.load();
      },
      componentDidUpdate: function () {
        if (this.state.status === "ready") this.apply();
      },
      load: function () {
        var self = this;
        var entry = this.props.entry;
        var data = toJS(entry.get("data")) || {};
        var url = pageUrlFor(key, entry, data);
        var first = url ? fetchPage(url) : Promise.resolve(null);
        first
          .then(function (html) {
            if (html) return { html: html, url: url, original: data, borrowed: false };
            if (!route.sample) return null;
            return samples().then(function (all) {
              var s = all && all[route.sample];
              if (!s) return null;
              return fetchPage(s.url).then(function (h) {
                return h ? { html: h, url: s.url, original: s.data, borrowed: true } : null;
              });
            });
          })
          .then(function (res) {
            if (!self.host) return;
            if (!res) {
              self.setState({
                status: "error",
                message:
                  "This page isn't on the website yet, so there's nothing to preview. Save it, wait about 2 minutes for the site to update, then reopen it.",
              });
              return;
            }
            self.build(res);
            self.setState({ status: "ready" });
          });
      },
      build: function (res) {
        var previewDoc = this.props.document || this.host.ownerDocument;
        var src = new DOMParser().parseFromString(res.html, "text/html");
        injectHead(previewDoc, src);
        Array.prototype.forEach.call(
          src.body.querySelectorAll("script, noscript, [data-eb], [data-sp-root], #loading-overlay, dialog"),
          function (el) {
            el.remove();
          },
        );
        // Links must not navigate the preview away; clicks go to the editor.
        Array.prototype.forEach.call(src.body.querySelectorAll("a[href]"), function (a) {
          a.setAttribute("data-href", a.getAttribute("href"));
          a.removeAttribute("href");
          a.removeAttribute("target");
        });
        Array.prototype.forEach.call(src.body.querySelectorAll("form"), function (f) {
          f.removeAttribute("action");
          f.setAttribute("onsubmit", "return false");
        });
        Array.prototype.forEach.call(src.body.querySelectorAll('img[loading="lazy"]'), function (img) {
          img.removeAttribute("loading");
        });
        // relative URLs → absolute, the preview iframe may have another base
        Array.prototype.forEach.call(src.body.querySelectorAll("[src],[srcset]"), function (el) {
          var s = el.getAttribute("src");
          if (s && s.charAt(0) === "/") el.setAttribute("src", location.origin + s);
          var ss = el.getAttribute("srcset");
          if (ss) el.setAttribute("srcset", ss.replace(/(^|,\s*)\//g, "$1" + location.origin + "/"));
        });

        var host = this.host;
        host.innerHTML =
          '<div class="ajas-live-banner" data-ajas-banner></div>' + '<div data-ajas-page class="' + esc(src.body.className) + '"></div>';
        var pageEl = host.querySelector("[data-ajas-page]");
        pageEl.innerHTML = src.body.innerHTML;

        var root = route.scope ? pageEl.querySelector(route.scope) || pageEl : pageEl;
        if (route.scope === "body") root = pageEl;
        var skip = route.only ? null : NOT_CHROME;

        var original = res.original || {};
        var tagged = tagEntry(root, skip, original);
        this.live = {
          original: original,
          borrowed: res.borrowed,
          url: res.url,
          texts: tagged.texts,
          images: tagged.images,
          body: tagged.body,
          banner: host.querySelector("[data-ajas-banner]"),
        };
        this.apply();
      },
      apply: function () {
        var L = this.live;
        if (!L) return;
        var getAsset = this.props.getAsset;
        var data = toJS(this.props.entry.get("data")) || {};
        var pending = 0;

        Object.keys(L.texts).forEach(function (path) {
          var orig = getPath(L.original, path);
          var cur = getPath(data, path);
          cur = cur == null ? "" : String(cur);
          L.texts[path].forEach(function (span) {
            var showPlaceholder = L.borrowed && !cur.trim();
            var form = span.getAttribute("data-cms-form");
            var shown = form != null ? DISPLAY_FORMS[+form] : function (v) { return v; };
            var next = shown(showPlaceholder ? String(orig) : cur);
            if (span.textContent !== next) span.textContent = next;
            toggle(span, "data-cms-placeholder", showPlaceholder);
            toggle(span, "data-cms-changed", !showPlaceholder && cur !== String(orig));
          });
        });

        Object.keys(L.images).forEach(function (path) {
          var orig = getPath(L.original, path);
          var cur = getPath(data, path);
          L.images[path].forEach(function (rec) {
            var el = rec.el;
            if (cur && cur !== orig) {
              var url = assetUrl(getAsset, cur);
              if (el.getAttribute("src") !== url) {
                el.setAttribute("src", url);
                el.removeAttribute("srcset");
                el.removeAttribute("sizes");
                if (el.parentElement && el.parentElement.tagName === "PICTURE") {
                  Array.prototype.forEach.call(el.parentElement.querySelectorAll("source"), function (s) {
                    s.remove();
                  });
                }
                if (el.tagName === "SOURCE" && el.parentElement.load) el.parentElement.load();
              }
              toggle(el, "data-cms-changed", true);
            } else {
              if (rec.src != null && el.getAttribute("src") !== rec.src) {
                el.setAttribute("src", rec.src);
                if (rec.srcset) el.setAttribute("srcset", rec.srcset);
                if (rec.sizes) el.setAttribute("sizes", rec.sizes);
              }
              toggle(el, "data-cms-changed", false);
            }
          });
        });

        // Body (Markdown)
        var B = L.body;
        var curBody = typeof data.body === "string" ? data.body : "";
        var origBody = typeof L.original.body === "string" ? L.original.body : "";
        if (B) {
          if (curBody === origBody && !L.borrowed) {
            if (B.rerendered) {
              B.box.innerHTML = B.html;
              B.rerendered = false;
              B.spans = Array.prototype.slice.call(B.box.querySelectorAll("[data-cms-line]")).reduce(function (a, s) {
                a[+s.getAttribute("data-cms-line")] = s;
                return a;
              }, []);
            }
            B.spans.forEach(function (s, i) {
              if (s && s.textContent !== B.units[i].plain) s.textContent = B.units[i].plain;
              if (s) toggle(s, "data-cms-changed", false);
            });
          } else {
            var next = mdUnits(curBody);
            var lineByLine =
              !B.rerendered &&
              next.length === B.units.length &&
              next.every(function (u, i) {
                if (u.raw === B.units[i].raw) return true;
                // the line changed: OK only if it was tagged and only its words changed
                return !!B.spans[i] && u.plain !== B.units[i].plain && stripWords(u.raw) === stripWords(B.units[i].raw);
              });
            if (lineByLine) {
              next.forEach(function (u, i) {
                var s = B.spans[i];
                if (!s) return;
                if (s.textContent !== u.plain) s.textContent = u.plain;
                toggle(s, "data-cms-changed", u.raw !== B.units[i].raw);
              });
            } else if (window.marked && typeof window.marked.parse === "function") {
              B.box.innerHTML = window.marked.parse(curBody || "");
              Array.prototype.forEach.call(B.box.querySelectorAll("a[href]"), function (a) {
                a.setAttribute("data-href", a.getAttribute("href"));
                a.removeAttribute("href");
              });
              Array.prototype.forEach.call(B.box.querySelectorAll("img[src]"), function (im) {
                im.setAttribute("src", assetUrl(getAsset, im.getAttribute("src")));
              });
              B.rerendered = true;
            } else {
              pending++;
            }
          }
        } else if (curBody !== origBody) {
          pending++;
        }

        // Everything else that changed but has no spot on the page
        var seen = {};
        Object.keys(L.texts).concat(Object.keys(L.images)).forEach(function (p) {
          seen[p] = 1;
        });
        leaves(data).forEach(function (p) {
          var path = p[0];
          if (path === "body" || seen[path]) return;
          var o = getPath(L.original, path);
          if (L.borrowed && (o == null || o === "")) return;
          if (String(p[1] == null ? "" : p[1]) !== String(o == null ? "" : o)) {
            if (L.borrowed && isLinkish(path, p[1])) return;
            pending++;
          }
        });
        leaves(L.original).forEach(function (p) {
          if (!L.borrowed && getPath(data, p[0]) === undefined && p[0] !== "body") pending++;
        });

        var msg =
          "<span>👁 <b>Live preview</b> of " +
          (L.borrowed ? "how this new entry will look (using a similar page as a template)" : "<b>" + esc(L.url) + "</b>") +
          "</span><span>Click anything to jump to its field · yellow = changed, not saved yet</span>";
        if (pending > 0) {
          msg +=
            '<span class="warn">⏳ ' +
            pending +
            " change" +
            (pending === 1 ? "" : "s") +
            " (new items, links, switches) will appear on the page after you save.</span>";
        }
        if (L.banner.innerHTML !== msg) L.banner.innerHTML = msg;
      },
      render: function () {
        var self = this;
        var status = this.state.status;
        return h(
          "div",
          null,
          status !== "ready"
            ? h(
                "div",
                { className: "ajas-live-msg", style: { font: "15px/1.5 system-ui,sans-serif", color: "#334155", padding: "40px 24px", textAlign: "center" } },
                status === "loading" ? "Loading the real page…" : this.state.message,
              )
            : null,
          h("div", {
            ref: function (el) {
              self.host = el;
            },
          }),
        );
      },
    });
  }

  function assetUrl(getAsset, path) {
    if (!path) return "";
    try {
      var a = getAsset && getAsset(path);
      if (a && a.url) return a.url;
      if (a && String(a) !== "[object Object]") return String(a);
    } catch (e) {
      /* fall through */
    }
    return path.charAt(0) === "/" ? location.origin + path : path;
  }

  // ─── simple previews for things that have no page of their own ─────────

  var CARD =
    "font-family:'Libre Franklin',system-ui,sans-serif;color:#0d2039;max-width:760px;margin:24px auto;padding:0 18px";

  function fmtDate(v) {
    if (!v) return "";
    var d = new Date(v);
    return isNaN(d) ? String(v) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function makePopupPreview() {
  return createClass({
    render: function () {
      var d = toJS(this.props.entry.get("data")) || {};
      var src = assetUrl(this.props.getAsset, d.image);
      var today = new Date().toISOString().slice(0, 10);
      var start = d.start ? String(d.start).slice(0, 10) : "";
      var end = d.end ? String(d.end).slice(0, 10) : "";
      var state = !d.enabled
        ? ["#64748b", "Switched off — visitors don't see it."]
        : start && today < start
          ? ["#b45309", "Scheduled — starts showing on " + fmtDate(start) + "."]
          : end && today > end
            ? ["#64748b", "Finished — stopped showing after " + fmtDate(end) + "."]
            : ["#15803d", "Showing now" + (end ? " until " + fmtDate(end) : "") + "."];
      var where = d.pages === "all" ? "on every page" : "on the homepage";
      var often =
        d.frequency === "always" ? "every time a page loads" : d.frequency === "day" ? "once a day per visitor" : "once per visit";
      return h(
        "div",
        { style: { minHeight: "100vh", background: "rgba(8,20,38,.78)", padding: "28px 16px", boxSizing: "border-box" } },
        h(
          "p",
          {
            style: {
              margin: "0 auto 18px",
              maxWidth: "720px",
              background: "#fff",
              borderLeft: "5px solid " + state[0],
              padding: "10px 14px",
              font: "500 14px/1.45 system-ui,sans-serif",
              color: "#0d2039",
            },
          },
          h("b", { style: { color: state[0] } }, state[1]),
          " Appears " + where + ", " + often + ".",
        ),
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" } },
          src
            ? h("img", {
                src: src,
                alt: d.title || "",
                "data-key-path": "image",
                style: { maxWidth: "min(100%,720px)", maxHeight: "78vh", boxShadow: "0 24px 60px rgba(0,0,0,.45)", cursor: "pointer" },
              })
            : h(
                "div",
                {
                  "data-key-path": "image",
                  style: {
                    width: "min(100%,420px)",
                    aspectRatio: "1",
                    border: "2px dashed #94a3b8",
                    color: "#e2e8f0",
                    display: "grid",
                    placeItems: "center",
                    font: "15px system-ui",
                    cursor: "pointer",
                  },
                },
                "Upload a poster image",
              ),
          d.link && d.button_label
            ? h(
                "span",
                {
                  "data-key-path": "button_label",
                  style: {
                    background: "#b3242b",
                    color: "#fff",
                    padding: "12px 26px",
                    borderRadius: "999px",
                    font: "600 15px system-ui",
                    cursor: "pointer",
                  },
                },
                d.button_label + " →",
              )
            : null,
        ),
      );
    },
  });
  }

  function makeDocPreview(listUrl, listLabel) {
    return createClass({
      render: function () {
        var d = toJS(this.props.entry.get("data")) || {};
        var file = d.file ? assetUrl(this.props.getAsset, d.file) : "";
        var isPdf = /\.pdf($|\?)/i.test(String(d.file || "")) || (file.indexOf("blob:") === 0 && /pdf/i.test(String(d.file || "")));
        return h(
          "div",
          { style: { cssText: CARD } },
          h(
            "p",
            { style: { font: "500 13px system-ui", color: "#64748b", margin: "0 0 10px" } },
            "Shows as one row in the list on " + listUrl + " (" + listLabel + ")",
          ),
          h(
            "div",
            {
              style: {
                display: "flex",
                gap: "16px",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #e2e8f0",
                padding: "16px 18px",
                background: "#fff",
              },
            },
            h(
              "div",
              null,
              h("div", { "data-key-path": "title", style: { font: "600 18px 'Source Serif 4',Georgia,serif", cursor: "pointer" } }, d.title || "Title"),
              h(
                "div",
                { style: { font: "13px system-ui", color: "#64748b", marginTop: "4px" } },
                h("span", { "data-key-path": "date" }, fmtDate(d.date)),
                d.category ? h("span", { "data-key-path": "category" }, "  ·  " + d.category) : null,
                d.description ? h("div", { "data-key-path": "description", style: { marginTop: "4px" } }, d.description) : null,
              ),
            ),
            h(
              "span",
              {
                "data-key-path": "file",
                style: { background: "#0d2039", color: "#fff", padding: "9px 16px", font: "600 13px system-ui", whiteSpace: "nowrap", cursor: "pointer" },
              },
              file ? "Download ↓" : "No file yet",
            ),
          ),
          file && isPdf
            ? h(
                "div",
                null,
                h("p", { style: { font: "500 13px system-ui", color: "#64748b", margin: "22px 0 8px" } }, "The document visitors will open:"),
                h("iframe", { src: file, title: "PDF", style: { width: "100%", height: "75vh", border: "1px solid #e2e8f0", background: "#f8fafc" } }),
              )
            : file
              ? h("p", { style: { font: "14px system-ui", margin: "18px 0" } }, "File attached: " + String(d.file).split("/").pop())
              : h(
                  "p",
                  { style: { font: "14px system-ui", color: "#b45309", margin: "18px 0" } },
                  "Upload the PDF in the “PDF or document” field — it will appear here.",
                ),
        );
      },
    });
  }

  // ─── register ───────────────────────────────────────────────────────────

  whenCMS(function (CMS) {
    Object.keys(ROUTES).forEach(function (key) {
      try {
        CMS.registerPreviewTemplate(key, makeLivePreview(key));
      } catch (e) {
        console.warn("[AJAS CMS] preview template failed for " + key, e);
      }
    });
    try {
      CMS.registerPreviewTemplate("popups", makePopupPreview());
      CMS.registerPreviewTemplate("notices", makeDocPreview("/notices/", "Notices & downloads"));
      CMS.registerPreviewTemplate("fees", makeDocPreview("/fees/", "Fees & prospectus"));
    } catch (e) {
      console.warn("[AJAS CMS] preview template registration failed", e);
    }
  });
})();
