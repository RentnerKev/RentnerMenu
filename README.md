<p align="center">
    <img src="https://raw.githubusercontent.com/RentnerKev/RentnerMenu/main/assets/readme/banner.png" alt="RentnerMenu" width="100%">
</p>

<p align="center">
    <a href="https://github.com/RentnerKev/RentnerMenu/actions/workflows/ci.yml"><img src="https://github.com/RentnerKev/RentnerMenu/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
    <a href="https://github.com/RentnerKev/RentnerMenu/actions/workflows/codeql.yml"><img src="https://github.com/RentnerKev/RentnerMenu/actions/workflows/codeql.yml/badge.svg?branch=main" alt="CodeQL"></a>
    <a href="https://www.npmjs.com/package/@rentnerkev/menu"><img src="https://img.shields.io/npm/v/@rentnerkev/menu" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@rentnerkev/menu"><img src="https://img.shields.io/npm/dm/@rentnerkev/menu" alt="npm downloads"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
</p>

Accessible React action and context menus with nested submenus, keyboard navigation, and shared RentnerKev styling.

## Installation

Requires React 19, React DOM 19, and Tailwind CSS 4. The library has no additional runtime UI dependencies.

```bash
npm install @rentnerkev/menu
# or with Bun
bun add @rentnerkev/menu
```

Import the package styles after Tailwind in your app stylesheet:

```css
@import 'tailwindcss';
@import '@rentnerkev/menu/tailwind.css';
```

## Quick start

```tsx
'use client'

import { Menu, ContextMenu, type MenuItem } from '@rentnerkev/menu'

const items: readonly MenuItem[] = [
    { id: 'open', label: 'Open' },
    {
        id: 'export',
        type: 'submenu',
        label: 'Export',
        items: [
            { id: 'json', label: 'As JSON' },
            { id: 'text', label: 'As text' },
        ],
    },
    { id: 'separator', type: 'separator' },
    { id: 'delete', label: 'Delete', danger: true },
]

export function FileActions() {
    return (
        <>
            <Menu
                ariaLabel="File actions"
                trigger="Actions"
                items={items}
                onAction={(id) => console.log(id)}
            />
            <ContextMenu
                ariaLabel="File context menu"
                items={items}
                onAction={(id) => console.log(id)}
            >
                <p>Right-click this file or press Shift+F10.</p>
            </ContextMenu>
        </>
    )
}
```

`trigger` supplies the contents of the native button rendered by `Menu`. Pass button attributes and handlers through `triggerProps`; do not nest another button inside it.

Action menus execute commands. Value selection in a form remains the responsibility of `@rentnerkev/select`.

[Full API & usage](./docs/usage.md) · [Local playground](./playground) · [MIT license](./LICENSE)

Run the playground from the repository root:

```bash
bun install --frozen-lockfile
bun run playground:install
bun run playground:dev
```

Open **http://127.0.0.1:4178**. The page contains compact menu examples and the last triggered action. Controlled state, RTL, viewport collisions, disabled items and the native-dialog integration test are under **Weitere Tests**.

## Features

- Action and context menus share one typed item model.
- Nested submenus open with the pointer or direction-aware keyboard navigation.
- Checkbox and radio items, labels, separators, disabled and destructive actions.
- Icons, descriptions and shortcut hints. Hints do not register global hotkeys.
- Controlled or uncontrolled open state, shared providers and slot `classNames`.
- Shared `--rentner-*` theme tokens, explicit portal containers and focus restoration.
- Arrow keys, Home/End, typeahead, Enter/Space, Escape and Tab.

## AI and read-only access

The separate `@rentnerkev/menu/ai` entry is for Node.js and Bun tooling. It reads
this installed package's manifest, README, usage guide and built TypeScript
declarations without importing React, mounting UI or performing network requests.
Keep it out of browser code.

```ts
import {
    getPackageInfo,
    getPackageApi,
    getPackageDocumentation,
    searchPackageDocumentation,
    getPackageExamples,
} from '@rentnerkev/menu/ai'

const info = getPackageInfo()
const api = getPackageApi({ symbol: 'Menu' })
const usage = getPackageDocumentation('usage')
const readme = getPackageDocumentation('readme')
const matches = searchPackageDocumentation('portal')
const examples = getPackageExamples()
```

Unknown public subpaths or symbols throw an error. Callers cannot supply file
paths. The `./ai` entry is excluded from the UI declaration context. Use the
documentation for the installed version.

## Development

Requires Bun 1.4.4 with native `bun fmt` support.

```bash
bun run typecheck
bun run lint
bun run format:check
bun test
bun run build
bun run pack:consumer
bun run playground:build
bunx playwright install chromium firefox webkit
bun run e2e
```

`bun run verify` runs the complete checks after browser installation. Library
components, hooks and types live under `src/shared/Menu`, UI-free logic under
`src/lib/Menu`, and tests mirror these modules in `src/tests`. The playground is
excluded from the published package.

## Releases

Publishing a stable GitHub release named `vMAJOR.MINOR.PATCH` triggers exact-tag
verification, a tag-derived npm version, tests, package build and npm publication
with provenance. A separate workflow generates the changelog and uploads the
shared release banner. A push or tag alone does not publish a package.

The npm Trusted Publisher authorizes GitHub owner `RentnerKev`, repository
`RentnerMenu` and workflow filename `npm-publish.yml`. Releases use short-lived
OIDC credentials without a stored npm token. See
[automation setup](.github/AUTOMATION.md).

## License

MIT © RentnerKev
