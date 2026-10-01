# Loading skeletons: clicks answer straight away

Opened: 2026-10-02 04:35 PHT

## What
- `components/page-skeleton.tsx`, plus a `loading.tsx` in each signed-in area: (app), (desk), (portal) and (manage). After a click, the content area shows a placeholder at once while the page loads. The sidebar and header stay. The pulse is off for reduced motion.

## Why
Clicks felt dead: the old page stayed until the next one had fully loaded on the server. That matters most on a cold start. The server is now in sin1, next to the database.

## Tested
`tsc` and `eslint` are clean. Not clicked through.
