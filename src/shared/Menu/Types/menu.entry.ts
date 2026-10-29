import type { HTMLAttributes, PointerEvent } from 'react'
import type { MenuClassNames, MenuDirection, MenuItem } from './menu.types.ts'

export interface MenuEntryProps {
    menuId: string
    item: MenuItem
    level: number
    dir: MenuDirection
    classNames: MenuClassNames | undefined
    expanded: boolean
    setItemNode: (
        level: number,
        id: string,
        node: HTMLButtonElement | HTMLAnchorElement | null,
    ) => void
    handleItemEnter: (
        level: number,
        id: string,
        event: PointerEvent<HTMLElement>,
    ) => void
    handleItemFocus: (level: number, id: string) => void
    handleItemLeave: (
        level: number,
        id: string,
        event: PointerEvent<HTMLElement>,
    ) => void
    handleSelect: (level: number, id: string, originalEvent: Event) => void
}

export type MenuEntryAttributes = HTMLAttributes<HTMLElement> & {
    'data-menu-item-id': string
    'data-rentner-menu-item': string
    'data-danger': boolean | undefined
}
