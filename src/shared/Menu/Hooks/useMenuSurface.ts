import { useEffect, useRef, useState } from 'react'
import { positionMenu } from '../../../lib/Menu/position.ts'
import type { MenuSurfaceProps } from '../Types/menu.internal.ts'
import { useStableEvent } from './useStableEvent.ts'

export function useMenuSurface({ menu, level }: MenuSurfaceProps) {
    const surface = useRef<HTMLDivElement | null>(null)
    const [position, setPosition] = useState<ReturnType<
        typeof positionMenu
    > | null>(null)
    const { customization, point, path, dir } = menu.state
    const { getAnchor, setSurface } = menu.handler
    const parentId = path[level - 1]
    const parentItem = menu.state.levels[level - 1]?.find(
        (item) => item.id === parentId,
    )
    const surfaceLabel =
        parentItem && 'label' in parentItem
            ? `${menu.state.ariaLabel}: ${parentItem.label}`
            : menu.state.ariaLabel
    const side = level
        ? dir === 'rtl'
            ? 'left'
            : 'right'
        : (customization.side ?? 'bottom')
    const align = level ? 'start' : (customization.align ?? 'start')
    const padding = Math.max(0, customization.collisionPadding ?? 8)
    const offset = customization.sideOffset ?? 6
    const notifyReady = useStableEvent((readyLevel: number) =>
        menu.handler.handleSurfaceReady(readyLevel),
    )
    useEffect(() => {
        if (position) notifyReady(level)
    }, [position, level, notifyReady])

    useEffect(() => {
        const anchor = getAnchor(level, parentId)
        const element = surface.current
        const doc = element?.ownerDocument
        const win = doc?.defaultView
        if (!element || !win || !anchor) return
        function update() {
            if (!element || !win || !anchor) return
            const rect =
                level === 0 && point
                    ? {
                          left: point.x,
                          right: point.x,
                          top: point.y,
                          bottom: point.y,
                          width: 0,
                          height: 0,
                      }
                    : anchor.getBoundingClientRect()
            const viewport = win.visualViewport
            setPosition(
                positionMenu(
                    rect,
                    element.offsetWidth,
                    element.offsetHeight,
                    {
                        width: viewport?.width ?? win.innerWidth,
                        height: viewport?.height ?? win.innerHeight,
                        left: viewport?.offsetLeft ?? 0,
                        top: viewport?.offsetTop ?? 0,
                    },
                    side,
                    align,
                    offset,
                    padding,
                    dir,
                ),
            )
        }
        // Manual popovers enter the top layer, including when the trigger is in a modal dialog.
        const nativePopover = typeof element.showPopover === 'function'
        if (nativePopover) {
            element.setAttribute('popover', 'manual')
            try {
                element.showPopover()
            } catch {
                element.removeAttribute('popover')
            }
        }
        update()
        const Resize = win.ResizeObserver
        const observer = Resize ? new Resize(update) : null
        observer?.observe(element)
        observer?.observe(anchor)
        win.addEventListener('resize', update)
        doc.addEventListener('scroll', update, true)
        win.visualViewport?.addEventListener('resize', update)
        win.visualViewport?.addEventListener('scroll', update)
        return () => {
            observer?.disconnect()
            win.removeEventListener('resize', update)
            doc.removeEventListener('scroll', update, true)
            win.visualViewport?.removeEventListener('resize', update)
            win.visualViewport?.removeEventListener('scroll', update)
            if (nativePopover && element.hasAttribute('popover')) {
                try {
                    element.hidePopover()
                } catch {
                    /* Already detached or closed. */
                }
            }
        }
    }, [parentId, point, level, side, align, offset, padding, dir, getAnchor])

    return {
        state: { position, surfaceLabel },
        handler: {
            setSurface(node: HTMLDivElement | null) {
                surface.current = node
                setSurface(level, node)
            },
        },
    }
}
