# RentnerMenu

Dropdown menus, right-click context menus and nested submenus for React 19.
Built with React and browser APIs, without another runtime UI dependency.

This is the first, experimental `0.1.0` implementation. The source and playground
are available for testing; an npm release is a separate, deliberate step.

## Try the playground

Requires Bun 1.4.4 or newer with native `bun fmt` support.

```sh
bun install --frozen-lockfile
bun run playground:install
bun run playground:dev
```

Open **http://127.0.0.1:4178**. The playground includes dropdown and context menus,
nested menus, controlled checkboxes and radio items, disabled and destructive
actions, keyboard navigation, viewport collisions, RTL and a native dialog.
Actions only modify the playground's demo state.

## Use the package

After an npm release:

```sh
npm install @rentnerkev/menu
```

```sh
bun add @rentnerkev/menu
```

React and React DOM 19 are peer dependencies. Import the stylesheet in your
Tailwind CSS 4 entry:

```css
@import 'tailwindcss';
@import '@rentnerkev/menu/tailwind.css';
```

```tsx
import { Menu, ContextMenu, type MenuItem } from '@rentnerkev/menu'

const items: readonly MenuItem[] = [
    { id: 'open', label: 'Öffnen', onSelect: () => console.log('open') },
    {
        id: 'export',
        type: 'submenu',
        label: 'Exportieren',
        items: [
            { id: 'pdf', label: 'Als PDF' },
            { id: 'text', label: 'Als Text' },
        ],
    },
    { id: 'separator', type: 'separator' },
    { id: 'delete', label: 'Löschen', danger: true },
]

export function FileActions() {
    return (
        <>
            <Menu ariaLabel="Dateiaktionen" trigger="Aktionen" items={items} />
            <ContextMenu ariaLabel="Datei-Kontextmenü" items={items}>
                <p>Hier rechtsklicken oder den Bereich mit Shift+F10 öffnen.</p>
            </ContextMenu>
        </>
    )
}
```

`trigger` supplies the **contents** of the native button rendered by `Menu`.
Do not put another button inside it. Supply button attributes and event handlers
through `triggerProps`.

## Features and boundaries

- Shared item model for dropdowns and context menus, including nested submenus.
- Action, checkbox, radio, label and separator items; icons, descriptions and
  shortcut hints. Shortcut hints are visual labels, not global hotkey bindings.
- Arrow keys, Home/End, typeahead, Enter/Space, Escape and Tab; RTL navigation.
- Controlled or uncontrolled open state, controlled selection, provider defaults,
  CSS variables and slot `classNames`.
- Explicit portal containers, viewport collision handling and focus restoration.
- Browser, interaction, accessibility, SSR and packed-consumer verification.

See [usage and API notes](docs/usage.md) for selection, styling, portals, keyboard
behavior and integration with dialogs. An automated accessibility scan does not
replace testing with your target assistive technology and application.

## Development

```sh
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

`bun run verify` runs the complete checks after browser installation. Source lives
under `src/shared/Menu` and `src/lib/Menu`; tests mirror those modules in
`src/tests`. Playground code is kept separate and is excluded from npm artifacts.

GitHub automation includes CI, Dependabot, dependency auditing, CodeQL, Gitleaks,
workflow linting and guarded release workflows. npm trusted publishing must be
configured for this repository before its first npm release; see
[automation setup](.github/AUTOMATION.md).

MIT © RentnerKev
