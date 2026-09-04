# ps2-lead-api modular split

Working modularization of the monolithic `../index.ts` for MCP `deploy_edge_function`
payload size limits. All ops are exported via `ops.ts` → lead/mail/admin modules.

Prefer deploying the monolithic `../index.ts` when the transport allows.
If deploying modularly, upload ALL of: index.ts, helpers.ts, ops.ts,
ops-leads-read.ts, ops-leads-write.ts, ops-leads-ingest.ts, ops-mail.ts, ops-admin.ts.
