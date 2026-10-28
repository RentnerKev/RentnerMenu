import {
    Menu,
    ContextMenu,
    MenuProvider,
    type MenuItem,
    type MenuProps,
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
    { id: 'separator', type: 'separator' },
    { id: 'heading', type: 'label', label: 'Aktionen' },
] satisfies readonly MenuItem[]

export function PublicApiContract() {
    const props: MenuProps = {
        ariaLabel: 'Aktionen',
        items,
        align: 'end',
        dir: 'rtl',
    }
    return (
        <MenuProvider controlSize="sm">
            <Menu {...props} />
            <DirectMenu {...props} />
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
