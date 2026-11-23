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

const OPPOSITE_SIDE = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
} as const

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
    const viewportLeft = viewport.left ?? 0
    const viewportTop = viewport.top ?? 0
    const minX = viewportLeft + padding
    const minY = viewportTop + padding
    const maxX = viewportLeft + viewport.width - padding
    const maxY = viewportTop + viewport.height - padding
    const isVerticalSide = side === 'top' || side === 'bottom'
    const primarySpace =
        side === 'top'
            ? anchor.top - minY
            : side === 'bottom'
              ? maxY - anchor.bottom
              : side === 'left'
                ? anchor.left - minX
                : maxX - anchor.right
    const oppositeSpace =
        side === 'top'
            ? maxY - anchor.bottom
            : side === 'bottom'
              ? anchor.top - minY
              : side === 'left'
                ? maxX - anchor.right
                : anchor.left - minX
    const length = isVerticalSide ? height : width
    const resolvedSide =
        primarySpace < length + offset && oppositeSpace > primarySpace
            ? OPPOSITE_SIDE[side]
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
