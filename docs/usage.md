# @rentnerkev/menu usage

The stable v1 public contract exports `Menu`, `ContextMenu`, `MenuProvider` and
its public TypeScript types. Narrow imports are available from
`@rentnerkev/menu/menu`, `/context-menu`, `/provider` and `/types`. The separate
`/ai` entry reads installed documentation using Node APIs and belongs in Node.js
or Bun tooling, outside browser code.

The [package overview](https://packages.rentner.dev/packages/menu) and
[online documentation](https://packages.rentner.dev/docs/menu) provide hosted
entry points. This guide is also shipped with the installed package.

## Items and selection

Item IDs must be stable and unique within a menu level; an empty-string ID is
supported. Labels are strings used for the accessible name and typeahead. Use
`icon`, `description` and `shortcut` for supplementary content. Shortcut hints do
not register hotkeys.

Action and link items may use `onSelect`; a menu can receive `onAction` for all
selections. Call the selection event's `preventDefault()` to keep the menu open,
or set `closeOnSelect: false`. Cancellation also prevents a link's native
navigation. It does not undo a checkbox/radio callback already delivered before
`onAction`. Callbacks are synchronous notifications: start asynchronous work in
your application and handle its pending state and failures there.

Checkbox and radio values remain application controlled:

```tsx
import { useState } from 'react'
import { Menu, type MenuItem } from '@rentnerkev/menu'

export function ViewMenu() {
    const [details, setDetails] = useState<boolean | 'indeterminate'>(
        'indeterminate',
    )
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

`checked: 'indeterminate'` exposes `aria-checked="mixed"`. Activating it requests
`true`; activating a checked item requests `false`. `onCheckedChange` always
receives a **boolean**, never `'indeterminate'`. The owner decides when to show a
mixed value. Radio items sharing a `name` form a group; maintain exactly one
checked value in your application.

## Native link items

Use `type: 'link'` with a required `href`. `target`, `rel` and `download` pass
through to the native anchor:

```tsx
import { Menu, type MenuItem } from '@rentnerkev/menu'

const items: readonly MenuItem[] = [
    {
        id: 'guide',
        type: 'link',
        label: 'Open guide',
        href: '/guide',
        target: '_blank',
        rel: 'noopener noreferrer',
    },
    {
        id: 'export',
        type: 'link',
        label: 'Download report',
        href: '/reports/latest.csv',
        download: 'report.csv',
    },
    {
        id: 'handled',
        type: 'link',
        label: 'Application navigation',
        href: '/settings',
        onSelect(event) {
            event.preventDefault()
            // Let the application's router handle this selection.
        },
    },
]

export function Resources() {
    return <Menu ariaLabel="Resources" trigger="Resources" items={items} />
}
```

Uncancelled links retain browser navigation, modified clicks, middle-click and
new-tab behavior. Ordinary Enter and Space activate the anchor through the menu;
modified Enter remains under browser control. The browser applies its usual
rules for downloads, targets and URLs. `closeOnSelect: false` keeps the menu open
without cancelling navigation. To cancel both navigation and dismissal, call
`preventDefault()` in the link's `onSelect` or the menu's `onAction`. Disabled
links have no active `href`, are skipped during navigation and cannot activate.

## Open state and customization

Use `defaultOpen` for uncontrolled state or `open` with `onOpenChange` for
controlled state. A controlled component requests a change; the owner must apply
it. External close/reopen updates restore the opening focus behavior.

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

Nested providers inherit defaults; local component props take priority. Use
`modal`, `dir`, `controlSize`, `side`, `align`, `sideOffset`, `collisionPadding`,
`loop`, `portalContainer`, `portalZIndex`, `classNames` and `style` for behavior
and layout. `style` applies to menu content; use `triggerProps.style` for the
trigger.

## Mouse hover opening

`Menu` keeps click, touch and keyboard activation by default. Since v1.0.1,
set `openOnHover` to also open a nonmodal menu with a mouse. Hover leaves the
currently focused control alone. `hoverOpenDelayMs` defaults to 100 and
`hoverCloseDelayMs` to 150; the closing delay bridges the trigger-to-popup gap
and is cancelled when the mouse enters any menu surface. Set the opening
delay to 0 for immediate opening. Touch, pen and compatibility mouse events
never open a menu through hover.

```tsx
import { Menu } from '@rentnerkev/menu'

export function HoverActions() {
    return (
        <Menu
            ariaLabel="Host actions"
            trigger="Actions"
            openOnHover
            hoverOpenDelayMs={100}
            hoverCloseDelayMs={150}
            items={[{ id: 'edit', label: 'Edit host' }]}
        />
    )
}
```

Use `open` with `onOpenChange` for controlled hover menus. Opening through the
keyboard transfers focus into the menu and cancels automatic hover closing;
Escape and action selection restore trigger focus. A click-opened menu stays
open when the mouse leaves. Hover is ignored when `modal` is true so merely
moving the pointer cannot block the page or its current focus. Disabled
triggers and custom trigger handlers that call `preventDefault()` are respected.

## Custom button triggers

By default, `trigger` supplies the contents of the native button rendered by
`Menu`; never nest another button inside that default trigger. Set `asChild` to
reuse exactly one button element instead. A custom React component must forward
all injected props, event handlers and the ref to its native button:

```tsx
import type { ComponentPropsWithRef } from 'react'
import { Menu } from '@rentnerkev/menu'

function ToolbarButton({ ref, ...props }: ComponentPropsWithRef<'button'>) {
    return <button {...props} ref={ref} />
}

export function CustomTrigger() {
    return (
        <Menu
            ariaLabel="Actions"
            asChild
            trigger={
                <ToolbarButton className="toolbar-button">
                    Actions
                </ToolbarButton>
            }
            items={[{ id: 'copy', label: 'Copy' }]}
        />
    )
}
```

Fragments, strings, multiple children and anchors are not valid `asChild`
triggers. The resulting element must be a native button. Child handlers run
before composed menu handlers and can cancel them with `preventDefault()`;
`triggerProps` supplies additional button attributes and handlers. Existing child
refs and `triggerRef` are preserved, including React 19 callback-ref cleanup.

## Optional modal interaction

`modal` defaults to **false** for both menu components and providers. In this
mode, background content and scrolling remain available; an outside pointer or
focus transition dismisses the menu. Escape or selection restores focus to the
trigger, or the originating descendant for a context menu. Tab dismisses the
menu and continues native page navigation.

Set `modal` on a menu or `MenuProvider` to block background interaction while it
is open. Focus is kept within the open menu surfaces, background branches become
inert and hidden from assistive technology, and document/body scrolling is
locked. An outside interaction dismisses the menu and is consumed instead of
activating the background control. Tab still dismisses the menu and continues
native navigation; this is a menu, not a dialog with a cycling Tab order.

On close or unmount, the modal manager releases its background restrictions and
restores the previous `inert`, `aria-hidden`, pointer styles and scroll overflow
styles. Dismissal restores origin focus after those restrictions are released.
Controlled owners must accept close requests before the restrictions are removed.
Modal mode does not replace your application's surrounding dialog lifecycle.

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

## Keyboard, pointer and context menus

Menu buttons open with Enter, Space or ArrowDown; ArrowUp starts at the last
enabled item. ArrowUp/Down move through enabled items, Home/End select an edge,
and typing characters searches labels. Repeating a character cycles matching
items. Enter and Space activate the focused item. Shortcut hints do not add
hotkey handlers.

The direction-aware horizontal arrow opens a submenu or returns to its parent:
in LTR, ArrowRight opens and ArrowLeft returns; RTL reverses those directions.
Submenus also support diagonal pointer travel: a short pointer corridor delays
switching sibling items while the pointer moves toward the open submenu. Moving
outside the corridor resumes the sibling's normal hover behavior.

Escape closes the focused submenu first, restoring focus to its parent item;
press Escape again to close each remaining level and then the root menu. Root
dismissal by Escape or selection returns focus to the originating control. Tab
closes the menu and continues page navigation. Disabled items are skipped by
arrow navigation and typeahead and cannot activate. Set `loop={false}` to stop
at either edge.

`ContextMenu` opens on a native `contextmenu` event or Shift+F10/ContextMenu key
while its target has focus. Set `longPress` for a stationary touch press. An
explicit visible menu button remains useful for discoverability on touch devices.

## Dialogs and portals

If a menu is inside a native modal dialog or a dialog library with a focus trap,
pass a `portalContainer` **inside the dialog's focus boundary**. A body portal can
otherwise become inert or fall outside the focus scope. Native popover support
keeps menu content in the top layer where available. The playground includes a
working native-dialog fixture.

Some dialog libraries listen for Escape during document capture. Configure the
dialog's dismissal hook to defer to a currently open child menu; a child menu
cannot reverse dismissal that an ancestor already performed. `onEscapeKeyDown`
allows menu consumers to cancel the menu's own Escape handling. Repeated Escape
through menu levels does not require closing the surrounding dialog.

## v1 source compatibility

The v1 public exports and behavior documented here form the stable public
contract. Consumers upgrading from 0.x should check exhaustive TypeScript code:

- `MenuItem` now includes the `type: 'link'` branch. Update exhaustive switches,
  custom renderers and helpers that assumed every interactive item was a button.
- `MenuCheckboxItem.checked` is now `boolean | 'indeterminate'`. Narrow it before
  passing it to boolean-only APIs. `onCheckedChange` still receives only a
  boolean; application state can accept it while retaining the wider display type.
- `asChild` and `modal` are opt-in. Existing content-only triggers and nonmodal
  menus retain their defaults.

Keep `items` and nested `items` arrays immutable. Replace changed item objects
and arrays when updating controlled values or labels so cached navigation and
memoized presentation receive the update.

## Installed documentation and remote MCP

Online resources are available as the [AI package guide](https://packages.rentner.dev/ai/menu),
[JSON package API](https://packages.rentner.dev/api/ai/packages/menu), and
[remote MCP endpoint](https://packages.rentner.dev/mcp). Connect a compatible MCP
client to the remote endpoint for the hosted package documentation service. It
is separate from the installed-version helpers and may describe a different
published version.

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

These read-only helpers inspect only allowlisted documentation and declaration
files from the installed package. Importing the `/ai` entry does not mount UI,
perform network requests or execute menu actions. The helpers read local files
when called; they do not start a server, connect to remote MCP or install
anything. Use them when you need the exact installed version's APIs and examples.
