# Powerhouse

Premium marketing site for Powerhouse — AI automation studio for Indian B2B SaaS founders.

## Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS v4**
- **Framer Motion** (scroll reveals, nav, hero)
- **Geist** via `next/font` (Apple-adjacent typography)

## Develop

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

### Vercel (recommended)

```bash
npx vercel
```

### Netlify

Repo: **https://github.com/aymaanshahzad23/powerhouse**

1. Go to [https://app.netlify.com/start](https://app.netlify.com/start)
2. **Import from Git** → GitHub → select `powerhouse`
3. Netlify reads `netlify.toml` automatically (`npm run build` + Next.js plugin)
4. Click **Deploy site**

Or with CLI (after `npm i -g netlify-cli` and `netlify login`):

```bash
netlify init
netlify deploy --prod
```

## Project structure

```
src/
  app/          layout, page, globals.css (mesh, glass, bento patterns)
  components/   Nav, Hero, Bento, Process, CTA, Team, …
  lib/          cn() utility
```

Legacy static HTML is in `_legacy/`.
