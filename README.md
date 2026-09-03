# Al Jamia Arts & Science College

**Live:** https://ajascollege.pages.dev  
**CMS:** https://ajascollege.pages.dev/admin/  
**Repo:** https://github.com/ajascadmin/ajascollege  

Stack: **Astro** · **Sveltia CMS** · **Cloudflare Pages** · **Pagefind**

---

## Day-to-day editing (like WordPress sections)

Open **https://ajascollege.pages.dev/admin/** → Login with **GitHub** (`aathif394` or any collaborator with write access).

| # | Section | What staff change |
|---|---------|-------------------|
| 1 | News | Campus news |
| 2 | Events | Events |
| 3 | Notices & downloads | Circulars / PDFs |
| 4 | Fees & prospectus | Fee PDFs |
| 5 | Site settings | Phone, email, admission open |
| 6 | Homepage hero | Hero text / CTAs |
| 7 | Programmes | UG/PG list |
| 8 | Faculty | Faculty bios |
| 9 | Other pages | About, IQAC, labs, … |

After publish, GitHub Action rebuilds and deploys to Cloudflare Pages automatically.

---

## URLs

| What | URL |
|------|-----|
| Site | https://ajascollege.pages.dev |
| Admin | https://ajascollege.pages.dev/admin/ |
| Notices | https://ajascollege.pages.dev/notices/ |
| Fees | https://ajascollege.pages.dev/fees/ |
| Programmes | https://ajascollege.pages.dev/programmes/ |
| Auth worker (optional OAuth proxy) | https://ajas-cms-auth.ajascadmin.workers.dev |

---

## Local development

```bash
git clone https://github.com/ajascadmin/ajascollege.git
cd ajascollege
npm install
npm run dev          # http://localhost:4321

# Local CMS (no GitHub OAuth):
npm run cms          # starts decap-server — local file bridge only
# then http://localhost:4321/admin/
```

`npm run cms` may print “Decap” — that is only the local proxy. The UI is **Sveltia**.

---

## Deploy

- **Automatic:** push to `main` → GitHub Action → Cloudflare Pages  
- **Manual:** `npm run deploy`

Secrets (already set on the repo):

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

> If CI deploys fail after months, re-run `wrangler login` and refresh the `CLOUDFLARE_API_TOKEN` secret (token is from Wrangler OAuth).

---

## Production CMS login (no Netlify)

Sveltia does **not** use Netlify. Sign-in goes through our Cloudflare Worker:

**https://ajas-cms-auth.ajascadmin.workers.dev**

1. Open https://ajascollege.pages.dev/admin/
2. Click **Sign In with GitHub**
3. A popup asks for the **CMS password** (not your GitHub password)
4. On success you’re in — edit → Publish → GitHub Action redeploys

Password is stored only as a Worker secret + local file (not in git):

```text
ajascollege-new/.cms-password.local
```

Change it anytime:

```bash
cd cms-auth
printf 'your-new-password' | npx wrangler secret put CMS_PASSWORD --config wrangler.toml
```

Refresh the GitHub token secret if staff lose write access after `gh` re-login:

```bash
printf '%s' "$(gh auth token)" | npx wrangler secret put GITHUB_TOKEN --config wrangler.toml
```

---

## Project layout

```
content/     # CMS-editable Markdown + JSON
public/      # assets + /admin
src/         # Astro layouts & routes
.github/workflows/deploy.yml
```

---

## Moving the stack to the college team

Full transfer runbook (GitHub + Cloudflare Pages + Workers + Sveltia + secrets):

- **[docs/HANDOFF-TO-COLLEGE.md](docs/HANDOFF-TO-COLLEGE.md)** — step-by-step ownership transfer  
- **[docs/HANDOFF-CHECKLIST.md](docs/HANDOFF-CHECKLIST.md)** — printable tick list  
- **`scripts/retarget-ownership.sh`** — rewrite `config.yml` URLs after you know the new org/worker/site  

