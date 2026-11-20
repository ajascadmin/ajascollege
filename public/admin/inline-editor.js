/**
 * AJAS on-page editor — edit text and photos directly on the live website.
 *
 * Loaded only when a staff member clicks "Edit on this page" in the editor
 * bar (src/components/EditorBar.astro); visitors never download it.
 *
 * How it works
 *  - The page lists the content files behind it in #ajas-cms-sources
 *    (BaseLayout.astro): the page's own file, the footer and contact details.
 *  - Each file is read fresh from GitHub and matched against the page with the
 *    same engine as the CMS live preview (live-core.js). Every match becomes
 *    editable: text in place, photos by clicking them.
 *  - "Save & publish" writes ALL changed files in a single commit through the
 *    GitHub API, using the login the CMS already stored in this browser
 *    (localStorage "sveltia-cms.user"). The normal deploy then rebuilds the
 *    site, exactly as if the change had been made in the CMS.
 *  - Before writing, each file is re-read at the latest commit and only the
 *    edited fields are changed, so edits made meanwhile in the CMS survive.
 *
 * Anything that isn't plain text or a photo (adding list items, links,
 * switches, formatted paragraphs) links to the full CMS editor instead.
 */
(function () {
  if (window.AjasInline) return;
  var A = window.AjasLive;
  var UI_SEL = ".aie-ui, [data-eb]";
  var JSY = function () {
    return window.jsyaml;
  };

  var state = {
    on: false,
    repo: null,
    branch: "main",
    sources: [], // {file, label, route, format, original, body, fm, tagged, changes:{path:val}, lines:{lineIndex:text}}
    uploads: {}, // repoPath -> {base64, file}
    toolbar: null,
    count: null,
  };

  // ─── GitHub ─────────────────────────────────────────────────────────────

  function token() {
    try {
      var u = JSON.parse(localStorage.getItem("sveltia-cms.user") || "null");
      if (u && u.token && (!u.backendName || u.backendName === "github")) return u.token;
    } catch (e) {
      /* ignore */
    }
    return null;
  }
  function gh(path, opts) {
    opts = opts || {};
    var headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token(),
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com" + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    }).then(function (r) {
      if (!r.ok) {
        return r.text().then(function (t) {
          var err = new Error("GitHub " + r.status + ": " + t.slice(0, 200));
          err.status = r.status;
          throw err;
        });
      }
      return r.status === 204 ? null : r.json();
    });
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  function readFile(path, ref) {
    return gh("/repos/" + state.repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(ref)).then(
      function (j) {
        return b64ToUtf8(j.content);
      },
    );
  }

  // ─── content files ──────────────────────────────────────────────────────

  var FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  function parse(file, text) {
    if (/\.json$/i.test(file)) {
      return { format: "json", data: JSON.parse(text), body: null, trailingNewline: /\n$/.test(text) };
    }
    var m = FM_RE.exec(text);
    if (!m) return { format: "md", data: {}, body: text, fm: "", edited: [] };
    var data = JSY().load(m[1], { schema: JSY().JSON_SCHEMA }) || {};
    return { format: "md", data: data, body: m[2], fm: m[1], edited: [] };
  }
  /**
   * Front matter is rewritten surgically: a changed top-level text field
   * replaces just its own line (as a JSON string, which is valid YAML), so
   * the rest of the file keeps its exact formatting. Only a change nested in
   * a list (e.g. a person's role) falls back to re-writing the front matter.
   */
  function serialize(parsed) {
    if (parsed.format === "json") return JSON.stringify(parsed.data, null, 2) + (parsed.trailingNewline === false ? "" : "\n");
    var fm = parsed.fm;
    var ok = parsed.edited.every(function (path) {
      if (path.indexOf(".") !== -1) return false;
      var re = new RegExp("^" + path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ":[ \\t]*(\"(?:[^\"\\\\]|\\\\.)*\"|'(?:[^']|'')*'|[^\\n]*)$", "m");
      if (!re.test(fm)) return false;
      fm = fm.replace(re, function () {
        return path + ": " + JSON.stringify(String(parsed.data[path]));
      });
      return true;
    });
    if (!ok) fm = JSY().dump(parsed.data, { schema: JSY().JSON_SCHEMA, lineWidth: -1, noRefs: true, quotingType: '"' }).replace(/\n$/, "");
    return "---\n" + fm + "\n---\n" + (parsed.body || "");
  }
  function withBody(parsed) {
    var o = JSON.parse(JSON.stringify(parsed.data));
    if (parsed.body != null) o.body = parsed.body;
    return o;
  }

  // ─── markdown lines ─────────────────────────────────────────────────────

  var PREFIX_RE = /^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)?/;
  /** A line can be typed over directly when it has no inline formatting. */
  function simpleLine(raw) {
    var prefix = (PREFIX_RE.exec(raw) || [""])[0];
    var rest = raw.slice(prefix.length);
    return !/[*_`\[\]<>\\|]/.test(rest) && A.norm(rest) === A.mdPlain(raw);
  }
  function replaceLine(raw, text) {
    var prefix = (PREFIX_RE.exec(raw) || [""])[0];
    return prefix + text.replace(/\s+/g, " ").trim();
  }

  // ─── UI ─────────────────────────────────────────────────────────────────

  var CSS =
    "html.aie-on [data-aie-edit]{outline:2px dashed rgba(179,36,43,.55);outline-offset:2px;cursor:text;border-radius:2px}" +
    "html.aie-on [data-aie-edit]:hover{outline-color:#b3242b;background:rgba(179,36,43,.06)}" +
    "html.aie-on [data-aie-edit]:focus{outline:2px solid #b3242b;background:#fff;color:#0d2039!important;-webkit-text-fill-color:#0d2039;box-shadow:0 0 0 4px rgba(179,36,43,.15)}" +
    "html.aie-on [data-aie-dirty]{background:rgba(255,214,0,.35)!important}" +
    "html.aie-on img[data-aie-img]{outline:3px dashed rgba(179,36,43,.6);outline-offset:-3px;cursor:pointer}" +
    "html.aie-on img[data-aie-img]:hover{outline-color:#b3242b;filter:brightness(.85)}" +
    "html.aie-on img[data-aie-dirty]{outline:4px solid #ffd600}" +
    "html.aie-on [data-aie-locked]{outline:2px dotted rgba(100,116,139,.6);outline-offset:2px;cursor:help}" +
    "html.aie-on{scroll-padding-top:70px}" +
    "html.aie-on body{padding-top:58px!important}" +
    ".aie-ui{font:500 14px/1.35 'Libre Franklin',system-ui,sans-serif;color:#0d2039;box-sizing:border-box}" +
    ".aie-ui *{box-sizing:border-box}" +
    ".aie-bar{position:fixed;top:0;left:0;right:0;z-index:2147483600;display:flex;align-items:center;gap:10px;flex-wrap:wrap;" +
    "min-height:58px;padding:8px 16px;background:#0d2039;color:#fff;box-shadow:0 4px 18px rgba(0,0,0,.3)}" +
    ".aie-bar .aie-title{font-weight:700;white-space:nowrap}" +
    ".aie-bar .aie-help{color:rgba(255,255,255,.7);font-size:13px;flex:1 1 260px;min-width:0}" +
    ".aie-bar .aie-count{color:#ffd27a;font-weight:600;white-space:nowrap}" +
    ".aie-btn{appearance:none;border:0;border-radius:999px;padding:9px 16px;font:600 14px/1 inherit;font-family:inherit;cursor:pointer;" +
    "text-transform:none;letter-spacing:0;line-height:1.1;white-space:nowrap;text-decoration:none;display:inline-flex;align-items:center;gap:6px}" +
    ".aie-save{background:#b3242b;color:#fff}.aie-save:hover{background:#8f1c22}.aie-save[disabled]{opacity:.45;cursor:default}" +
    ".aie-ghost{background:rgba(255,255,255,.12);color:#fff!important}.aie-ghost:hover{background:rgba(255,255,255,.22)}" +
    ".aie-tip{position:absolute;z-index:2147483601;max-width:300px;background:#fff;border-radius:10px;padding:10px 12px;" +
    "box-shadow:0 10px 30px rgba(13,32,57,.3);font-size:13px}" +
    ".aie-tip a{color:#b3242b!important;font-weight:600}" +
    ".aie-photo{position:absolute;z-index:2147483601;pointer-events:none;background:#b3242b;color:#fff;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.3)}" +
    ".aie-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483602;background:#0d2039;color:#fff;" +
    "border-radius:12px;padding:12px 18px;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:calc(100vw - 32px)}" +
    ".aie-toast.err{background:#8f1c22}" +
    ".aie-modal{position:fixed;inset:0;z-index:2147483603;background:rgba(8,20,38,.6);display:grid;place-items:center;padding:16px}" +
    ".aie-card{background:#fff;border-radius:14px;padding:22px;max-width:420px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.35)}" +
    ".aie-card h3{margin:0 0 8px;font:700 19px/1.3 'Source Serif 4',Georgia,serif;color:#0d2039}" +
    ".aie-card p{margin:0 0 16px;color:#475569}" +
    ".aie-card .aie-row{display:flex;gap:8px;flex-wrap:wrap}" +
    ".aie-card .aie-ghost{background:#eef2f7;color:#0d2039!important}" +
    "@media (max-width:700px){.aie-bar .aie-help{display:none}html.aie-on body{padding-top:96px!important}}";

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      e.setAttribute(k, attrs[k]);
    });
    if (html != null) e.innerHTML = html;
    return e;
  }
  function toast(msg, isErr, ms) {
    var t = el("div", { class: "aie-ui aie-toast" + (isErr ? " err" : ""), role: "status" }, msg);
    document.body.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, ms || 6000);
  }
  function modal(title, text, buttons) {
    var m = el("div", { class: "aie-ui aie-modal" });
    var c = el("div", { class: "aie-card", role: "dialog", "aria-modal": "true" });
    c.appendChild(el("h3", {}, title));
    c.appendChild(el("p", {}, text));
    var row = el("div", { class: "aie-row" });
    buttons.forEach(function (b) {
      var x = el(b.href ? "a" : "button", b.href ? { href: b.href, target: "_blank", class: "aie-btn " + (b.primary ? "aie-save" : "aie-ghost") } : { type: "button", class: "aie-btn " + (b.primary ? "aie-save" : "aie-ghost") }, b.label);
      x.addEventListener("click", function () {
        if (b.onClick) b.onClick();
        if (!b.keepOpen) m.remove();
      });
      row.appendChild(x);
    });
    c.appendChild(row);
    m.appendChild(c);
    document.body.appendChild(m);
    return m;
  }

  function buildToolbar() {
    var bar = el("div", { class: "aie-ui aie-bar", role: "toolbar", "aria-label": "Page editor" });
    bar.innerHTML =
      '<span class="aie-title">✎ Editing this page</span>' +
      '<span class="aie-help">Click any outlined text and type · click a photo to replace it · yellow = not saved yet</span>' +
      '<span class="aie-count" data-aie-count></span>' +
      '<button type="button" class="aie-btn aie-save" data-aie-save disabled>Save &amp; publish</button>' +
      '<button type="button" class="aie-btn aie-ghost" data-aie-undo hidden>Undo all</button>' +
      '<a class="aie-btn aie-ghost" data-aie-cms target="ajas-cms">More options ↗</a>' +
      '<button type="button" class="aie-btn aie-ghost" data-aie-exit>Done</button>';
    document.body.appendChild(bar);
    state.toolbar = bar;
    state.count = bar.querySelector("[data-aie-count]");
    var main = state.sources[0];
    var cms = bar.querySelector("[data-aie-cms]");
    cms.href = "/admin/#/" + (main && main.route ? main.route : "");
    cms.title = "Open the full editor for lists, links, switches and formatted text";
    bar.querySelector("[data-aie-save]").addEventListener("click", save);
    bar.querySelector("[data-aie-undo]").addEventListener("click", function () {
      modal("Undo all changes?", "Everything you changed since the last save goes back to how it was.", [
        { label: "Undo all", primary: true, onClick: undoAll },
        { label: "Keep editing" },
      ]);
    });
    bar.querySelector("[data-aie-exit]").addEventListener("click", function () {
      if (dirtyCount()) {
        modal("You have unsaved changes", "Save them before you stop editing?", [
          { label: "Save & publish", primary: true, onClick: save },
          {
            label: "Discard",
            onClick: function () {
              undoAll();
              stop();
            },
          },
          { label: "Keep editing" },
        ]);
      } else stop();
    });
  }

  function dirtyCount() {
    var n = Object.keys(state.uploads).length ? 0 : 0;
    state.sources.forEach(function (s) {
      n += Object.keys(s.changes).length + Object.keys(s.lines).length;
    });
    return n;
  }
  function refreshCount() {
    var n = dirtyCount();
    state.count.textContent = n ? n + " unsaved change" + (n === 1 ? "" : "s") : "";
    state.toolbar.querySelector("[data-aie-save]").disabled = !n;
    state.toolbar.querySelector("[data-aie-undo]").hidden = !n;
  }

  // ─── making the page editable ───────────────────────────────────────────

  function rootsFor(src) {
    if (src.scope === "body") return [document.body];
    return Array.prototype.slice.call(document.querySelectorAll(src.scope));
  }

  function setup(src, idx) {
    var skip = src.only ? UI_SEL : A.NOT_CHROME + ", " + UI_SEL;
    src.tagged = { texts: {}, images: {}, body: null };
    rootsFor(src).forEach(function (root) {
      var t = A.tagEntry(root, skip, src.original);
      Object.keys(t.texts).forEach(function (p) {
        src.tagged.texts[p] = (src.tagged.texts[p] || []).concat(t.texts[p]);
      });
      Object.keys(t.images).forEach(function (p) {
        src.tagged.images[p] = (src.tagged.images[p] || []).concat(t.images[p]);
      });
      if (t.body && !src.tagged.body) src.tagged.body = t.body;
    });

    // text fields
    Object.keys(src.tagged.texts).forEach(function (path) {
      src.tagged.texts[path].forEach(function (span) {
        var origFull = String(A.getPath(src.original, path));
        var origShown = span.textContent;
        span.setAttribute("data-aie-src", String(idx));
        makeEditable(span, function (typed) {
          // the site may show a shortened form ("Commerce" for
          // "Department of Commerce"): put the typed words back into the full value
          var full = origShown === origFull ? typed : origFull.replace(origShown, typed);
          if (full === origFull) delete src.changes[path];
          else src.changes[path] = full;
          src.tagged.texts[path].forEach(function (other) {
            if (other !== span && other.textContent !== typed) other.textContent = typed;
            A.toggle(other, "data-aie-dirty", full !== origFull);
          });
          A.toggle(span, "data-aie-dirty", full !== origFull);
          refreshCount();
        });
      });
    });

    // photos
    Object.keys(src.tagged.images).forEach(function (path) {
      src.tagged.images[path].forEach(function (rec) {
        var img = rec.el.tagName === "SOURCE" ? null : rec.el;
        if (!img || img.tagName !== "IMG") return;
        img.setAttribute("data-aie-img", "");
        img.addEventListener("click", function (e) {
          if (!state.on) return;
          e.preventDefault();
          e.stopPropagation();
          pickPhoto(src, path);
        }, true);
      });
    });

    // body lines
    var B = src.tagged.body;
    if (B) {
      B.spans.forEach(function (span, i) {
        if (!span) return;
        var unit = B.units[i];
        if (simpleLine(unit.raw)) {
          makeEditable(span, function (typed) {
            var orig = A.norm(unit.plain);
            if (A.norm(typed) === orig) delete src.lines[unit.index];
            else src.lines[unit.index] = { raw: unit.raw, text: typed };
            A.toggle(span, "data-aie-dirty", A.norm(typed) !== orig);
            refreshCount();
          });
        }
      });
      // everything else in the body: explain and link to the full editor
      B.box.addEventListener("click", function (e) {
        if (!state.on || e.target.closest("[data-aie-edit]")) return;
        e.preventDefault();
        tip(e, src, "This part has formatting (bold, links, lists or a table), so it's edited in the full editor.");
      });
      B.box.setAttribute("data-aie-locked", "");
    }
  }

  function makeEditable(span, onChange) {
    span.setAttribute("data-aie-edit", "");
    span.setAttribute("tabindex", "0");
    span.setAttribute("spellcheck", "true");
    try {
      span.contentEditable = "plaintext-only";
      if (span.contentEditable !== "plaintext-only") throw 0;
    } catch (e) {
      span.contentEditable = "true";
    }
    span.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        span.blur();
      }
      if (e.key === "Escape") span.blur();
    });
    span.addEventListener("paste", function (e) {
      if (span.contentEditable === "plaintext-only") return;
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, text.replace(/\s+/g, " "));
    });
    span.addEventListener("input", function () {
      onChange(span.textContent);
    });
    span.__aieOrig = span.textContent;
  }

  function tip(e, src, text) {
    closeTip();
    var t = el(
      "div",
      { class: "aie-ui aie-tip", "data-aie-tip": "" },
      esc(text) + ' <a href="/admin/#/' + esc(src.route || "") + '" target="ajas-cms">Open full editor ↗</a>',
    );
    document.body.appendChild(t);
    var x = Math.min(e.pageX, window.scrollX + document.documentElement.clientWidth - 320);
    t.style.left = Math.max(window.scrollX + 8, x) + "px";
    t.style.top = e.pageY + 14 + "px";
  }
  function closeTip() {
    var t = document.querySelector("[data-aie-tip]");
    if (t) t.remove();
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ─── photos ─────────────────────────────────────────────────────────────

  function slugFile(name) {
    var dot = name.lastIndexOf(".");
    var base = (dot > 0 ? name.slice(0, dot) : name)
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "photo";
    var ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "jpg";
    return base + "-" + Date.now().toString(36) + "." + ext;
  }

  function pickPhoto(src, path) {
    var input = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/gif" });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        toast("That photo is " + (file.size / 1048576).toFixed(1) + " MB — please use one under 8 MB.", true);
        return;
      }
      var d = new Date();
      var folder = d.getFullYear() + "/" + String(d.getMonth() + 1).padStart(2, "0");
      var name = slugFile(file.name);
      var repoPath = "src/assets/uploads/" + folder + "/" + name;
      var publicPath = "/assets/uploads/" + folder + "/" + name;
      var reader = new FileReader();
      reader.onload = function () {
        var prev = src.changes[path];
        if (prev && state.uploads[prev.repoPath]) delete state.uploads[prev.repoPath];
        state.uploads[repoPath] = { base64: String(reader.result).split(",")[1] };
        src.changes[path] = publicPath;
        src.uploadFor = src.uploadFor || {};
        src.uploadFor[path] = repoPath;
        var url = URL.createObjectURL(file);
        src.tagged.images[path].forEach(function (rec) {
          var img = rec.el;
          if (img.tagName !== "IMG") return;
          img.src = url;
          img.removeAttribute("srcset");
          img.removeAttribute("sizes");
          if (img.parentElement && img.parentElement.tagName === "PICTURE") {
            Array.prototype.forEach.call(img.parentElement.querySelectorAll("source"), function (s) {
              s.remove();
            });
          }
          A.toggle(img, "data-aie-dirty", true);
        });
        refreshCount();
      };
      reader.readAsDataURL(file);
    });
    input.click();
  }

  // ─── links and hover badges while editing ───────────────────────────────

  function onClickCapture(e) {
    if (!state.on) return;
    if (e.target.closest(UI_SEL + ", .aie-tip")) return;
    if (!e.target.closest(".aie-tip")) closeTip();
    var a = e.target.closest("a[href]");
    if (a) {
      // links don't navigate while editing — the text inside may be editable
      e.preventDefault();
    }
    var editable = e.target.closest("[data-aie-edit]");
    if (editable) return;
    var img = e.target.closest("img[data-aie-img]");
    if (img) return;
    // clicked something that came from content but isn't editable here
    var tagged = e.target.closest("[data-key-path]");
    if (tagged && !tagged.hasAttribute("data-aie-edit")) {
      var src = state.sources[+(tagged.getAttribute("data-aie-src") || 0)] || state.sources[0];
      if (tagged.closest("[data-aie-locked]")) return; // body handler shows its own tip
      e.preventDefault();
      tip(e, src, "This is a link, list or setting — change it in the full editor.");
    }
  }
  var badge;
  function onOver(e) {
    if (!state.on) return;
    var img = e.target.closest && e.target.closest("img[data-aie-img]");
    if (!img) {
      if (badge) badge.style.display = "none";
      return;
    }
    if (!badge) {
      badge = el("div", { class: "aie-ui aie-photo" }, "📷 Click to replace photo");
      document.body.appendChild(badge);
    }
    var r = img.getBoundingClientRect();
    badge.style.display = "block";
    badge.style.left = window.scrollX + r.left + 10 + "px";
    badge.style.top = window.scrollY + r.top + 10 + "px";
  }
  function beforeUnload(e) {
    if (state.on && dirtyCount()) {
      e.preventDefault();
      e.returnValue = "";
    }
  }

  // ─── saving ─────────────────────────────────────────────────────────────

  function save() {
    if (!dirtyCount()) return;
    if (!token()) return needLogin();
    var btn = state.toolbar.querySelector("[data-aie-save]");
    btn.disabled = true;
    btn.textContent = "Saving…";
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    commit(0)
      .then(function (res) {
        // the saved values become the new starting point
        state.sources.forEach(function (s) {
          Object.keys(s.changes).forEach(function (p) {
            A.setPath(s.original, p, s.changes[p]);
          });
          s.changes = {};
          s.lines = {};
          if (res.bodies[s.file] != null) s.original.body = res.bodies[s.file];
        });
        state.uploads = {};
        Array.prototype.forEach.call(document.querySelectorAll("[data-aie-dirty]"), function (x) {
          x.removeAttribute("data-aie-dirty");
        });
        try {
          sessionStorage.setItem("ajas-inline-saved", String(Date.now()));
        } catch (e) {}
        toast(
          "✓ Saved. The website updates for everyone in about 2–3 minutes." +
            (res.skipped.length ? "<br><small>Skipped (changed elsewhere meanwhile): " + esc(res.skipped.join(", ")) + "</small>" : ""),
          false,
          9000,
        );
      })
      .catch(function (err) {
        console.error("[AJAS editor] save failed", err);
        if (err.status === 401) needLogin(true);
        else toast("Couldn't save: " + esc(err.message) + "<br><small>Your changes are still here — try again.</small>", true, 12000);
      })
      .then(function () {
        btn.textContent = "Save & publish";
        refreshCount();
      });
  }

  function commit(attempt) {
    var repo = "/repos/" + state.repo;
    var headSha, baseTree;
    var skipped = [];
    var bodies = {};
    return gh(repo + "/git/ref/heads/" + encodeURIComponent(state.branch))
      .then(function (ref) {
        headSha = ref.object.sha;
        return gh(repo + "/git/commits/" + headSha);
      })
      .then(function (c) {
        baseTree = c.tree.sha;
        var changed = state.sources.filter(function (s) {
          return Object.keys(s.changes).length || Object.keys(s.lines).length;
        });
        return Promise.all(
          changed.map(function (s) {
            return readFile(s.file, headSha).then(function (text) {
              var parsed = parse(s.file, text);
              Object.keys(s.changes).forEach(function (path) {
                var target = path === "body" ? null : parsed.data;
                if (!target || !A.setPath(target, path, s.changes[path])) skipped.push(s.label + " → " + path);
                else if (parsed.edited) parsed.edited.push(path);
              });
              var lineKeys = Object.keys(s.lines);
              if (lineKeys.length) {
                var lines = String(parsed.body || "").split("\n");
                lineKeys.forEach(function (k) {
                  var edit = s.lines[k];
                  if (lines[+k] === edit.raw) lines[+k] = replaceLine(edit.raw, edit.text);
                  else skipped.push(s.label + " → a paragraph");
                });
                parsed.body = lines.join("\n");
                bodies[s.file] = parsed.body;
              }
              return { path: s.file, content: serialize(parsed) };
            });
          }),
        );
      })
      .then(function (files) {
        var blobs = files.map(function (f) {
          return gh(repo + "/git/blobs", { method: "POST", body: { content: f.content, encoding: "utf-8" } }).then(function (b) {
            return { path: f.path, sha: b.sha };
          });
        });
        Object.keys(state.uploads).forEach(function (p) {
          blobs.push(
            gh(repo + "/git/blobs", { method: "POST", body: { content: state.uploads[p].base64, encoding: "base64" } }).then(function (b) {
              return { path: p, sha: b.sha };
            }),
          );
        });
        return Promise.all(blobs);
      })
      .then(function (items) {
        return gh(repo + "/git/trees", {
          method: "POST",
          body: {
            base_tree: baseTree,
            tree: items.map(function (i) {
              return { path: i.path, mode: "100644", type: "blob", sha: i.sha };
            }),
          },
        });
      })
      .then(function (tree) {
        var labels = state.sources
          .filter(function (s) {
            return Object.keys(s.changes).length || Object.keys(s.lines).length;
          })
          .map(function (s) {
            return s.file.split("/").pop();
          });
        return gh(repo + "/git/commits", {
          method: "POST",
          body: {
            message: "Edit " + labels.join(", ") + " on " + location.pathname + " (on-page editor)",
            tree: tree.sha,
            parents: [headSha],
          },
        });
      })
      .then(function (c) {
        return gh(repo + "/git/refs/heads/" + encodeURIComponent(state.branch), { method: "PATCH", body: { sha: c.sha } });
      })
      .then(function () {
        return { skipped: skipped, bodies: bodies };
      })
      .catch(function (err) {
        // someone else committed in between — start over on top of theirs
        if (err.status === 422 && attempt < 2) return commit(attempt + 1);
        throw err;
      });
  }

  function undoAll() {
    state.sources.forEach(function (s) {
      Object.keys(s.tagged.texts).forEach(function (path) {
        s.tagged.texts[path].forEach(function (span) {
          if (span.__aieOrig != null) span.textContent = span.__aieOrig;
          span.removeAttribute("data-aie-dirty");
        });
      });
      Object.keys(s.tagged.images).forEach(function (path) {
        s.tagged.images[path].forEach(function (rec) {
          if (rec.el.tagName !== "IMG") return;
          if (rec.src) rec.el.setAttribute("src", rec.src);
          if (rec.srcset) rec.el.setAttribute("srcset", rec.srcset);
          if (rec.sizes) rec.el.setAttribute("sizes", rec.sizes);
          rec.el.removeAttribute("data-aie-dirty");
        });
      });
      if (s.tagged.body) {
        s.tagged.body.spans.forEach(function (span) {
          if (span && span.__aieOrig != null) {
            span.textContent = span.__aieOrig;
            span.removeAttribute("data-aie-dirty");
          }
        });
      }
      s.changes = {};
      s.lines = {};
    });
    state.uploads = {};
    refreshCount();
  }

  // ─── start / stop ───────────────────────────────────────────────────────

  function needLogin(expired) {
    modal(
      expired ? "Please sign in again" : "Sign in to edit",
      (expired ? "Your editing login has expired. " : "") +
        "Sign in to the CMS once in another tab, then come back here — editing starts automatically.",
      [{ label: "Open sign-in ↗", primary: true, href: "/admin/" }, { label: "Cancel" }],
    );
    var onStorage = function (e) {
      if (e.key === "sveltia-cms.user" && token()) {
        window.removeEventListener("storage", onStorage);
        Array.prototype.forEach.call(document.querySelectorAll(".aie-modal"), function (m) {
          m.remove();
        });
        if (!state.on) start();
        else toast("Signed in — you can save now.");
      }
    };
    window.addEventListener("storage", onStorage);
  }

  function start() {
    if (state.on) return Promise.resolve();
    if (!token()) {
      needLogin();
      return Promise.resolve();
    }
    var srcEl = document.getElementById("ajas-cms-sources");
    var list = [];
    try {
      list = JSON.parse(srcEl ? srcEl.textContent : "[]");
    } catch (e) {}
    if (!list.length) {
      toast("This page can't be edited here — use the CMS.", true);
      return Promise.resolve();
    }
    toast("Loading the editor…", false, 2500);
    return fetch("/admin/config.yml", { cache: "no-cache" })
      .then(function (r) {
        return r.text();
      })
      .then(function (yml) {
        var cfg = JSY().load(yml) || {};
        state.repo = cfg.backend && cfg.backend.repo;
        state.branch = (cfg.backend && cfg.backend.branch) || "main";
        if (!state.repo) throw new Error("No repository in /admin/config.yml");
        return Promise.all(
          list.map(function (s) {
            return readFile(s.file, state.branch).then(
              function (text) {
                var parsed = parse(s.file, text);
                return Object.assign({}, s, { original: withBody(parsed), changes: {}, lines: {} });
              },
              function (err) {
                if (err.status === 401) throw err;
                return null;
              },
            );
          }),
        );
      })
      .then(function (sources) {
        state.sources = sources.filter(Boolean);
        state.on = true;
        document.documentElement.classList.add("aie-on");
        if (!document.getElementById("aie-css")) {
          var st = el("style", { id: "aie-css" });
          st.textContent = CSS;
          document.head.appendChild(st);
        }
        // pause carousels so text doesn't slide away mid-edit
        try {
          if (window.jQuery) window.jQuery(".owl-carousel").trigger("stop.owl.autoplay");
        } catch (e) {}
        // finish number count-ups (site-scripts.html) before tagging them
        if (window.__ajasFinishCounters) window.__ajasFinishCounters();
        return new Promise(function (r) {
          requestAnimationFrame(function () {
            requestAnimationFrame(r);
          });
        });
      })
      .then(function () {
        state.sources.forEach(setup);
        buildToolbar();
        refreshCount();
        document.addEventListener("click", onClickCapture, true);
        document.addEventListener("mouseover", onOver, true);
        window.addEventListener("beforeunload", beforeUnload);
        try {
          sessionStorage.setItem("ajas-inline", "1");
        } catch (e) {}
        var n = 0;
        state.sources.forEach(function (s) {
          n += Object.keys(s.tagged.texts).length + Object.keys(s.tagged.images).length;
        });
        toast("✎ " + n + " things on this page can be edited — they have a dashed outline.", false, 5000);
      })
      .catch(function (err) {
        console.error("[AJAS editor] start failed", err);
        if (err.status === 401) needLogin(true);
        else toast("Couldn't start the editor: " + esc(err.message), true, 10000);
      });
  }

  function stop() {
    state.on = false;
    try {
      sessionStorage.removeItem("ajas-inline");
    } catch (e) {}
    // simplest way to put every link, carousel and tagged text back exactly:
    location.reload();
  }

  window.AjasInline = { start: start, stop: stop, isOn: function () { return state.on; } };
})();
