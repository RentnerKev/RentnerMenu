import { createContext, useContext, useMemo } from 'react'
import type { MenuCustomizationProps } from '../Types/menu.types.ts'

export const MenuCustomizationContext = createContext<MenuCustomizationProps>(
    {},
)

export function useMenuCustomization(
    props: MenuCustomizationProps,
): MenuCustomizationProps {
    const inherited = useContext(MenuCustomizationContext)
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
            side: props.side ?? inherited.side,
            align: props.align ?? inherited.align,
            sideOffset: props.sideOffset ?? inherited.sideOffset,
            collisionPadding:
                props.collisionPadding ?? inherited.collisionPadding,
            loop: props.loop ?? inherited.loop,
            portalContainer:
                props.portalContainer === undefined
                    ? inherited.portalContainer
                    : props.portalContainer,
            portalZIndex: props.portalZIndex ?? inherited.portalZIndex,
            classNames,
            style,
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
            props.loop,
            inherited.loop,
            props.portalContainer,
            inherited.portalContainer,
            props.portalZIndex,
            inherited.portalZIndex,
            classNames,
            style,
        ],
    )
}
