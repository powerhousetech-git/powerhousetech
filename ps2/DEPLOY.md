# Deploy PS2 on the main domain

The main `powerhousetech.in` site is currently a **static Netlify publish** from the repo root.  
`ps2/` is a **dynamic Next.js app** with API routes and custom auth, so it must run on a server host first, then be proxied through the main domain.

## Recommended production shape

1. **Deploy `ps2/` to Railway**
2. **Proxy `/ps2/*` from Netlify → Railway**
3. Keep the existing website entry page:
   - `/sahasra/lead-management/`
4. Launch the live app at:
   - `https://powerhousetech.in/ps2/login`

## 1) Deploy `ps2/` to Railway

Create a new Railway service from this repository:

- **Root Directory:** `ps2`
- **Builder:** Dockerfile

Files already added:

- `ps2/Dockerfile`
- `ps2/railway.json`

### Environment variables

Set these in Railway:

```bash
PORT=3000
JWT_SECRET=<long-random-secret>
N8N_API_KEY=<long-random-secret>
NEXT_PUBLIC_SUPABASE_URL=https://msratyvmnuvozuthgkmi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
PS2_DEMO_MODE=false
ANTHROPIC_API_KEY=<optional>
```

### Notes

- `PS2_DEMO_MODE=false` is required for real data.
- The app uses the `ps2_*` Supabase tables created by:
  - `supabase/migrations/20260903120000_ps2_lead_management.sql`

## 2) Proxy it through the main domain

After Railway gives you a public URL like:

```bash
https://ps2-production-xxxx.up.railway.app
```

add these Netlify redirects to `netlify.toml`:

```toml
[[redirects]]
  from = "/ps2"
  to = "https://YOUR-RAILWAY-URL/ps2"
  status = 301

[[redirects]]
  from = "/ps2/*"
  to = "https://YOUR-RAILWAY-URL/:splat"
  status = 200
  force = true
```

Recommended live entry URLs:

- `https://powerhousetech.in/sahasra/lead-management/`
- `https://powerhousetech.in/ps2/login`

## 3) Cookie/auth note

Because users will access the app through `powerhousetech.in/ps2/*`, auth cookies will stay on the main domain path and work normally.

## 4) Verification

After deployment:

```bash
curl -I https://powerhousetech.in/ps2/login
curl -s https://powerhousetech.in/ps2/api/auth/me
```

Then login in the browser with:

- `sahasra_admin / sahasra_admin` (demo or seeded admin)

## Current limitation

This repo currently does **not** include authenticated Netlify / Railway deployment credentials or CLI access in the agent environment, so the app cannot be published live from here without those platform credentials already configured.
