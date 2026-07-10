# Cursor Prompt — Invoice Radar "How it works" section

Build a self-contained "How Invoice Radar works" section for the Powerhouse Tech
website, matching the existing AI Sales Outreach solution page.

## Design tokens (reuse from site)
- Primary indigo: `#424FD1`
- Fonts: DM Serif Display (headings), Inter (body), JetBrains Mono (labels/numbers)
- Light theme, generous whitespace, rounded-2xl cards, soft shadows

## Goal
A small scroll/step animation that walks a visitor through the workflow using
mock dashboard screenshots (built in HTML/CSS, NOT image files). 5 steps:

1. **Capture** — invoice arrives (email / photo / manual). Card shows a captured
   row appearing with an "extracting…" shimmer, then filled fields + a confidence badge.
2. **Read** — AI extraction fills amount, due date, party. Low-confidence field
   flips to an amber "Needs review" chip.
3. **Chase** — reminder ladder: Stage 1 auto-sends (green "sent" pill), Stage 2/3
   wait behind an "Approval needed" gate.
4. **Approve** — a WhatsApp-style message preview with Approve / Snooze / Skip.
5. **Reconcile** — pay link clicked → row flips to PAID, chase stops, KPI ticks down.

## Interaction
- One `IntersectionObserver`; each step activates as it scrolls into view (add
  `.is-active`, animate that step's mock dashboard).
- Also allow click on step tabs to jump. Respect `prefers-reduced-motion`.
- KPI header: Outstanding ₹13,360 · Overdue ₹11,350 (3 invoices). Indian digit grouping.

## Mock dashboard component
Reusable card resembling the portal: sidebar dot-nav, a table with 2–3 invoice
rows (party, amount, due, stage pill). Drive its state from the active step so
each step shows the same table in a later state.

## Build constraints
- Single component. React + Tailwind core classes only (or plain HTML/CSS if the
  site isn't React — match the repo).
- No external images; all "screenshots" are styled divs.
- No localStorage; state in component memory only.
- Accessible: aria-labels on step tabs, keyboard focusable, alt-text equivalents.

## Copy (concise, benefit-led)
- Heading: "From invoice to paid — on autopilot"
- Sub: "Powerhouse watches your inbox, reads every invoice, chases politely, and
  stops the moment it's paid. You only approve the firm nudges."
- One line per step (reuse the step names above).

## Acceptance
- Scrolling triggers each step once; tabs jump correctly; PAID flip stops the chase
  and updates the KPI. Reduced-motion shows static states. Lighthouse a11y ≥ 95.
