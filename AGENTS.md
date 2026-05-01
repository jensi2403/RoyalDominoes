# DominicanDominoe / CRMProject

CRM for Lunix POS (repair-shop POS) sales agents. Manages leads, commissions, clients, and support tickets.

## Tech Stack

- React 19 + Vite 7 + Tailwind CSS 4 + TypeScript
- Single-file SPA architecture: all components inline in `src/app.tsx`
- `vite-plugin-singlefile` — builds to a single HTML file (`dist/index.html`)
- Path alias: `@/` → `src/`
- No router; tab-based navigation via state
- No backend — all data persisted in `localStorage`

## Git State (known issues)

- Remote URL has typo: `hettps://` instead of `https://`. Fix: `git remote set-url origin https://github.com/jensi2403/CRMProject.git`
- The only commit tracked files under `Downloads/deploy-69a08…` — not from the project root. The working tree currently has no tracked source files. Restore with: `git checkout HEAD -- .` (files will land in `Downloads/deploy-…` tree) or restructure.
- `.agents/` is untracked. Add `.gitignore` entry for it if not intended for version control.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server
npm run build      # production build → dist/index.html (single file)
npm run preview    # preview production build
```

No test runner, linter, or formatter is configured.

## Conventions

- All UI text in Spanish (labels, statuses, buttons, prompts)
- Status enums are Spanish or mixed: lead statuses, sub-statuses, commission statuses, ticket statuses
- Dark mode toggle built in (sun/moon icons, `dark:` Tailwind classes throughout)
- Inline SVG icon components — no external icon library
- UI uses Tailwind utility classes exclusively, no component library
- Narration/cartoon aesthetic with `uppercase`, `font-black`, `tracking-tight`, `rounded-2xl`