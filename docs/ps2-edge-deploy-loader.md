# ps2-lead-api deploy note (v6)

Full source lives in `supabase/functions/ps2-lead-api/index.ts`.

If MCP deploy truncates or placeholder-corrupts the body, deploy this thin loader instead (pin to the commit SHA that contains the desired `index.ts`):

```ts
await import(
  "https://raw.githubusercontent.com/powerhousetech-git/powerhousetech/<COMMIT_SHA>/supabase/functions/ps2-lead-api/index.ts"
);
```

Current live pin: `d0d6278e942587922c0a2f252c3b28da3691377e` (update after each source change + redeploy).
