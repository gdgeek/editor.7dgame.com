---
inclusion: auto
---

# Code Modification Safety Rules

## JSDoc / Comment Insertion

When adding JSDoc annotations or comments above methods/functions using strReplace or editCode:

1. Always include the full method body in the replacement, not just the signature line
2. After batch JSDoc additions, run ESLint (`npm run lint` in `three.js/editor/test/`) to catch parsing errors caused by accidentally truncated method bodies
3. Pay special attention to short methods like `renderer(container)` — their bodies are easily lost when the replacement only captures the signature

## Pre-Push Verification

Before pushing to develop, run ESLint locally to catch errors early:
```bash
cd three.js/editor/test && npm run lint
```
Only errors (not warnings) block CI. Exit code 0 with warnings is a pass.
