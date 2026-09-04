# ps2-lead-api deploy notes

## Current production (project msratyvmnuvozuthgkmi)

- Function slug: `ps2-lead-api`
- Preferred: monolithic `index.ts` via Supabase MCP `deploy_edge_function`
  with `files: [{ name: "index.ts", content: <full file text> }]`, `verify_jwt: false`.
- If MCP payload is too large (~56KB source / ~30KB esbuild-min), use `_modular/`
  (all 8 files must be uploaded together) or temporarily pin a GitHub raw import
  to a known-good commit of `index.ts`.

## Do not

- Deploy `FILE_CONTENT_FROM_…` placeholders
- Deploy incomplete ops splits (missing modules)
- Deploy gzip/Blob bootstrap loaders (WORKER_ERROR on Edge)
