import { useCallback } from 'react'
import type { MouseEvent, PointerEvent } from 'react'
import type {
    MenuEntryAttributes,
    MenuEntryProps,
} from '../Types/menu.entry.ts'

const BASE_ITEM_CLASS =
    'flex min-h-[var(--rentner-menu-item-min-height,var(--rentner-menu-size-item-min-height,2.25rem))] w-full cursor-default select-none items-center gap-[var(--rentner-menu-item-gap,0.625rem)] rounded-[var(--rentner-menu-item-radius,0.375rem)] border-0 bg-transparent px-[var(--rentner-menu-item-padding-x,0.625rem)] py-[var(--rentner-menu-item-padding-y,var(--rentner-menu-size-item-padding-y,0.5rem))] text-start text-inherit no-underline outline-none focus:bg-rentner-control data-[danger=true]:text-rentner-danger aria-disabled:opacity-40'

function preventDisabledPointerDown(event: PointerEvent<HTMLElement>) {
    event.preventDefault()
}

export function useMenuEntry({
    menuId,
    item,
    level,
    expanded,
    actionState,
    classNames,
    setItemNode,
    handleItemEnter,
    handleItemFocus,
    handleItemLeave,
    handleSelect,
}: MenuEntryProps) {
    const disabled =
        ('disabled' in item && item.disabled) || actionState === 'pending'
    const setNode = useCallback(
        (node: HTMLButtonElement | HTMLAnchorElement | null) =>
            setItemNode(level, item.id, node),
        [setItemNode, level, item.id],
    )
    const handleFocus = disabled
        ? undefined
        : () => handleItemFocus(level, item.id)
    const handlePointerEnter = disabled
        ? undefined
        : (event: PointerEvent<HTMLElement>) =>
              handleItemEnter(level, item.id, event)
    const handlePointerDown = disabled ? preventDisabledPointerDown : undefined
    const handlePointerLeave =
        disabled || !expanded
            ? undefined
            : (event: PointerEvent<HTMLElement>) =>
                  handleItemLeave(level, item.id, event)
    const handleClick = (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        if (disabled) {
            event.preventDefault()
            return
        }
        if (!event.defaultPrevented)
            handleSelect(level, item.id, event.nativeEvent)
    }
    const handleAuxClick =
        item.type === 'link'
            ? (event: MouseEvent<HTMLElement>) => {
                  if (disabled || event.button === 1) handleClick(event)
              }
            : undefined

    const encodedId = encodeURIComponent(item.id)
    const idSuffix = `${level}-${encodedId}`
    const labelId = `${menuId}-label-${idSuffix}`
    const hasDescription =
        item.type !== 'separator' &&
        item.type !== 'label' &&
        Boolean(item.description)
    const descriptionId = hasDescription
        ? `${menuId}-description-${idSuffix}`
        : undefined
    const errorId =
        actionState === 'error' ? `${menuId}-error-${idSuffix}` : undefined
    const describedBy =
        descriptionId && errorId
            ? `${descriptionId} ${errorId}`
            : (descriptionId ?? errorId)

    const attributes: MenuEntryAttributes = {
        id: `${menuId}-item-${idSuffix}`,
        role:
            item.type === 'checkbox'
                ? 'menuitemcheckbox'
                : item.type === 'radio'
                  ? 'menuitemradio'
                  : 'menuitem',
        tabIndex: -1,
        'aria-labelledby': labelId,
        'aria-describedby': describedBy,
        'aria-disabled': disabled || undefined,
        'aria-busy': actionState === 'pending' || undefined,
        'data-pending': actionState === 'pending' || undefined,
        'data-error': actionState === 'error' || undefined,
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
        className: classNames?.item
            ? `${BASE_ITEM_CLASS} ${classNames.item}`
            : BASE_ITEM_CLASS,
    }
    return {
        state: { attributes, labelId, descriptionId, errorId },
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
