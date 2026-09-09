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

When we're ready:

```bash
npx wrangler d1 create coachsessionplan-db
```

Copy the `database_id` it prints into `wrangler.toml`, then we add
`/functions` routes (Cloudflare Pages Functions) for save/load, and a
`schema.sql` for the drills table. This plugs into the same Pages
project — no separate deploy needed.
