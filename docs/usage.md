# @rentnerkev/menu usage

The package exports `Menu`, `ContextMenu`, `MenuProvider` and its public TypeScript
types. Narrow imports are available from `@rentnerkev/menu/menu`, `/context-menu`,
`/provider` and `/types`. The separate `/ai` entry reads installed documentation
using Node APIs and must not be imported into browser code.

## Items and selection

Item IDs must be stable and unique within a menu level. Labels are strings, used
for the accessible name and typeahead. Use `icon`, `description` and `shortcut`
for supplementary content. `shortcut` does not register a keyboard shortcut.

Actions may use `onSelect`, and a menu can receive `onAction` for all selections.
Call the selection event's `preventDefault()` to keep the menu open, or use
`closeOnSelect: false`. Checkbox and radio values remain application controlled:

```tsx
import { useState } from 'react'
import { Menu, type MenuItem } from '@rentnerkev/menu'

export function ViewMenu() {
    const [details, setDetails] = useState(true)
    const [view, setView] = useState('list')
    const items: readonly MenuItem[] = [
        {
            id: 'details',
            type: 'checkbox',
            label: 'Details anzeigen',
            checked: details,
            onCheckedChange: setDetails,
            closeOnSelect: false,
        },
        { id: 'separator', type: 'separator' },
        {
            id: 'list',
            type: 'radio',
            name: 'view',
            label: 'Liste',
            checked: view === 'list',
            onCheckedChange: () => setView('list'),
            closeOnSelect: false,
        },
        {
            id: 'grid',
            type: 'radio',
            name: 'view',
            label: 'Kacheln',
            checked: view === 'grid',
            onCheckedChange: () => setView('grid'),
            closeOnSelect: false,
        },
    ]
    return <Menu ariaLabel="Ansicht" trigger="Ansicht" items={items} />
}
```

Radio items sharing a `name` belong to the same logical group. Your application
is responsible for maintaining exactly one checked value in the group. Handlers
are synchronous notifications: start asynchronous work in your application and
handle pending states and failures there.

## Open state and customization

Use `defaultOpen` for uncontrolled state or `open` with `onOpenChange` for
controlled state. A controlled component asks its owner to change the state;
the owner must apply the update.

```tsx
import { Menu, MenuProvider } from '@rentnerkev/menu'

export function Toolbar() {
    return (
        <MenuProvider dir="ltr" controlSize="md" align="end" sideOffset={6}>
            <Menu
                ariaLabel="Werkzeuge"
                trigger="Werkzeuge"
                items={[{ id: 'inspect', label: 'Untersuchen' }]}
                triggerProps={{ title: 'Werkzeuge öffnen' }}
                classNames={{ content: 'min-w-64', item: 'font-medium' }}
            />
        </MenuProvider>
    )
}
```

Nested providers inherit defaults; local component props take priority.
Use `dir`, `controlSize`, `side`, `align`, `sideOffset`, `collisionPadding`,
`loop`, `portalContainer`, `portalZIndex`, `classNames` and `style` for layout.
`style` applies to menu content; use `triggerProps.style` for the trigger.

## Styling

Import `@rentnerkev/menu/tailwind.css` from a Tailwind CSS 4 stylesheet. It loads
the shared token definitions and scans the built package. The default appearance
uses the same `--rentner-*` tokens as the other RentnerKev components:

```css
:root {
    --rentner-surface: #181a1f;
    --rentner-control: #22252b;
    --rentner-foreground: #f3f4f6;
    --rentner-muted: #9ca3af;
    --rentner-border: #2e323b;
    --rentner-accent: #13ecd6;
    --rentner-radius: 0.75rem;
}
```

Portal content inherits CSS variables from its **DOM container**, not from the
React parent. Put shared tokens on `:root`, or pass a themed `portalContainer`.
Runtime positioning uses inline styles; a CSP must permit your application's
chosen dynamic styling approach. No remote font or external asset is required.

## Keyboard and context menus

Menu buttons open with Enter, Space or ArrowDown; ArrowUp starts at the last
enabled item. ArrowUp/Down move through enabled items, Home/End select an edge,
and typing characters searches labels. Enter and Space activate an item.
The direction-aware horizontal arrow opens a submenu or returns to its parent.

Escape closes the current submenu first, then the root menu. Root dismissal by
Escape or selection returns focus to the originating control. Tab closes the
menu and continues normal page navigation. Disabled items are skipped by arrow
navigation and cannot be activated. Set `loop={false}` to stop at either edge.

`ContextMenu` opens on a native `contextmenu` event or Shift+F10/ContextMenu key
while its target has focus. Set `longPress` for a stationary touch press. An
explicit visible menu button is still useful for discoverability on touch devices.

## Dialogs and portals

If a menu is inside a native modal dialog or a dialog library with a focus trap,
pass a `portalContainer` **inside the dialog's focus boundary**. A body portal can
otherwise become inert or fall outside the focus scope. The playground includes
a working native-dialog fixture.

Some dialog libraries listen for Escape during document capture. Configure the
dialog's dismissal hook to defer to a currently open child menu; a child menu
cannot reverse dismissal that an ancestor already performed. `onEscapeKeyDown`
allows menu consumers to cancel the menu's own Escape handling.

## Installed documentation

```ts
import {
    getPackageInfo,
    getPackageApi,
    getPackageDocumentation,
    getPackageExamples,
    searchPackageDocumentation,
} from '@rentnerkev/menu/ai'

console.log(getPackageInfo())
console.log(getPackageApi({ symbol: 'Menu' }))
console.log(getPackageDocumentation('usage').content)
console.log(getPackageExamples())
console.log(searchPackageDocumentation('portal'))
```

These helpers read only allowlisted documentation and declaration files from the
installed package. They do not install dependencies or execute menu actions.
