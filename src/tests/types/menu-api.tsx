import {
    Menu,
    ContextMenu,
    MenuProvider,
    type MenuItem,
    type MenuProps,
    type MenuPositioningProps,
    type MenuStyle,
} from '../../index.ts'
import { Menu as DirectMenu } from '../../shared/Menu/Components/Menu.tsx'

const items = [
    {
        id: 'copy',
        label: 'Kopieren',
        onSelect: (event) => event.preventDefault(),
    },
    {
        id: 'show',
        type: 'checkbox',
        label: 'Anzeigen',
        checked: true,
        onCheckedChange: (_value: boolean) => {},
    },
    {
        id: 'list',
        type: 'radio',
        name: 'view',
        label: 'Liste',
        checked: true,
        onCheckedChange: () => {},
    },
    {
        id: 'more',
        type: 'submenu',
        label: 'Mehr',
        items: [{ id: 'nested', label: 'Unterpunkt' }],
    },
    {
        id: 'docs',
        type: 'link',
        label: 'Dokumentation',
        href: '/docs',
        target: '_blank',
        rel: 'noopener',
    },
    {
        id: 'mixed',
        type: 'checkbox',
        label: 'Gemischt',
        checked: 'indeterminate',
        onCheckedChange: (_checked: boolean) => {},
    },
    { id: 'separator', type: 'separator' },
    { id: 'heading', type: 'label', label: 'Aktionen' },
] satisfies readonly MenuItem[]

export function PublicApiContract() {
    const contextMenu: MenuPositioningProps = { align: 'start', sideOffset: 8 }
    const style: MenuStyle = {
        '--rentner-menu-content-padding': '0.5rem',
        '--rentner-menu-item-radius': '0.25rem',
    }
    const props: MenuProps = {
        ariaLabel: 'Aktionen',
        items,
        align: 'end',
        dir: 'rtl',
        openOnHover: true,
        hoverOpenDelayMs: 100,
        hoverCloseDelayMs: 150,
    }
    return (
        <MenuProvider
            controlSize="sm"
            menu={{ align: 'end' }}
            contextMenu={contextMenu}
            classNames={{ submenuIndicator: 'text-inherit' }}
            style={style}
        >
            <Menu {...props} />
            <DirectMenu {...props} />
            <Menu
                {...props}
                modal
                asChild
                trigger={<button>Eigener Trigger</button>}
            />
            <ContextMenu ariaLabel="Kontext" items={items}>
                <span>Datei</span>
            </ContextMenu>
        </MenuProvider>
    )
}

// @ts-expect-error A checkbox requires a controlled checked state and change callback.
const invalidCheckbox: MenuItem = {
    id: 'broken',
    type: 'checkbox',
    label: 'Ungültig',
}
void invalidCheckbox

// @ts-expect-error Menus require a useful accessible label.
const invalidProps: MenuProps = { items }
void invalidProps
