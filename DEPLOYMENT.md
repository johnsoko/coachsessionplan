# Deployment Guide

One-time setup to get coachsessionplan.com live on Cloudflare Pages,
deploying automatically from GitHub.

---

## 1. Move the domain to Cloudflare

You almost certainly don't need a full registrar transfer — just pointing
your **nameservers** at Cloudflare is enough, keeps the domain at Namecheap,
and takes minutes to set up (propagation can take a few hours, rarely up
to 48h).

1. Cloudflare dashboard → **Add a Site** → enter `coachsessionplan.com`
2. Pick the Free plan
3. Cloudflare scans your existing DNS records — review them (should pick up
   whatever Namecheap currently has, e.g. any existing A/CNAME records)
4. Cloudflare gives you **two nameservers** (e.g. `xxx.ns.cloudflare.com`)
5. Go to Namecheap → Domain List → Manage → Nameservers → **Custom DNS**
   → replace with the two Cloudflare nameservers
6. Wait for Cloudflare to show the domain as **Active** (it emails you)

Only do a *full registrar transfer* later if you actually want Cloudflare
to be the registrar too (cheaper renewals, one dashboard) — it's optional
and separate from using Cloudflare's DNS/CDN/Pages.

---

## 2. Push this project to GitHub

From this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new repo on GitHub (github.com/new) — call it `coachsessionplan`,
don't initialize it with a README (we already have one). Then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/coachsessionplan.git
git branch -M main
git push -u origin main
```

---

## 3. Connect Cloudflare Pages to the repo

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**
2. Authorize GitHub, select the `coachsessionplan` repo
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank — nothing to build)*
   - Build output directory: `/`
4. **Save and Deploy** — first deploy takes ~1 minute, you'll get a
   `*.pages.dev` URL immediately

Every push to `main` from now on auto-deploys.

---

## 4. Point the domain at the Pages project

1. In the Pages project → **Custom domains** → **Set up a custom domain**
2. Enter `coachsessionplan.com` (and `www.coachsessionplan.com` if you
   want both)
3. Cloudflare adds the DNS records automatically since it already
   controls the zone from step 1 — no manual record editing needed
4. Wait a few minutes for the SSL certificate to issue

That's it — the domain now serves this repo, and stays live-updating on
every push.

---

## Later: adding the backend (D1 + save/load)

**Status: built, needs one-time setup.** The save/load API (`src/worker.js`)
and database schema (`schema.sql`) are already written. Three commands
finish the setup — run these from the project folder, logged into your
Cloudflare account (`npx wrangler login` first if you haven't):

```bash
# 1. Create the database
npx wrangler d1 create coachsessionplan-db
```

That prints a `database_id` — copy it into `wrangler.toml`, replacing
`REPLACE_AFTER_CREATING_DB`.

```bash
# 2. Create the table
npx wrangler d1 execute coachsessionplan-db --remote --file=schema.sql

# 3. Commit and push — the Git-connected build picks up the D1 binding
# from wrangler.toml automatically
git add wrangler.toml
git commit -m "Add D1 database binding"
git push
```

After that deploys, the **Save** button actually saves — it creates a
shareable link like `coachsessionplan.com/?id=abc123def456` and copies
it to your clipboard. Opening that link loads the drill back. No
accounts yet (that's the Clerk step below) — anyone with the link can
open or re-save it, which is fine for now and gets fully locked down
once auth is in place.
