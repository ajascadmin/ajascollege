/**
 * AJAS CMS Auth Worker — GitHub token for Sveltia CMS (no Netlify).
 *
 * Flow:
 * 1. Sveltia opens /auth?provider=github&site_id=ajascollege.pages.dev
 * 2. User enters CMS password
 * 3. Worker returns Sveltia postMessage handshake with a GitHub PAT
 *
 * Secrets (wrangler secret put):
 *   CMS_PASSWORD   — staff password for /admin login
 *   GITHUB_TOKEN   — GitHub PAT or OAuth token with `repo` scope
 *   ALLOWED_DOMAINS — optional, comma list (default allows ajascollege.pages.dev)
 */

const DEFAULT_ALLOWED = "ajascollege.pages.dev,*.ajascollege.pages.dev,*.pages.dev,ajascollege-9vk.pages.dev,*.ajascollege-9vk.pages.dev,localhost,127.0.0.1";

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const domainAllowed = (domain, allowedRaw) => {
  const list = (allowedRaw || DEFAULT_ALLOWED).split(",").map((s) => s.trim()).filter(Boolean);
  return list.some((str) =>
    (domain ?? "").match(new RegExp(`^${escapeRegExp(str).replace("\\*", ".+")}$`)),
  );
};

/** Sveltia/Decap expects this postMessage handshake from the auth popup. */
const outputTokenHTML = ({ provider = "github", token, error, errorCode }) => {
  const state = error ? "error" : "success";
  const content = error ? { provider, error, errorCode } : { provider, token };

  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>CMS Auth</title></head><body>
<script>
(() => {
  const provider = ${JSON.stringify(provider)};
  const state = ${JSON.stringify(state)};
  const content = ${JSON.stringify(content)};
  window.addEventListener("message", ({ data, origin }) => {
    if (data === "authorizing:" + provider) {
      window.opener?.postMessage(
        "authorization:" + provider + ":" + state + ":" + JSON.stringify(content),
        origin
      );
    }
  });
  window.opener?.postMessage("authorizing:" + provider, "*");
})();
</script>
<p style="font-family:system-ui;text-align:center;margin-top:3rem;color:#333">
  ${error ? "Authentication failed. You can close this window." : "Signing you in… You can close this window."}
</p>
</body></html>`,
    {
      headers: {
        "Content-Type": "text/html;charset=UTF-8",
        "Cache-Control": "no-store",
      },
    },
  );
};

const loginFormHTML = ({ error = "", siteId = "" }) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AJAS CMS Login</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100vh; display: grid; place-items: center;
      font-family: system-ui, -apple-system, Segoe UI, sans-serif;
      background: #0f172a; color: #e2e8f0;
    }
    .card {
      width: min(360px, 92vw); background: #1e293b; border-radius: 12px;
      padding: 1.75rem 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,.35);
      border: 1px solid #334155;
    }
    h1 { font-size: 1.15rem; margin: 0 0 .35rem; font-weight: 600; }
    p { margin: 0 0 1.25rem; font-size: .9rem; color: #94a3b8; line-height: 1.4; }
    label { display: block; font-size: .8rem; margin-bottom: .35rem; color: #cbd5e1; }
    input {
      width: 100%; box-sizing: border-box; padding: .65rem .75rem; border-radius: 8px;
      border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 1rem;
    }
    button {
      margin-top: 1rem; width: 100%; padding: .7rem 1rem; border: 0; border-radius: 8px;
      background: #3b82f6; color: #fff; font-weight: 600; font-size: .95rem; cursor: pointer;
    }
    button:hover { background: #2563eb; }
    .err {
      background: #7f1d1d; color: #fecaca; padding: .55rem .7rem; border-radius: 8px;
      font-size: .85rem; margin-bottom: 1rem;
    }
    .brand { font-size: .75rem; color: #64748b; margin-top: 1rem; text-align: center; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/auth">
    <h1>Al Jamia CMS</h1>
    <p>Enter the CMS password to sign in with GitHub for <strong>${escapeHtml(siteId || "this site")}</strong>.</p>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
    <input type="hidden" name="provider" value="github" />
    <input type="hidden" name="site_id" value="${escapeHtml(siteId)}" />
    <label for="password">CMS password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
    <button type="submit">Sign in</button>
    <div class="brand">No Netlify · GitHub via Cloudflare Worker</div>
  </form>
</body>
</html>`;

const escapeHtml = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";

    // Health
    if (path === "/" || path === "/health") {
      return new Response("ajas-cms-auth ok", {
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
      });
    }

    if (path !== "/auth") {
      return new Response("Not Found", { status: 404 });
    }

    const provider =
      url.searchParams.get("provider") ||
      (request.method === "POST" ? null : "github");

    if (request.method === "GET") {
      const siteId = url.searchParams.get("site_id") || "";
      const prov = url.searchParams.get("provider") || "github";

      if (prov !== "github") {
        return outputTokenHTML({
          provider: prov,
          error: "Only GitHub is supported.",
          errorCode: "UNSUPPORTED_BACKEND",
        });
      }

      if (!domainAllowed(siteId, env.ALLOWED_DOMAINS)) {
        return outputTokenHTML({
          provider: "github",
          error: "Domain not allowed: " + siteId,
          errorCode: "UNSUPPORTED_DOMAIN",
        });
      }

      return new Response(loginFormHTML({ siteId }), {
        headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" },
      });
    }

    if (request.method === "POST") {
      const form = await request.formData();
      const siteId = String(form.get("site_id") || "");
      const password = String(form.get("password") || "");
      const prov = String(form.get("provider") || "github");

      if (prov !== "github") {
        return outputTokenHTML({
          provider: prov,
          error: "Only GitHub is supported.",
          errorCode: "UNSUPPORTED_BACKEND",
        });
      }

      if (!domainAllowed(siteId, env.ALLOWED_DOMAINS)) {
        return outputTokenHTML({
          provider: "github",
          error: "Domain not allowed.",
          errorCode: "UNSUPPORTED_DOMAIN",
        });
      }

      const expected = env.CMS_PASSWORD || "";
      const ghToken = env.GITHUB_TOKEN || "";

      if (!expected || !ghToken) {
        return outputTokenHTML({
          provider: "github",
          error: "CMS auth is not configured (missing secrets).",
          errorCode: "MISCONFIGURED_CLIENT",
        });
      }

      if (password !== expected) {
        return new Response(
          loginFormHTML({ error: "Incorrect password. Try again.", siteId }),
          {
            status: 401,
            headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "no-store" },
          },
        );
      }

      return outputTokenHTML({ provider: "github", token: ghToken });
    }

    return new Response("Method Not Allowed", { status: 405 });
  },
};
