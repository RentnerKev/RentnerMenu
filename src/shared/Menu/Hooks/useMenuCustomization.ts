import { createContext, useContext, useMemo } from 'react'
import type { MenuCustomizationContextValue } from '../Types/menu.internal.ts'

const EMPTY_CUSTOMIZATION: MenuCustomizationContextValue = Object.freeze({})

export const MenuCustomizationContext =
    createContext<MenuCustomizationContextValue>(EMPTY_CUSTOMIZATION)

function mergeOptional<T extends object>(
    parent: T | undefined,
    local: T | undefined,
): T | undefined {
    if (!parent && !local) return undefined
    if (!local) return parent
    if (!parent) return { ...local }
    return { ...parent, ...local }
}

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
    const pMenu = props.menu
    const hasMenu = pMenu !== undefined
    const menu = useMemo(
        () => mergeOptional(inherited.menu, pMenu),
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- stabilize on positioning fields
        [
            inherited.menu,
            hasMenu,
            pMenu?.side,
            pMenu?.align,
            pMenu?.sideOffset,
            pMenu?.collisionPadding,
        ],
    )
    const pContextMenu = props.contextMenu
    const hasContextMenu = pContextMenu !== undefined
    const contextMenu = useMemo(
        () => mergeOptional(inherited.contextMenu, pContextMenu),
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- stabilize on positioning fields
        [
            inherited.contextMenu,
            hasContextMenu,
            pContextMenu?.side,
            pContextMenu?.align,
            pContextMenu?.sideOffset,
            pContextMenu?.collisionPadding,
        ],
    )
    const pCn = props.classNames
    const hasClassNames = pCn !== undefined
    const classNames = useMemo(
        () => mergeOptional(inherited.classNames, pCn),
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- stabilize on slot fields
        [
            inherited.classNames,
            hasClassNames,
            pCn?.trigger,
            pCn?.target,
            pCn?.portal,
            pCn?.content,
            pCn?.item,
            pCn?.label,
            pCn?.description,
            pCn?.shortcut,
            pCn?.icon,
            pCn?.indicator,
            pCn?.submenuIndicator,
            pCn?.separator,
            pCn?.groupLabel,
        ],
    )
    const style = useMemo(
        () => mergeOptional(inherited.style, props.style),
        [inherited.style, props.style],
    )
    const modal = props.modal ?? inherited.modal
    const dir = props.dir ?? inherited.dir
    const controlSize = props.controlSize ?? inherited.controlSize
    const side = props.side ?? positioning?.side ?? inherited.side
    const align = props.align ?? positioning?.align ?? inherited.align
    const sideOffset =
        props.sideOffset ?? positioning?.sideOffset ?? inherited.sideOffset
    const collisionPadding =
        props.collisionPadding ??
        positioning?.collisionPadding ??
        inherited.collisionPadding
    const loop = props.loop ?? inherited.loop
    const portalContainer =
        props.portalContainer === undefined
            ? inherited.portalContainer
            : props.portalContainer
    const portalZIndex = props.portalZIndex ?? inherited.portalZIndex

    return useMemo(
        () => ({
            modal,
            dir,
            controlSize,
            side,
            align,
            sideOffset,
            collisionPadding,
            loop,
            portalContainer,
            portalZIndex,
            classNames,
            style,
            menu,
            contextMenu,
        }),
        [
            modal,
            dir,
            controlSize,
            side,
            align,
            sideOffset,
            collisionPadding,
            loop,
            portalContainer,
            portalZIndex,
            classNames,
            style,
            menu,
            contextMenu,
        ],
    )
}
