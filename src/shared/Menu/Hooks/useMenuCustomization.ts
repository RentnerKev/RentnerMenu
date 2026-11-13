import { createContext, useContext, useMemo } from 'react'
import type { MenuCustomizationContextValue } from '../Types/menu.internal.ts'

export const MenuCustomizationContext =
    createContext<MenuCustomizationContextValue>({})

export function useMenuCustomization(
    props: MenuCustomizationContextValue,
    mode?: 'menu' | 'context',
): MenuCustomizationContextValue {
    const inherited = useContext(MenuCustomizationContext)
    const positioning =
        mode === 'menu'
            ? inherited.menu
            : mode === 'context'
              ? inherited.contextMenu
              : undefined
    const menu = useMemo(
        () => ({ ...inherited.menu, ...props.menu }),
        [inherited.menu, props.menu],
    )
    const contextMenu = useMemo(
        () => ({ ...inherited.contextMenu, ...props.contextMenu }),
        [inherited.contextMenu, props.contextMenu],
    )
    const classNames = useMemo(
        () => ({ ...inherited.classNames, ...props.classNames }),
        [inherited.classNames, props.classNames],
    )
    const style = useMemo(
        () => ({ ...inherited.style, ...props.style }),
        [inherited.style, props.style],
    )
    return useMemo(
        () => ({
            modal: props.modal ?? inherited.modal,
            dir: props.dir ?? inherited.dir,
            controlSize: props.controlSize ?? inherited.controlSize,
            side: props.side ?? positioning?.side ?? inherited.side,
            align: props.align ?? positioning?.align ?? inherited.align,
            sideOffset:
                props.sideOffset ??
                positioning?.sideOffset ??
                inherited.sideOffset,
            collisionPadding:
                props.collisionPadding ??
                positioning?.collisionPadding ??
                inherited.collisionPadding,
            loop: props.loop ?? inherited.loop,
            portalContainer:
                props.portalContainer === undefined
                    ? inherited.portalContainer
                    : props.portalContainer,
            portalZIndex: props.portalZIndex ?? inherited.portalZIndex,
            classNames,
            style,
            menu,
            contextMenu,
        }),
        [
            props.modal,
            inherited.modal,
            props.dir,
            inherited.dir,
            props.controlSize,
            inherited.controlSize,
            props.side,
            inherited.side,
            props.align,
            inherited.align,
            props.sideOffset,
            inherited.sideOffset,
            props.collisionPadding,
            inherited.collisionPadding,
            positioning,
            props.loop,
            inherited.loop,
            props.portalContainer,
            inherited.portalContainer,
            props.portalZIndex,
            inherited.portalZIndex,
            classNames,
            style,
            menu,
            contextMenu,
        ],
    )
}
