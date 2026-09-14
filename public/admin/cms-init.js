/**
 * AJAS branding + WYSIWYG preview for Sveltia CMS.
 * Runs after sveltia-cms.js exposes window.CMS / starts the app.
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

  // Sveltia overwrites <title> after boot — keep reclaiming it
  forceTitle();
  var titleEl = document.querySelector("title");
  if (titleEl && window.MutationObserver) {
    new MutationObserver(forceTitle).observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }
  setInterval(forceTitle, 1500);

  function whenCMS(cb) {
    if (window.CMS && typeof window.CMS.registerPreviewStyle === "function") {
      cb(window.CMS);
      return;
    }
    var n = 0;
    var id = setInterval(function () {
      n += 1;
      if (window.CMS && typeof window.CMS.registerPreviewStyle === "function") {
        clearInterval(id);
        cb(window.CMS);
      } else if (n > 100) {
        clearInterval(id);
      }
    }, 100);
  }

  // ——— HTML helpers ———————————————————————————————————————————————

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** Resolve a CMS media path (draft-local or already-public) to a usable <img> src. */
  function assetUrl(getAsset, path) {
    if (!path) return "";
    try {
      var asset = getAsset(path);
      if (asset && asset.url) return asset.url;
      if (asset && typeof asset.toString === "function" && String(asset) !== "[object Object]") {
        return String(asset);
      }
    } catch (e) {
      // fall through to raw path
    }
    return path;
  }

  function img(getAsset, src, alt, extraAttrs) {
    if (!src) return "";
    return (
      '<img src="' + esc(assetUrl(getAsset, src)) + '" alt="' + esc(alt) + '" ' + (extraAttrs || "") + " />"
    );
  }

  function fa(icon) {
    return '<i class="fa fa-' + esc(icon || "circle") + '" aria-hidden="true"></i>';
  }

  var EVENT_COLORS = ["7ecc88", "3f4c99", "ff5f60"];
  var NUMBER_WORDS = ["one", "two", "three", "four", "five"];

  /**
   * Renders the homepage exactly like src/components/home/HomeSections.astro
   * (same markup/classes) so the preview reuses the real public CSS
   * (registered below) — a true WYSIWYG preview, not a generic field dump.
   * Kept in sync by hand with that component; if you change one, change both.
   */
  function renderHomePreview(data, getAsset) {
    data = data || {};
    var hero = data.hero || {};
    var quick_actions = data.quick_actions || [];
    var accreditation = data.accreditation || { items: [] };
    var about = data.about || { paragraphs: [] };
    var metrics = data.metrics || [];
    var chairman = data.chairman_message || {};
    var principal = data.principal_message || {};
    var programmes = data.programmes || {};
    var ug = programmes.ug || { items: [] };
    var pg = programmes.pg || { items: [] };
    var departments = programmes.departments || [];
    var gallery = data.gallery || { slides: [] };
    var services = data.services || { items: [] };
    var benefits = data.benefits || { items: [] };
    var events = data.events || { items: [] };
    var testimonials = data.testimonials || { items: [] };
    var qlc = data.quick_link_cta || { quicklinks: [] };

    var html = "";

    // 1 — Hero
    html +=
      '<section class="ajas-hero ajas-hero--video-only" aria-label="Campus video"><div class="hero-media">' +
      (hero.video
        ? '<video class="hero-video" autoplay muted loop playsinline preload="metadata"><source src="' +
          esc(assetUrl(getAsset, hero.video)) +
          '" type="video/mp4"></video>'
        : '<div style="aspect-ratio:16/9;background:#e2e8f0;display:flex;align-items:center;justify-content:center;color:#64748b">No hero video set</div>') +
      "</div></section>";

    // 2 — Quick actions
    html += '<section class="ajas-actions"><div class="container"><div class="row">';
    quick_actions.forEach(function (tile) {
      html +=
        '<div class="col-lg-4 col-md-4 col-sm-12"><a class="action-tile tile-' +
        esc(tile.style || "primary") +
        '" href="' +
        esc(tile.url) +
        '"><span class="tile-ico">' +
        fa(tile.icon) +
        '</span><span class="tile-body"><span class="tile-title">' +
        esc(tile.title) +
        '</span><span class="tile-sub">' +
        esc(tile.subtitle) +
        '</span></span><span class="tile-cta">' +
        esc(tile.cta_label) +
        ' <i class="fa fa-long-arrow-right" aria-hidden="true"></i></span></a></div>';
    });
    html += "</div></div></section>";

    // 3 — Accreditation
    html +=
      '<section class="partner-clients ajas-accred"><div class="container"><p class="accred-label">' +
      esc(accreditation.label) +
      '</p><ul class="accred-row">';
    (accreditation.items || []).forEach(function (item) {
      html += "<li>" + img(getAsset, item.image, item.name) + "<span>" + esc(item.name) + "</span></li>";
    });
    html += "</ul></div></section>";

    // 4 — About
    html += '<section class="ajas-about"><div class="container"><h2 class="flat-title medium">' + esc(about.heading) + "</h2>";
    (about.paragraphs || []).forEach(function (p) {
      html += "<p>" + esc(p) + "</p>";
    });
    html += '<a href="' + esc(about.cta_url) + '" class="btn-box-shadow">' + esc(about.cta_label) + "</a></div></section>";

    // 5 — Metrics
    html += '<section class="ajas-metric-banner"><div class="container"><ul class="ajas-metric-row">';
    metrics.forEach(function (m) {
      html += "<li><strong>" + esc(m.value) + "</strong><span>" + esc(m.label) + "</span></li>";
    });
    html += "</ul></div></section>";

    // 6/7 — Chairman + Principal message (same layout)
    function messageBlock(m, isPrincipal) {
      var out =
        '<section class="flat-introduce flat-introduce-style1 clearfix"><div class="container"><div class="col-left"><div class="videobox"><a href="' +
        esc(m.photo_url) +
        '">' +
        img(getAsset, m.photo, m.kicker) +
        '</a></div></div><div class="col-right"><div class="content-introduce content-introduce-style1"><div class="title-section"><p class="sub-title lt-sp25">' +
        esc(m.kicker) +
        '</p><div class="flat-title larger heading-type1">' +
        esc(m.heading) +
        '</div></div><div class="content-introduce-inner">';
      if (isPrincipal) {
        out += "<p>" + esc(m.quote) + "</p>";
        if (m.bullet_points && m.bullet_points.length) {
          out += '<div class="content-list"><ul>';
          m.bullet_points.forEach(function (b) {
            out += '<li><span class="text">' + esc(b) + "</span></li>";
          });
          out += "</ul></div>";
        }
      } else {
        (m.paragraphs || []).forEach(function (p) {
          out += "<p>" + esc(p) + "</p>";
        });
      }
      out +=
        '<div class="btn-about"><a href="' +
        esc(m.cta_url) +
        '" class="btn-box-shadow">' +
        esc(m.cta_label) +
        "</a></div></div></div></div></div></section>";
      return out;
    }
    html += messageBlock(chairman, false);
    html += messageBlock(principal, true);

    // 8 — Programmes + departments
    function progCard(card, defaultIcon) {
      var out =
        '<div class="col-lg-6 col-md-12"><div class="ajas-prog-card"><div class="prog-card-header"><div class="prog-icon-badge">' +
        fa(card.icon) +
        '</div><div class="prog-header-text"><span class="prog-level-tag">' +
        esc(card.level_tag) +
        '</span><h3 class="prog-card-title">' +
        esc(card.title) +
        '</h3><span class="prog-meta">' +
        esc(card.meta) +
        '</span></div></div><div class="prog-card-body"><ul class="prog-chips-grid">';
      (card.items || []).forEach(function (it) {
        out +=
          '<li><a href="' +
          esc(it.url) +
          '" class="prog-chip">' +
          fa(it.icon || defaultIcon) +
          " " +
          esc(it.label) +
          "</a></li>";
      });
      out += "</ul>";
      if (card.highlight_text) {
        out +=
          '<div class="pg-highlight-box"><div class="pg-hl-icon">' +
          fa(card.highlight_icon || "lightbulb-o") +
          "</div><p>" +
          esc(card.highlight_text) +
          "</p></div>";
      }
      out +=
        '</div><div class="prog-card-footer"><a href="' +
        esc(card.cta_primary_url) +
        '" class="btn-prog-cta">' +
        esc(card.cta_primary_label) +
        ' <i class="fa fa-arrow-right"></i></a><a href="' +
        esc(card.cta_secondary_url) +
        '" class="btn-prog-alt">' +
        esc(card.cta_secondary_label) +
        "</a></div></div></div>";
      return out;
    }

    html +=
      '<section class="online-courses online-courses-style1 ajas-programmes"><div class="container"><div class="title-section text-center"><p class="sub-title lt-sp17">' +
      esc(programmes.kicker) +
      '</p><h2 class="flat-title medium">' +
      esc(programmes.heading) +
      '</h2></div><p class="listing-intro">' +
      esc(programmes.intro) +
      '</p><div class="row ajas-prog-grid">' +
      progCard(ug, "check-circle") +
      progCard(pg, "star") +
      '</div><div class="title-section text-center pd-top60"><p class="sub-title lt-sp17">' +
      esc(programmes.departments_kicker) +
      '</p><h2 class="flat-title medium">' +
      esc(programmes.departments_heading) +
      '</h2></div><div class="flat-courses clearfix"><div class="row">';

    departments.forEach(function (dept) {
      html +=
        '<div class="col-lg-4 col-md-6 col-sm-12 course-col"><div class="ajas-dept-card"><div class="dept-card-media">' +
        img(getAsset, dept.image, dept.title) +
        '<span class="dept-card-badge">' +
        fa(dept.icon) +
        " " +
        esc(dept.badge_label) +
        '</span></div><div class="dept-card-content"><h3 class="dept-card-heading"><a href="' +
        esc(dept.url) +
        '">' +
        esc(dept.title) +
        '</a></h3><p class="dept-card-text">' +
        esc(dept.description) +
        '</p><div class="dept-card-pills">';
      (dept.pills || []).forEach(function (pill) {
        html += '<span class="dept-pill">' + esc(pill) + "</span>";
      });
      html +=
        '</div><div class="dept-card-bottom"><a href="' +
        esc(dept.url) +
        '" class="dept-link-btn">Explore Department <i class="fa fa-arrow-right"></i></a></div></div></div></div>';
    });

    html +=
      '</div><div class="text-center pd-top30"><a href="' +
      esc(programmes.view_all_url) +
      '" class="btn bg-clff5f60 ajas-apply-btn">' +
      esc(programmes.view_all_label) +
      "</a></div></div></div></section>";

    // 9 — Gallery
    html +=
      '<section class="ajas-media"><div class="container"><div class="title-section text-center"><p class="sub-title lt-sp17">' +
      esc(gallery.kicker) +
      '</p><h2 class="flat-title medium">' +
      esc(gallery.heading) +
      '</h2></div><div class="flat-carousel-box clearfix"><div class="owl-carousel footages-carousel" style="display:flex;overflow-x:auto;gap:0">';
    (gallery.slides || []).forEach(function (slide) {
      html +=
        '<div class="gal-slide"><a class="gal-item" href="' +
        esc(assetUrl(getAsset, slide.image)) +
        '" title="' +
        esc(slide.title) +
        '">' +
        img(getAsset, slide.image, slide.title) +
        '<div class="gal-caption"><h3 class="gal-title">' +
        esc(slide.title) +
        '</h3><span class="gal-sub">' +
        esc(slide.caption) +
        "</span></div></a></div>";
    });
    html +=
      '</div></div><div class="text-center pd-top30"><a href="' +
      esc(gallery.cta_url) +
      '" class="btn bg-clff5f60 ajas-apply-btn">' +
      esc(gallery.cta_label) +
      "</a></div></div></section>";

    // 10 — Services
    html += '<section class="flat-services style1 parallax parallax1 clearfix ajas-services"><div class="section-overlay"></div><div class="container-fluid"><div class="row">';
    var textWords = ["one", "two", "three"];
    (services.items || []).forEach(function (svc, i) {
      html +=
        '<div class="col-lg-4"><div class="services-content-box themesflat-content-box"><div class="flat-imagebox imagebox-services style1"><div class="imagebox-content"><span class="ajas-icon">' +
        fa(svc.icon) +
        '</span><h5 class="text-' +
        (textWords[i] || "one") +
        ' text-white">' +
        esc(svc.title) +
        '</h5><p class="text-white">' +
        esc(svc.text) +
        '</p><div class="read-more"><a href="' +
        esc(svc.cta_url) +
        '">' +
        esc(svc.cta_label) +
        "</a></div></div></div></div></div>";
    });
    html += "</div></div></section>";

    // 11 — Benefits + apply CTA
    var imgWords = ["one", "two", "three", "four"];
    html +=
      '<section class="flat-benefit style1 clearfix ajas-benefit"><div class="container-fluid"><div class="col-benefit-left"><div class="wrap-inconbox-benefit"><div class="title-section"><div class="flat-title small heading-type2 text-white">' +
      esc(benefits.heading) +
      '</div></div><div class="iconbox-benefit iconbox-benefit-style1"><div class="row">';
    (benefits.items || []).forEach(function (b, i) {
      html +=
        '<div class="col-lg-6 col-md-6 col-sm-6 col-sx-12"><div class="themesflat-content-box"><div class="iconbox"><div class="iconbox-icon"><span class="ajas-icon">' +
        fa(b.icon) +
        '</span></div><div class="iconbox-content img-' +
        (imgWords[i] || "one") +
        '"><h3><a href="' +
        esc(b.url) +
        '">' +
        esc(b.title) +
        '</a></h3><p>' +
        esc(b.text) +
        "</p></div></div></div></div>";
    });
    html +=
      '</div></div></div><div class="col-benefit-right"><div class="ajas-apply-cta"><h2>' +
      esc(benefits.cta_heading) +
      "</h2><p>" +
      esc(benefits.cta_text) +
      '</p><a href="' +
      esc(benefits.cta_primary_url) +
      '" class="ajas-apply-cta-btn">' +
      esc(benefits.cta_primary_label) +
      ' <i class="fa fa-long-arrow-right" aria-hidden="true"></i></a><a href="' +
      esc(benefits.cta_secondary_url) +
      '" class="ajas-apply-cta-link">' +
      esc(benefits.cta_secondary_label) +
      "</a></div></div></div></section>";

    // 12 — Upcoming events
    var evItems = events.items || [];
    html +=
      '<section class="flat-event flat-event-style1 clearfix ajas-events"><div class="container-fluid"><div class="col-left"><div class="content-event-style1 themesflat-content-box"><div class="title-section"><div class="flat-title larger heading-type3">' +
      esc(events.heading) +
      '</div></div><div class="content-event-list">';
    evItems.forEach(function (ev, i) {
      var color = EVENT_COLORS[i % EVENT_COLORS.length];
      html +=
        '<div class="content-event"><div class="entry-info clearfix"><div class="entry-title"><a href="' +
        esc(ev.url) +
        '" class="cl-' +
        color +
        '">' +
        esc(ev.title) +
        '</a></div><div class="entry-meta"><ul><li class="date clearfix"><span class="icon-event icon-icons8-planner-100"></span><span class="detail-event">' +
        esc(ev.date) +
        '</span></li><li class="location clearfix"><span class="icon-event icon-icons8-marker-100"></span><span class="detail-event">' +
        esc(ev.location) +
        '</span></li></ul></div></div><div class="entry-number number-' +
        (NUMBER_WORDS[i] || "one") +
        '"><span class="cl-' +
        color +
        '">' +
        (i + 1) +
        "</span></div></div>";
    });
    html +=
      '</div><div class="btn-about pd-top15"><a href="' +
      esc(events.cta_url) +
      '" class="btn-box-shadow">' +
      esc(events.cta_label) +
      '</a></div></div></div><div class="col-right"><div class="images-list themesflat-content-box"><div class="images-list-1">';
    evItems.slice(0, 2).forEach(function (ev, i) {
      html +=
        '<div class="img-event">' +
        (ev.image ? img(getAsset, ev.image, ev.title) : "") +
        '<span class="number bg-cl' +
        EVENT_COLORS[i % EVENT_COLORS.length] +
        '">' +
        (i + 1) +
        "</span></div>";
    });
    html += "</div>";
    if (evItems[2]) {
      html +=
        '<div class="images-list-2"><div class="img-event">' +
        (evItems[2].image ? img(getAsset, evItems[2].image, evItems[2].title) : "") +
        '<span class="number bg-cl' +
        EVENT_COLORS[2 % EVENT_COLORS.length] +
        '">3</span></div></div>';
    }
    html += "</div></div></div></section>";

    // 13 — Testimonials
    html +=
      '<section class="ajas-testimonials-section"><div class="container"><div class="title-section text-center"><p class="sub-title lt-sp17">' +
      esc(testimonials.kicker) +
      '</p><h2 class="flat-title medium">' +
      esc(testimonials.heading) +
      '</h2></div><div class="ajas-testi-wrapper"><div class="flexslider ajas-testi-slider" style="overflow:visible"><ul class="slides" style="display:flex;flex-wrap:wrap;gap:20px;list-style:none;padding:0">';
    (testimonials.items || []).forEach(function (t) {
      html +=
        '<li style="flex:1 1 320px"><div class="ajas-testi-card"><div class="testi-photo-col"><div class="testi-avatar-frame">' +
        img(getAsset, t.photo, t.name) +
        '</div></div><div class="testi-content-col"><div class="testi-quote-mark"><i class="fa fa-quote-left" aria-hidden="true"></i></div><p class="testi-speech">&ldquo; ' +
        esc(t.quote) +
        ' &rdquo;</p><div class="testi-author-info"><h4 class="testi-name">' +
        esc(t.name) +
        '</h4><span class="testi-role-badge">' +
        esc(t.role) +
        "</span></div></div></div></li>";
    });
    html += "</ul></div></div></div></section>";

    // 14 — Closing CTA
    html +=
      '<section class="quick-link quick-link-style1 parallax parallax2 ajas-quicklink"><div class="section-overlay"></div><div class="container"><div class="row"><div class="col-lg-7"><div class="wrap-link-left"><div class="caption lt-sp275">' +
      esc(qlc.kicker) +
      '</div><div class="heading-lf lt-sp03">' +
      esc(qlc.heading) +
      "</div><p>" +
      esc(qlc.text) +
      '</p><div class="btn-apply-link"><ul><li><a href="' +
      esc(qlc.primary_url) +
      '" class="btn btn-apply bg-clff5f60">' +
      esc(qlc.primary_label) +
      '</a></li><li><a href="' +
      esc(qlc.secondary_url) +
      '" class="btn btn-request lt-sp06">' +
      esc(qlc.secondary_label) +
      '</a></li></ul></div></div></div><div class="col-lg-5"><div class="wrap-link-right"><div class="heading-rg"><span>' +
      esc(qlc.quicklinks_heading) +
      '</span></div><ul class="info-quick-link">';
    (qlc.quicklinks || []).forEach(function (link) {
      html +=
        "<li>" +
        fa(link.icon) +
        '<a href="' +
        esc(link.url) +
        '"' +
        (link.external ? ' target="_blank"' : "") +
        ">" +
        esc(link.label) +
        "</a></li>";
    });
    html += "</ul></div></div></div></div></section>";

    return html;
  }

  whenCMS(function (CMS) {
    // Real site stylesheets, in the same order BaseLayout.astro loads them —
    // makes every preview (not just the homepage) use the actual public CSS
    // instead of a generic approximation.
    [
      "/stylesheet/bootstrap.css",
      "/stylesheet/font-awesome.css",
      "/stylesheet/themify-icons.css",
      "/stylesheet/style.css",
      "/stylesheet/shortcodes.css",
      "/stylesheet/responsive.css",
      "/stylesheet/flexslider.css",
      "/stylesheet/owl.theme.default.min.css",
      "/stylesheet/owl.carousel.min.css",
      "/assets/migrate.css",
      "/stylesheet/animate.css",
      "/admin/preview-vars.css",
    ].forEach(function (href) {
      try {
        CMS.registerPreviewStyle(href);
      } catch (e) {
        console.warn("[AJAS CMS] registerPreviewStyle failed for " + href, e);
      }
    });
    // Fonts (Google Fonts stylesheet, not a same-origin file — register by URL same way)
    try {
      CMS.registerPreviewStyle(
        "https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap"
      );
    } catch (e) {
      console.warn("[AJAS CMS] Google Fonts preview style failed", e);
    }
    // Original hand-tuned pane styling (spacing, headings for markdown body
    // preview) — loaded last so it can fine-tune, not fight, the real CSS.
    try {
      CMS.registerPreviewStyle("/admin/preview.css");
    } catch (e) {
      console.warn("[AJAS CMS] registerPreviewStyle failed", e);
    }

    // WYSIWYG homepage preview — see renderHomePreview() above.
    try {
      if (typeof window.createClass === "function" && window.h) {
        var HomePreview = window.createClass({
          render: function () {
            var entry = this.props.entry;
            var getAsset = this.props.getAsset;
            var data = {};
            try {
              data = entry.getIn(["data"]).toJS();
            } catch (e) {
              console.error("[AJAS CMS] could not read homepage entry data", e);
            }
            var html = "";
            try {
              html = renderHomePreview(data, getAsset);
            } catch (e) {
              console.error("[AJAS CMS] home preview render failed", e);
              html = "<p style='padding:20px;color:#b91c1c'>Preview failed to render — see browser console. The Save button still works normally.</p>";
            }
            return window.h("div", { dangerouslySetInnerHTML: { __html: html } });
          },
        });
        CMS.registerPreviewTemplate("home", HomePreview);
      } else {
        console.warn("[AJAS CMS] window.createClass/h not available — homepage preview not registered");
      }
    } catch (e) {
      console.error("[AJAS CMS] registerPreviewTemplate('home', ...) failed", e);
    }
  });
})();
