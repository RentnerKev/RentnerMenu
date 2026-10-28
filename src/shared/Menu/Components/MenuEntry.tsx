import type { InteractiveItem } from '../../../lib/Menu/navigation.ts'
import type { MenuItem } from '../Types/menu.types.ts'
import type { MenuSurfaceProps } from '../Types/menu.internal.ts'
import { MenuIndicator } from './MenuIndicator.tsx'
function MenuItemContent({
    item,
    menu,
    level,
}: {
    item: InteractiveItem
    menu: MenuSurfaceProps['menu']
    level: number
}) {
    return (
        <>
            <span
                aria-hidden="true"
                data-rentner-menu-indicator
                className={`flex w-4 shrink-0 items-center justify-center text-rentner-accent ${menu.state.customization.classNames?.indicator ?? ''}`}
            >
                {(item.type === 'checkbox' || item.type === 'radio') &&
                    item.checked && (
                        <MenuIndicator
                            kind={item.type === 'radio' ? 'radio' : 'check'}
                        />
                    )}
                {item.icon && (
                    <span className={menu.state.customization.classNames?.icon}>
                        {item.icon}
                    </span>
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span
                    id={`${menu.state.id}-label-${level}-${encodeURIComponent(item.id)}`}
                    data-rentner-menu-label
                    className={`block ${menu.state.customization.classNames?.label ?? ''}`}
                >
                    {item.label}
                </span>
                {item.description && (
                    <span
                        id={`${menu.state.id}-description-${level}-${encodeURIComponent(item.id)}`}
                        data-rentner-menu-description
                        className={`mt-0.5 block text-xs text-rentner-muted ${menu.state.customization.classNames?.description ?? ''}`}
                    >
                        {item.description}
                    </span>
                )}
            </span>
            {item.shortcut && (
                <span
                    aria-hidden="true"
                    data-rentner-menu-shortcut
                    className={`ms-5 text-xs text-rentner-muted ${menu.state.customization.classNames?.shortcut ?? ''}`}
                >
                    {item.shortcut}
                </span>
            )}
            {item.type === 'submenu' && (
                <MenuIndicator kind="arrow" rtl={menu.state.dir === 'rtl'} />
            )}
        </>
    )
}

export function MenuEntry({
    item,
    menu,
    level,
}: {
    item: MenuItem
    menu: MenuSurfaceProps['menu']
    level: number
}) {
    if (item.type === 'separator')
        return (
            <hr
                aria-orientation="horizontal"
                data-rentner-menu-separator
                className={`my-1.5 h-px border-0 bg-rentner-border ${menu.state.customization.classNames?.separator ?? ''}`}
            />
        )
    if (item.type === 'label')
        return (
            <div
                role="presentation"
                data-rentner-menu-group-label
                className={`px-2.5 py-1.5 text-xs font-semibold text-rentner-muted ${menu.state.customization.classNames?.groupLabel ?? ''}`}
            >
                {item.label}
            </div>
        )
    return (
        <button
            type="button"
            ref={(node) => menu.handler.setItemNode(level, item.id, node)}
            id={`${menu.state.id}-item-${level}-${encodeURIComponent(item.id)}`}
            role={
                item.type === 'checkbox'
                    ? 'menuitemcheckbox'
                    : item.type === 'radio'
                      ? 'menuitemradio'
                      : 'menuitem'
            }
            tabIndex={-1}
            aria-labelledby={`${menu.state.id}-label-${level}-${encodeURIComponent(item.id)}`}
            aria-describedby={
                item.description
                    ? `${menu.state.id}-description-${level}-${encodeURIComponent(item.id)}`
                    : undefined
            }
            aria-disabled={item.disabled || undefined}
            aria-checked={
                item.type === 'checkbox' || item.type === 'radio'
                    ? item.checked
                    : undefined
            }
            aria-haspopup={item.type === 'submenu' ? 'menu' : undefined}
            aria-expanded={
                item.type === 'submenu'
                    ? menu.state.path[level] === item.id
                    : undefined
            }
            aria-controls={
                item.type === 'submenu' && menu.state.path[level] === item.id
                    ? `${menu.state.id}-content-${level + 1}`
                    : undefined
            }
            data-menu-item-id={item.id}
            data-rentner-menu-item=""
            data-danger={
                item.type === undefined || item.type === 'item'
                    ? item.danger || undefined
                    : undefined
            }
            className={`flex min-h-9 w-full cursor-default select-none items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-start text-inherit outline-none focus:bg-rentner-control data-[danger=true]:text-rentner-danger aria-disabled:opacity-40 ${menu.state.customization.classNames?.item ?? ''}`}
            onFocus={() => menu.handler.handleItemFocus(level, item.id)}
            onPointerEnter={(event) =>
                menu.handler.handleItemEnter(level, item.id, event)
            }
            onClick={(event) => {
                event.stopPropagation()
                menu.handler.handleSelect(level, item.id, event.nativeEvent)
            }}
        >
            <MenuItemContent item={item} menu={menu} level={level} />
        </button>
    )
}
