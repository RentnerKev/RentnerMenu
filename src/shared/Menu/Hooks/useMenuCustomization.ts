import { createContext, useContext } from 'react'
import type { MenuCustomizationProps } from '../Types/menu.types.ts'

export const MenuCustomizationContext = createContext<MenuCustomizationProps>(
    {},
)

export function useMenuCustomization(
    props: MenuCustomizationProps,
): MenuCustomizationProps {
    const inherited = useContext(MenuCustomizationContext)
    return {
        dir: props.dir ?? inherited.dir,
        controlSize: props.controlSize ?? inherited.controlSize,
        side: props.side ?? inherited.side,
        align: props.align ?? inherited.align,
        sideOffset: props.sideOffset ?? inherited.sideOffset,
        collisionPadding: props.collisionPadding ?? inherited.collisionPadding,
        loop: props.loop ?? inherited.loop,
        portalContainer:
            props.portalContainer === undefined
                ? inherited.portalContainer
                : props.portalContainer,
        portalZIndex: props.portalZIndex ?? inherited.portalZIndex,
        classNames: { ...inherited.classNames, ...props.classNames },
        style: { ...inherited.style, ...props.style },
    }
}
