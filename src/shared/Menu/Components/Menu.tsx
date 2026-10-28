'use client'

import { useMenuLogic } from '../Hooks/useMenuLogic.ts'
import type { MenuProps } from '../Types/menu.types.ts'
import { MenuSurface } from './MenuSurface.tsx'

export function Menu(props: MenuProps) {
    const menu = useMenuLogic(props, 'menu')
    return (
        <>
            <button
                {...props.triggerProps}
                ref={(node) => menu.handler.setTrigger(node)}
                type={props.triggerProps?.type ?? 'button'}
                disabled={props.disabled}
                aria-label={
                    props.triggerProps?.['aria-label'] ?? props.ariaLabel
                }
                aria-haspopup="menu"
                aria-expanded={menu.state.open}
                aria-controls={
                    menu.state.open ? `${menu.state.id}-content-0` : undefined
                }
                dir={menu.state.dir}
                data-rentner-menu-trigger=""
                data-size={menu.state.customization.controlSize ?? 'md'}
                className={`inline-flex h-rentner-control-md items-center justify-center gap-2 rounded-rentner-control border border-rentner-border bg-rentner-control px-3 font-sans text-sm text-rentner-foreground outline-none focus-visible:ring-2 focus-visible:ring-rentner-accent disabled:cursor-not-allowed disabled:opacity-40 ${menu.state.customization.classNames?.trigger ?? ''} ${props.triggerProps?.className ?? ''}`}
                onClick={menu.handler.handleTriggerClick}
                onKeyDown={menu.handler.handleTriggerKeyDown}
            >
                {props.trigger ?? props.ariaLabel}
            </button>
            {menu.state.open &&
                menu.state.mounted &&
                menu.state.levels.map((_, level) => (
                    <MenuSurface
                        key={level ? menu.state.path[level - 1] : menu.state.id}
                        menu={menu}
                        level={level}
                    />
                ))}
        </>
    )
}
