import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { positionMenu } from '../../../lib/Menu/position.ts'
import { groupMenuItems } from '../../../lib/Menu/navigation.ts'
import type { MenuSurfaceProps } from '../Types/menu.internal.ts'
import { useStableEvent } from './useStableEvent.ts'

const positionEvent = 'rentner-menu-position'

export function useMenuSurface({ menu, level }: MenuSurfaceProps) {
    const [surface, setSurfaceNode] = useState<HTMLDivElement | null>(null)
    const lastPosition = useRef<ReturnType<typeof positionMenu> | null>(null)
    const [position, setPosition] = useState<ReturnType<
        typeof positionMenu
    > | null>(null)
    const { customization, point, path, dir } = menu.state
    const items = menu.state.levels[level]
    const groups = useMemo(() => groupMenuItems(items ?? []), [items])
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
    const pointX = point?.x
    const pointY = point?.y
    const getAnchor = useStableEvent(menu.handler.getAnchor)
    const registerSurface = useStableEvent(menu.handler.setSurface)
    const notifyReady = useStableEvent(menu.handler.handleSurfaceReady)
    const setSurface = useCallback(
        (node: HTMLDivElement | null) => {
            setSurfaceNode(node)
            registerSurface(level, node)
        },
        [level, registerSurface],
    )

    useLayoutEffect(() => {
        const anchor = getAnchor(level, parentId)
        const element = surface
        const doc = element?.ownerDocument
        const win = doc?.defaultView
        if (!element || !win || !anchor) return
        let frame: number | null = null
        let disposed = false
        const viewport = win.visualViewport
        function update() {
            if (disposed || !element || !win || !anchor) return
            const rect =
                level === 0 && pointX !== undefined && pointY !== undefined
                    ? {
                          left: pointX,
                          right: pointX,
                          top: pointY,
                          bottom: pointY,
                          width: 0,
                          height: 0,
                      }
                    : anchor.getBoundingClientRect()
            const next = positionMenu(
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
            )
            const previous = lastPosition.current
            if (
                previous &&
                previous.left === next.left &&
                previous.top === next.top &&
                previous.side === next.side &&
                previous.maxWidth === next.maxWidth &&
                previous.maxHeight === next.maxHeight
            )
                return
            lastPosition.current = next
            setPosition(next)
        }
        const scheduleUpdate = () => {
            if (disposed || frame !== null) return
            frame = win.requestAnimationFrame(() => {
                frame = null
                update()
            })
        }
        // Manual popovers enter the top layer, including inside a modal dialog.
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
        const observer = Resize ? new Resize(scheduleUpdate) : null
        const parentSurface = level
            ? anchor.closest('[data-rentner-menu-content]')
            : null
        // A parent's translation does not resize its submenu trigger.
        // Re-measure after that parent has committed its new coordinates.
        parentSurface?.addEventListener(positionEvent, update)
        observer?.observe(element)
        observer?.observe(anchor)
        win.addEventListener('resize', scheduleUpdate)
        doc.addEventListener('scroll', scheduleUpdate, {
            capture: true,
            passive: true,
        })
        viewport?.addEventListener('resize', scheduleUpdate)
        viewport?.addEventListener('scroll', scheduleUpdate, { passive: true })
        return () => {
            disposed = true
            if (frame !== null) win.cancelAnimationFrame(frame)
            observer?.disconnect()
            parentSurface?.removeEventListener(positionEvent, update)
            win.removeEventListener('resize', scheduleUpdate)
            doc.removeEventListener('scroll', scheduleUpdate, true)
            viewport?.removeEventListener('resize', scheduleUpdate)
            viewport?.removeEventListener('scroll', scheduleUpdate)
            if (nativePopover && element.hasAttribute('popover')) {
                try {
                    element.hidePopover()
                } catch {
                    /* Already detached or closed. */
                }
                element.removeAttribute('popover')
            }
        }
    }, [
        surface,
        parentId,
        pointX,
        pointY,
        level,
        side,
        align,
        offset,
        padding,
        dir,
        getAnchor,
    ])

    // Position and visibility must commit before focus, within the same paint.
    useLayoutEffect(() => {
        if (surface && position) {
            notifyReady(level)
            const win = surface.ownerDocument.defaultView
            if (win) surface.dispatchEvent(new win.Event(positionEvent))
        }
    }, [surface, position, level, notifyReady])

    return {
        state: { position, surfaceLabel, groups },
        handler: { setSurface },
    }
}
