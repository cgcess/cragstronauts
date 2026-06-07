---
description: File Cragstronauts feedback as a clean, deduped, labeled GitHub issue
argument-hint: [your feedback in plain words]
allowed-tools: Bash(gh:*)
---

You are filing **Cragstronauts** feedback as a GitHub issue in this repo. Be fast
and decisive — only ask the user something if a step below explicitly says to.

Raw feedback from the user:

$ARGUMENTS

Steps:

1. **No input?** If the feedback above is empty, ask the user what the feedback is
   (one line), then continue.

2. **Identify the reporter.** Run `gh api user --jq .login` to get their GitHub
   login, and map it to a crew label:
   - `juanibiapina` → `reporter:juan`
   - `cgcess` → `reporter:colin`
   - `Nickdonati` → `reporter:nick`
   - _(Tobi's login: add here once known)_
   If the login isn't in the map, skip the reporter label but still put
   `Reported by @<login>` in the body. (Edit this map as the crew grows.)

3. **Classify** the feedback as a bug or an idea → pick `type:bug` or `type:idea`.
   Only ask the user if it's genuinely ambiguous.

4. **Check for duplicates.** Run
   `gh issue list --state open --search "<2-4 key terms from the feedback>"`.
   If a clearly matching open issue already exists, **do not create a new one** —
   instead `gh issue comment <number> --body "Also raised by @<login>: <one line>"`,
   tell the user that existing issue's URL, and stop.

5. **Otherwise create the issue:**
   - **Title:** concise and specific, ≤70 chars (no `[Feedback]` prefix).
   - **Body:** a one-paragraph summary, then `**Where:** <part of the app, if known>`
     and `**Reported by** @<login>`.
   - **Labels:** the `type:*` label, `status:triage`, and the `reporter:*` label
     (if mapped).
   - Command shape:
     `gh issue create --title "…" --body "…" --label "type:bug" --label "status:triage" --label "reporter:juan"`

6. **Report back** the new (or existing) issue URL plus a one-line summary of what
   you filed and which labels you applied.

Notes:
- Run this from inside the repo so `gh` targets the right project.
- If the user pasted **multiple** distinct pieces of feedback at once, file each as
  its own issue (dedupe-checking each), then list all the URLs.
