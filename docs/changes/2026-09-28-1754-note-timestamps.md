# Timestamps on change notes

Opened: 2026-09-28 17:54 PHT

## What
- Change-note filenames now include the time: `YYYY-MM-DD-HHMM-<slug>.md`, in Philippine time.
- Each note has a timestamp line under its title: `Opened: …`, plus `· Updated: …` on later pushes.
- Renamed the existing notes and stamped them with their PRs' real open times from GitHub.

## Why
Requested, so it's clear which note is the latest when several land on the same day.

## Tested
Docs only.

## Heads-up
Use `TZ=Asia/Manila date '+%Y-%m-%d %H:%M'` for the time. The rule is in `AGENTS.md`.
