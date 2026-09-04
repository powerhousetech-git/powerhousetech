# ps2-lead-api deploy note (v6)

Full source lives in `supabase/functions/ps2-lead-api/index.ts`.

If MCP deploy truncates or placeholder-corrupts the body, deploy this thin loader instead (pin to the commit SHA that contains the desired `index.ts`):

```ts
await import(
  "https://raw.githubusercontent.com/powerhousetech-git/powerhousetech/<COMMIT_SHA>/supabase/functions/ps2-lead-api/index.ts"
);
```

Current live pin: `1b0ac646c7b4f5109a406865f572d8aeea97e9ca` (update after each source change + redeploy).
