import { createPortal } from 'react-dom'
import { groupMenuItems } from '../../../lib/Menu/navigation.ts'
import { useMenuSurface } from '../Hooks/useMenuSurface.ts'
import type { MenuSurfaceProps } from '../Types/menu.internal.ts'
import { MenuEntry } from './MenuEntry.tsx'

export function MenuSurface({ menu, level }: MenuSurfaceProps) {
    const { state, handler } = useMenuSurface({ menu, level })
    return createPortal(
        <section
            aria-label={state.surfaceLabel}
            data-rentner-menu-portal
            className={menu.state.customization.classNames?.portal}
        >
            <div
                ref={(node) => handler.setSurface(node)}
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
                    menu.state.path[level] !== undefined
                        ? `${menu.state.id}-content-${level + 1}`
                        : undefined
                }
                dir={menu.state.dir}
                data-rentner-menu-content=""
                data-side={state.position?.side}
                data-size={menu.state.customization.controlSize ?? 'md'}
                className={`m-0 min-w-48 overflow-y-auto overscroll-contain rounded-rentner-control border border-rentner-border bg-rentner-surface p-1.5 font-sans text-sm text-rentner-foreground shadow-xl outline-none ${menu.state.customization.classNames?.content ?? ''}`}
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
                onPointerEnter={menu.handler.cancelHover}
                onPointerLeave={() => menu.handler.handleSurfaceLeave(level)}
            >
                {groupMenuItems(menu.state.levels[level] ?? []).map((group) =>
                    group.name !== undefined ? (
                        <fieldset
                            key={group.id}
                            aria-label={group.name}
                            className="m-0 min-w-0 border-0 p-0"
                        >
                            {group.items.map((item) => (
                                <MenuEntry
                                    key={item.id}
                                    item={item}
                                    menu={menu}
                                    level={level}
                                />
                            ))}
                        </fieldset>
                    ) : (
                        <MenuEntry
                            key={group.id}
                            item={group.items[0]!}
                            menu={menu}
                            level={level}
                        />
                    ),
                )}
            </div>
        </section>,
        menu.state.customization.portalContainer ?? menu.state.portalHost!,
    )
}
