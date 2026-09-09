# coachsessionplan.com

Soccer drill/session designer — single-page app, deployed on Cloudflare Pages.

## Local development

This is currently a single static HTML file. To preview locally:

```bash
npx serve .
```

Then open http://localhost:3000

## Deployment

Deployed via Cloudflare Pages, connected to this GitHub repo. Every push to
`main` auto-deploys. See DEPLOYMENT.md for the one-time setup steps
(domain transfer, GitHub connection, Pages project creation).

## Roadmap

- [x] Drill/session designer (draw, animate, output)
- [ ] Backend: save/load drills (Cloudflare D1)
- [ ] Auth (Clerk)
- [ ] PDF/print export
- [ ] Share links
- [ ] Video clip attachments
