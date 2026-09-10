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

## Later: adding auth (Clerk)

**Status: built, needs one-time setup.** Sign-in is now required to save;
loading a shared link to *view* a drill still works without an account,
but saving or updating one requires being signed in, and only the
original owner can update an existing drill.

**1. Create a Clerk account and application**
- Go to [clerk.com](https://clerk.com) → sign up → **Create application**
- Name it whatever you like (e.g. "coachsessionplan")

**2. Get your keys**
- In the Clerk Dashboard → **API Keys** page, you'll see:
  - **Publishable key** (starts with `pk_`) — not secret, safe to put in code
  - **Secret key** (starts with `sk_`) — never put this in code or git
- Also note your **Frontend API** URL, shown on that same page (looks like
  `your-app-name-12.clerk.accounts.dev`)

**3. Fill in the publishable key and frontend API URL**

In `index.html`, near the top, replace the placeholders in the Clerk
`<script>` tag:
```html
data-clerk-publishable-key="pk_..."          <!-- your real publishable key -->
src="https://your-app-name-12.clerk.accounts.dev/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
```

In `wrangler.toml`, under `[vars]`, replace:
```toml
CLERK_PUBLISHABLE_KEY = "pk_..."             <!-- same publishable key -->
```

**4. Set the secret key (never goes in a file, never gets committed)**
```bash
npx wrangler secret put CLERK_SECRET_KEY
```
Paste your secret key when prompted.

**5. Run the auth migration** (adds a `user_id` column to the existing table):
```bash
npx wrangler d1 execute coachsessionplan-db --remote --file=schema_v2_auth.sql
```

**6. Commit and push**
```bash
git add .
git commit -m "Add Clerk authentication"
git push
```

Once that deploys: a "Sign In" button appears in the topbar. Signed out,
clicking Save opens the sign-in dialog instead of saving. Signed in, Save
works as before, and only you (as the signed-in user) can update a drill
you created — anyone else gets an error if they try to overwrite it,
though viewing a shared link still works for everyone.
