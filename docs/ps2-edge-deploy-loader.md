# ps2-lead-api deploy note (v6)

Full source lives in `supabase/functions/ps2-lead-api/index.ts`.

If MCP deploy truncates or placeholder-corrupts the body, deploy this thin loader instead (pin to the commit SHA that contains the desired `index.ts`):

```ts
await import(
  "https://raw.githubusercontent.com/powerhousetech-git/powerhousetech/<COMMIT_SHA>/supabase/functions/ps2-lead-api/index.ts"
);
```

Current live pin: `99c3d38893c91073aa6a49812ec20fda08701660` (update after each source change + redeploy).
