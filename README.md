# Atomic Design + React Router + Vite + Dependency Cruiser

## Run
```bash
npm i
npm run dev
```

Open http://localhost:5173

## Dependency rules
- Upward imports across Atomic layers are errors.
- Layer barrel imports (e.g., `Atoms/index.ts`) are warnings.

CI will annotate violations on PRs in the **Files changed** tab.
