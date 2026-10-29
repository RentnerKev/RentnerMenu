import { useCallback } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import type {
    MenuEntryAttributes,
    MenuEntryProps,
} from '../Types/menu.entry.ts'

export function useMenuEntry({
    menuId,
    item,
    level,
    expanded,
    classNames,
    setItemNode,
    handleItemEnter,
    handleItemFocus,
    handleItemLeave,
    handleSelect,
}: MenuEntryProps) {
    const disabled = 'disabled' in item && item.disabled
    const setNode = useCallback(
        (node: HTMLButtonElement | HTMLAnchorElement | null) =>
            setItemNode(level, item.id, node),
        [setItemNode, level, item.id],
    )
    const handleFocus = useCallback(() => {
        if (!disabled) handleItemFocus(level, item.id)
    }, [handleItemFocus, level, item.id, disabled])
    const handlePointerEnter = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (!disabled) handleItemEnter(level, item.id, event)
        },
        [handleItemEnter, level, item.id, disabled],
    )
    const handlePointerDown = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (disabled) event.preventDefault()
        },
        [disabled],
    )
    const handlePointerLeave = useCallback(
        (event: PointerEvent<HTMLElement>) => {
            if (!disabled) handleItemLeave(level, item.id, event)
        },
        [handleItemLeave, level, item.id, disabled],
    )
    const handleClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            event.stopPropagation()
            if (disabled) {
                event.preventDefault()
                return
            }
            if (!event.defaultPrevented)
                handleSelect(level, item.id, event.nativeEvent)
        },
        [handleSelect, level, item.id, disabled],
    )
    const handleAuxClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (disabled || event.button === 1) handleClick(event)
        },
        [handleClick, disabled],
    )
    const attributes: MenuEntryAttributes = {
        id: `${menuId}-item-${level}-${encodeURIComponent(item.id)}`,
        role:
            item.type === 'checkbox'
                ? 'menuitemcheckbox'
                : item.type === 'radio'
                  ? 'menuitemradio'
                  : 'menuitem',
        tabIndex: -1,
        'aria-labelledby': `${menuId}-label-${level}-${encodeURIComponent(item.id)}`,
        'aria-describedby':
            item.type !== 'separator' &&
            item.type !== 'label' &&
            item.description
                ? `${menuId}-description-${level}-${encodeURIComponent(item.id)}`
                : undefined,
        'aria-disabled': disabled || undefined,
        'aria-checked':
            item.type === 'checkbox'
                ? item.checked === 'indeterminate'
                    ? 'mixed'
                    : item.checked
                : item.type === 'radio'
                  ? item.checked
                  : undefined,
        'aria-haspopup': item.type === 'submenu' ? 'menu' : undefined,
        'aria-expanded': item.type === 'submenu' ? expanded : undefined,
        'aria-controls':
            item.type === 'submenu' && expanded
                ? `${menuId}-content-${level + 1}`
                : undefined,
        'data-menu-item-id': item.id,
        'data-rentner-menu-item': '',
        'data-danger':
            item.type === undefined || item.type === 'item'
                ? item.danger || undefined
                : undefined,
        className: `flex min-h-9 w-full cursor-default select-none items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-start text-inherit no-underline outline-none focus:bg-rentner-control data-[danger=true]:text-rentner-danger aria-disabled:opacity-40 ${classNames?.item ?? ''}`,
    }
    return {
        state: { attributes },
        handler: {
            handleClick,
            handleAuxClick,
            handleFocus,
            handlePointerEnter,
            handlePointerDown,
            handlePointerLeave,
        },
        refs: { setNode },
    }
}
