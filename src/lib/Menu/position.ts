import type {
    MenuAlign,
    MenuDirection,
    MenuSide,
} from '../../shared/Menu/Types/menu.types.ts'

export interface MenuRectangle {
    left: number
    top: number
    right: number
    bottom: number
    width: number
    height: number
}

export function positionMenu(
    anchor: MenuRectangle,
    width: number,
    height: number,
    viewport: { width: number; height: number; left?: number; top?: number },
    side: MenuSide,
    align: MenuAlign,
    offset: number,
    padding: number,
    dir: MenuDirection,
) {
    const minX = (viewport.left ?? 0) + padding
    const minY = (viewport.top ?? 0) + padding
    const maxX = (viewport.left ?? 0) + viewport.width - padding
    const maxY = (viewport.top ?? 0) + viewport.height - padding
    const opposite = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left',
    } as const
    const space = {
        top: anchor.top - minY,
        bottom: maxY - anchor.bottom,
        left: anchor.left - minX,
        right: maxX - anchor.right,
    }
    const length = side === 'top' || side === 'bottom' ? height : width
    const resolvedSide =
        space[side] < length + offset && space[opposite[side]] > space[side]
            ? opposite[side]
            : side
    const horizontal = resolvedSide === 'top' || resolvedSide === 'bottom'
    const effectiveAlign =
        horizontal && dir === 'rtl'
            ? align === 'start'
                ? 'end'
                : align === 'end'
                  ? 'start'
                  : align
            : align
    let left =
        effectiveAlign === 'start'
            ? anchor.left
            : effectiveAlign === 'end'
              ? anchor.right - width
              : anchor.left + (anchor.width - width) / 2
    let top =
        align === 'start'
            ? anchor.top
            : align === 'end'
              ? anchor.bottom - height
              : anchor.top + (anchor.height - height) / 2
    if (horizontal)
        top =
            resolvedSide === 'bottom'
                ? anchor.bottom + offset
                : anchor.top - height - offset
    else
        left =
            resolvedSide === 'right'
                ? anchor.right + offset
                : anchor.left - width - offset
    return {
        left: Math.max(minX, Math.min(left, maxX - width)),
        top: Math.max(minY, Math.min(top, maxY - height)),
        side: resolvedSide,
        maxWidth: Math.max(0, maxX - minX),
        maxHeight: Math.max(0, maxY - minY),
    }
}
