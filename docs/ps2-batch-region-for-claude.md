# Claude — Batch / Region / Weekend skip (WF-A + add-lead)

## Sheet columns (already present on Sheet1)
| Col | Header |
|-----|--------|
| N | Batch |
| O | Batch Triggered At |
| P | Region |

## Portal → add-lead
Every create now includes:
- `batch` / `Batch` — e.g. `B-0908-1130` (one id per upload session)
- `region` / `Region` — `IN` (default) or `US`
- Leave **Batch Triggered At** empty on create

Map these into Sheets Append / AppendOrUpdate.

## Portal → Run email sequence (`POST /webhook/ps2-send-email`)
```json
{
  "event": "portal.trigger",
  "workflow": "send_email",
  "batches": ["B-0908-1130", "B-0908-1430"]
}
```

- If `batches` missing or empty → **do nothing**
- First trigger for a batch: set **Batch Triggered At** = now on all leads in that batch
- Day offsets relative to that timestamp (same clock time daily)
- **No mail Sat/Sun** (push to Monday)
- Daily schedule: India ~9 AM IST; US ~10 AM EST (~8:30 PM IST)
- Only process leads whose batch has Batch Triggered At set (scheduled runs)
- Skips: responded / meeting_proposed / meeting_scheduled / human_takeover / converted / discarded

## Auto-reply timeout (separate)
`Invalid credentials: [Errno 110] Connection timed out` on reply workflow = Microsoft/Outlook credential or network timeout in n8n — re-auth / fix egress. Not a portal bug.
