'use client'

/* oxlint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/prefer-tag-over-role -- Context targets preserve arbitrary native content. The focusable group implements Shift+F10 and ContextMenu shortcuts without imposing button semantics on its children. */
import { useMenuLogic } from '../Hooks/useMenuLogic.ts'
import type { ContextMenuProps } from '../Types/menu.types.ts'
import { MenuSurface } from './MenuSurface.tsx'

export function ContextMenu(props: ContextMenuProps) {
    const menu = useMenuLogic(props, 'context')
    const { setTrigger } = menu.handler
    return (
        <>
            <div
                role="group"
                {...props.targetProps}
                ref={setTrigger}
                aria-label={
                    props.targetProps?.['aria-label'] ?? props.ariaLabel
                }
                tabIndex={
                    props.disabled
                        ? props.targetProps?.tabIndex
                        : (props.targetProps?.tabIndex ?? 0)
                }
                aria-disabled={props.disabled || undefined}
                aria-controls={
                    menu.state.open ? `${menu.state.id}-content-0` : undefined
                }
                dir={menu.state.dir}
                data-rentner-menu-target=""
                className={`${menu.state.customization.classNames?.target ?? ''} ${props.targetProps?.className ?? ''}`}
                onContextMenu={menu.handler.handleContextMenu}
                onKeyDown={menu.handler.handleTargetKeyDown}
                onPointerDown={menu.handler.handlePointerDown}
                onPointerMove={menu.handler.handlePointerMove}
                onPointerUp={menu.handler.handlePointerUp}
                onPointerCancel={menu.handler.handlePointerCancel}
                onClick={menu.handler.handleTargetClick}
            >
                {props.children}
            </div>
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
