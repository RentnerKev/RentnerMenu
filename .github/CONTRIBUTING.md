# Contributing to RentnerMenu

Thanks for helping improve @rentnerkev/menu. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

Read the [usage guide](../docs/usage.md) and [package documentation](https://packages.rentner.dev/packages/menu). Search [existing issues](https://github.com/RentnerKev/RentnerMenu/issues) before opening a bug report or feature request. For larger API or behavior changes, discuss the proposal in an issue first.

Include the installed package version, React and browser versions, a minimal reproduction, expected behavior, and actual behavior. Remove secrets and personal data. Report vulnerabilities privately using the [security policy](../SECURITY.md), never in a public issue.

## Local development

Fork the repository, create a branch such as `fix/keyboard-navigation` or `feat/custom-styling`, and use the Bun version declared in `package.json` (currently 1.4.4).

```bash
bun install --frozen-lockfile
bun install --cwd playground --frozen-lockfile
bun run playground:dev
```

Keep changes focused and follow the existing TypeScript, React, and Tailwind conventions. Add or update tests for changed behavior, including keyboard access and accessibility where relevant. Keep generated build output and local credentials out of commits. Changes to public APIs should include matching usage examples and types.

## Verification

Run the checks relevant to your change:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build
```

For browser interactions or packaging changes, install the browser engines and run the full repository verification:

```bash
bunx playwright install chromium firefox webkit
bun run verify
```

The `verify` script runs the checks declared in `package.json`, including the installed-package consumer. CI remains the source of required merge checks. If repository automation formats your changes, review its commit before merging. Long-duration performance or soak tests are reserved for release preparation or an explicit request.

## Pull requests

Use an English Conventional Commit title such as `fix: preserve keyboard focus` or `feat: add a styling option`. Explain the problem, resulting behavior, related issue, and checks performed. Call out compatibility changes and any checks you could not run. Keep unrelated refactors and dependency updates separate. Contributions are licensed under the repository's [MIT license](../LICENSE).
