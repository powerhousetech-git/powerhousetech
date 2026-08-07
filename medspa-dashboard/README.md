# Med Spa ROI Dashboard

Next.js 14 App Router dashboard for Powerhouse Tech med spa clients.

## Live

- https://powerhousetech.in/dashboard/demo/

Netlify builds this via `scripts/build-dashboard.sh` (static export into `/dashboard` + `/_next`).

## Run locally

```bash
cd medspa-dashboard
npm install
npm run dev
```

Open [http://localhost:3000/dashboard/demo](http://localhost:3000/dashboard/demo).

## Stack

- Next.js 14 + TypeScript + Tailwind
- Recharts, lucide-react, date-fns
- Mock data in `lib/mock-data.ts` (swap via `DATA_API_URL`)

## Env

See `.env.example`:

- `NEXT_PUBLIC_DEMO_MODE=true` — demo banner
- `NEXT_PUBLIC_BOOKING_URL` — CTA link
- `DATA_API_URL` — optional live API base
