import { memo } from 'react'
import { createPortal } from 'react-dom'
import { useMenuSurface } from '../Hooks/useMenuSurface.ts'
import type {
    MenuLogicResult,
    MenuSurfaceProps,
} from '../Types/menu.internal.ts'
import type { MenuAsyncActionState } from '../Types/menu.actions.ts'
import type {
    MenuClassNames,
    MenuDirection,
    MenuItem,
} from '../Types/menu.types.ts'
import type { groupMenuItems } from '../../../lib/Menu/navigation.ts'
import { InteractiveMenuEntry, renderStaticMenuEntry } from './MenuEntry.tsx'

const BASE_CONTENT_CLASS =
    'pointer-events-auto m-0 min-w-[var(--rentner-menu-content-min-width,12rem)] overflow-y-auto overscroll-contain rounded-[var(--rentner-menu-content-radius,var(--rentner-radius,0.75rem))] border-[length:var(--rentner-menu-content-border-width,1px)] border-rentner-border bg-rentner-surface p-[var(--rentner-menu-content-padding,0.375rem)] font-sans text-sm text-rentner-foreground shadow-xl outline-none'

interface MenuSurfaceItemsProps {
    items: readonly MenuItem[] | undefined
    groups: ReturnType<typeof groupMenuItems> | null
    actionStates: ReadonlyMap<string, MenuAsyncActionState> | undefined
    actionPrefix: string
    menuId: string
    dir: MenuDirection
    classNames: MenuClassNames | undefined
    expandedId: string | undefined
    level: number
    reserveIcon: boolean
    reserveIndicator: boolean
    setItemNode: MenuLogicResult['handler']['setItemNode']
    handleItemEnter: MenuLogicResult['handler']['handleItemEnter']
    handleItemFocus: MenuLogicResult['handler']['handleItemFocus']
    handleSelect: MenuLogicResult['handler']['handleSelect']
    handleItemLeave: MenuLogicResult['handler']['handleItemLeave']
}

const MenuSurfaceItems = memo(function MenuSurfaceItems({
    items,
    groups,
    actionStates,
    actionPrefix,
    menuId,
    dir,
    classNames,
    expandedId,
    level,
    reserveIcon,
    reserveIndicator,
    setItemNode,
    handleItemEnter,
    handleItemFocus,
    handleSelect,
    handleItemLeave,
}: MenuSurfaceItemsProps) {
    const renderEntry = (item: MenuItem) =>
        item.type === 'separator' || item.type === 'label' ? (
            renderStaticMenuEntry(item, classNames)
        ) : (
            <InteractiveMenuEntry
                key={item.id}
                item={item}
                actionState={
                    actionStates
                        ? actionStates.get(
                              `${actionPrefix}${JSON.stringify(item.id)}]`,
                          )
                        : undefined
                }
                menuId={menuId}
                dir={dir}
                classNames={classNames}
                expanded={expandedId === item.id}
                setItemNode={setItemNode}
                handleItemEnter={handleItemEnter}
                handleItemFocus={handleItemFocus}
                handleSelect={handleSelect}
                handleItemLeave={handleItemLeave}
                level={level}
                reserveIcon={reserveIcon}
                reserveIndicator={reserveIndicator}
            />
        )

    if (!groups) {
        return items ? items.map(renderEntry) : null
    }

    return groups.map((group) =>
        group.name !== undefined ? (
            <fieldset
                key={group.id}
                aria-label={group.name}
                className="m-0 min-w-0 border-0 p-0"
            >
                {group.items.map(renderEntry)}
            </fieldset>
        ) : (
            renderEntry(group.items[0]!)
        ),
    )
})

export function MenuSurface({ menu, level }: MenuSurfaceProps) {
    const {
        state,
        handler: { setSurface },
    } = useMenuSurface({ menu, level })
    const expandedId = menu.state.path[level]
    const activeActionStates =
        menu.state.actionStates.size > 0 ? menu.state.actionStates : undefined
    const actionPrefix = activeActionStates
        ? level > 0
            ? `${JSON.stringify(menu.state.path.slice(0, level)).slice(0, -1)},`
            : '['
        : ''
    const isModalRoot = Boolean(menu.state.customization.modal) && level === 0
    const contentClassName = menu.state.customization.classNames?.content
        ? `${BASE_CONTENT_CLASS} ${menu.state.customization.classNames.content}`
        : BASE_CONTENT_CLASS

    return createPortal(
        <section
            role={isModalRoot ? 'dialog' : undefined}
            aria-modal={isModalRoot ? true : undefined}
            aria-label={state.surfaceLabel}
            data-rentner-menu-portal
            className={`${isModalRoot ? 'pointer-events-none fixed inset-0 bg-black/25' : ''} ${menu.state.customization.classNames?.portal ?? ''}`}
            style={
                isModalRoot
                    ? { zIndex: menu.state.customization.portalZIndex ?? 1000 }
                    : undefined
            }
        >
            <div
                ref={setSurface}
                id={`${menu.state.id}-content-${level}`}
                role="menu"
                tabIndex={-1}
                aria-label={level ? undefined : menu.state.ariaLabel}
                aria-labelledby={
                    level
                        ? `${menu.state.id}-item-${level - 1}-${encodeURIComponent(menu.state.path[level - 1] ?? '')}`
                        : undefined
                }
                aria-orientation="vertical"
                aria-owns={
                    expandedId !== undefined
                        ? `${menu.state.id}-content-${level + 1}`
                        : undefined
                }
                dir={menu.state.dir}
                data-rentner-menu-content=""
                data-side={state.position?.side}
                data-size={menu.state.customization.controlSize ?? 'md'}
                className={contentClassName}
                style={{
                    ...menu.state.customization.style,
                    position: 'fixed',
                    inset: 'auto',
                    left: state.position?.left ?? 0,
                    top: state.position?.top ?? 0,
                    maxWidth: state.position?.maxWidth ?? 'calc(100vw - 16px)',
                    maxHeight:
                        state.position?.maxHeight ?? 'calc(100dvh - 16px)',
                    visibility: state.position ? 'visible' : 'hidden',
                    zIndex:
                        (menu.state.customization.portalZIndex ?? 1000) + level,
                }}
                onKeyDown={(event) => menu.handler.handleKeyDown(level, event)}
                onPointerEnter={(event) =>
                    menu.handler.handleSurfaceEnter(level, event)
                }
                onPointerMove={
                    expandedId !== undefined
                        ? (event) =>
                              menu.handler.handleSurfacePointerMove(
                                  level,
                                  event,
                              )
                        : undefined
                }
                onPointerLeave={(event) =>
                    menu.handler.handleSurfaceLeave(level, event)
                }
            >
                <MenuSurfaceItems
                    items={state.items}
                    groups={state.groups}
                    actionStates={activeActionStates}
                    actionPrefix={actionPrefix}
                    menuId={menu.state.id}
                    dir={menu.state.dir}
                    classNames={menu.state.customization.classNames}
                    expandedId={expandedId}
                    level={level}
                    reserveIcon={state.reserveIcon}
                    reserveIndicator={state.reserveIndicator}
                    setItemNode={menu.handler.setItemNode}
                    handleItemEnter={menu.handler.handleItemEnter}
                    handleItemFocus={menu.handler.handleItemFocus}
                    handleSelect={menu.handler.handleSelect}
                    handleItemLeave={menu.handler.handleItemLeave}
                />
            </div>
        </section>,
        menu.state.customization.portalContainer ?? menu.state.portalHost!,
    )
}
