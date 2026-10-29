'use client'

import { useMenuLogic } from '../Hooks/useMenuLogic.ts'
import { useMenuTrigger } from '../Hooks/useMenuTrigger.ts'
import type { MenuProps } from '../Types/menu.types.ts'
import { MenuSurface } from './MenuSurface.tsx'

export function Menu(props: MenuProps) {
    const menu = useMenuLogic(props, 'menu')
    const trigger = useMenuTrigger(
        props,
        menu.state.open,
        menu.state.id,
        menu.state.dir,
        menu.state.customization,
        menu.handler.setTrigger,
        menu.handler.handleTriggerClick,
        menu.handler.handleTriggerKeyDown,
    )
    return (
        <>
            {props.asChild ? (
                trigger.state.customTrigger
            ) : (
                <button
                    {...trigger.state.buttonProps}
                    data-rentner-menu-trigger=""
                    data-size={menu.state.customization.controlSize ?? 'md'}
                >
                    {props.trigger ?? props.ariaLabel}
                </button>
            )}
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
