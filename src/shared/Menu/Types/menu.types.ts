import type {
    ButtonHTMLAttributes,
    CSSProperties,
    HTMLAttributes,
    HTMLAttributeAnchorTarget,
    ReactNode,
    Ref,
} from 'react'

export interface MenuSelectEvent {
    readonly id: string
    readonly originalEvent: Event
    readonly defaultPrevented: boolean
    preventDefault: () => void
}

interface MenuItemBase {
    id: string
    label: string
    icon?: ReactNode
    description?: string
    disabled?: boolean
    shortcut?: string
}

export interface MenuActionItem extends MenuItemBase {
    type?: 'item'
    danger?: boolean
    closeOnSelect?: boolean
    onSelect?: (event: MenuSelectEvent) => void
}

export interface MenuLinkItem extends MenuItemBase {
    type: 'link'
    href: string
    target?: HTMLAttributeAnchorTarget
    rel?: string
    download?: boolean | string
    closeOnSelect?: boolean
    onSelect?: (event: MenuSelectEvent) => void
}

export interface MenuCheckboxItem extends MenuItemBase {
    type: 'checkbox'
    checked: boolean | 'indeterminate'
    closeOnSelect?: boolean
    onCheckedChange: (checked: boolean) => void
}

export interface MenuRadioItem extends MenuItemBase {
    type: 'radio'
    name: string
    checked: boolean
    closeOnSelect?: boolean
    onCheckedChange: () => void
}

export interface MenuSubmenuItem extends MenuItemBase {
    type: 'submenu'
    items: readonly MenuItem[]
}

export interface MenuSeparatorItem {
    type: 'separator'
    id: string
}

export interface MenuLabelItem {
    type: 'label'
    id: string
    label: string
}

export type MenuItem =
    | MenuActionItem
    | MenuLinkItem
    | MenuCheckboxItem
    | MenuRadioItem
    | MenuSubmenuItem
    | MenuSeparatorItem
    | MenuLabelItem

export type MenuDirection = 'ltr' | 'rtl'
export type MenuSide = 'top' | 'right' | 'bottom' | 'left'
export type MenuAlign = 'start' | 'center' | 'end'

export interface MenuClassNames {
    trigger?: string
    target?: string
    portal?: string
    content?: string
    item?: string
    icon?: string
    label?: string
    description?: string
    shortcut?: string
    indicator?: string
    separator?: string
    groupLabel?: string
}

export interface MenuCustomizationProps {
    /** Blocks background interaction and scrolling while open. Defaults to false. */
    modal?: boolean
    dir?: MenuDirection
    controlSize?: 'sm' | 'md' | 'lg'
    side?: MenuSide
    align?: MenuAlign
    sideOffset?: number
    collisionPadding?: number
    loop?: boolean
    portalContainer?: Element | DocumentFragment | null
    portalZIndex?: number
    classNames?: MenuClassNames
    style?: CSSProperties
}

export interface MenuProviderProps extends MenuCustomizationProps {
    children: ReactNode
}

export interface MenuCommonProps extends MenuCustomizationProps {
    items: readonly MenuItem[]
    ariaLabel: string
    id?: string
    disabled?: boolean
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    onAction?: (id: string, event: MenuSelectEvent) => void
    onEscapeKeyDown?: (event: KeyboardEvent) => void
}

export interface MenuProps extends MenuCommonProps {
    /** Use a single custom button element as the trigger, forwarding its props/ref. */
    asChild?: boolean
    /** Content of the native button rendered by Menu; do not pass another button. */
    trigger?: ReactNode
    triggerRef?: Ref<HTMLButtonElement>
    triggerProps?: Omit<
        ButtonHTMLAttributes<HTMLButtonElement>,
        | 'children'
        | 'disabled'
        | 'aria-controls'
        | 'aria-expanded'
        | 'aria-haspopup'
    >
}

export interface ContextMenuProps extends MenuCommonProps {
    children: ReactNode
    targetRef?: Ref<HTMLDivElement>
    targetProps?: HTMLAttributes<HTMLDivElement>
    /** Enables a stationary touch press in addition to contextmenu and Shift+F10. */
    longPress?: boolean
}
