# Engineering Standards

## Intent
This codebase is optimized for long-horizon agent behavior, so clarity and test coverage matter more than terse cleverness. The standards below are the minimum bar for code that lands on `main`.

## Comments
- Add documentation comments to exported backend, shared-contract, orchestration, and auth-facing functions.
- Add inline comments only when the intent is not obvious from the code itself.
- Do not add comments that restate the code mechanically.

## Readability
- Prefer small functions with explicit names over nested control flow.
- Use early returns to keep the main path readable.
- Keep import order stable and grouped.
- Avoid promise work that is not awaited or intentionally detached.
- Keep production logging structured and meaningful.

## Tests
- Every new API, auth, policy, or orchestration behavior must ship with automated coverage.
- Backend logic should have unit or integration tests close to the module under test.
- User-facing auth flows must have end-to-end coverage through Playwright.
- When fixing a bug, add or update a test that fails before the fix and passes after it.

## CI Gates
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`

If a change cannot be covered meaningfully by one of those layers, document the gap in the pull request and add the smallest practical safety check.
