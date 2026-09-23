---
description: Get an independent Opus review of recent changes (uncommitted + unpushed by default)
argument-hint: "[commit, range, or files]  (optional)"
---

Use the `code-reviewer` subagent to review: $ARGUMENTS

If no argument was given, review all uncommitted changes plus commits not yet
pushed to origin.

When it reports back, show me its verdict and findings as-is, then add your own
one-line take on each blocker/should-fix (agree, disagree, or already handled).
Do NOT apply any fixes yet. Wait for me to say which ones to do.
