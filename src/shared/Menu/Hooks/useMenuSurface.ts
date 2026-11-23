import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { positionMenu } from '../../../lib/Menu/position.ts'
import { groupMenuItems } from '../../../lib/Menu/navigation.ts'
import type { MenuSurfaceProps } from '../Types/menu.internal.ts'
import type { MenuItem } from '../Types/menu.types.ts'

const positionEvent = 'rentner-menu-position'

interface SurfaceLayoutMeta {
    reserveIcon: boolean
    reserveIndicator: boolean
    groups: ReturnType<typeof groupMenuItems> | null
}

const EMPTY_LAYOUT_META: SurfaceLayoutMeta = {
    reserveIcon: false,
    reserveIndicator: false,
    groups: null,
}

const layoutMetaCache = new WeakMap<readonly MenuItem[], SurfaceLayoutMeta>()

function getSurfaceLayoutMeta(
    items: readonly MenuItem[] | undefined,
): SurfaceLayoutMeta {
    if (!items || items.length === 0) return EMPTY_LAYOUT_META
    let meta = layoutMetaCache.get(items)
    if (!meta) {
        let reserveIcon = false
        let reserveIndicator = false
        let hasRadio = false
        for (let index = 0; index < items.length; index++) {
            const item = items[index]!
            if (!reserveIcon && 'icon' in item && Boolean(item.icon)) {
                reserveIcon = true
            }
            if (item.type === 'checkbox') {
                reserveIndicator = true
            } else if (item.type === 'radio') {
                reserveIndicator = true
                hasRadio = true
            }
            if (reserveIcon && reserveIndicator && hasRadio) break
        }
        meta = {
            reserveIcon,
            reserveIndicator,
            groups: hasRadio ? groupMenuItems(items) : null,
        }
        layoutMetaCache.set(items, meta)
    }
    return meta
}

function containsComposed(ancestor: EventTarget, node: Element): boolean {
    if (!(ancestor instanceof Node)) return false
    if (ancestor.contains(node)) return true
    let current: Node | null = node
    while (current) {
        if (current === ancestor) return true
        if (current.parentNode) {
            current = current.parentNode
        } else {
            const root = current.getRootNode()
            current =
                root.nodeType === 11 && 'host' in root
                    ? (root as ShadowRoot).host
                    : null
        }
    }
    return false
}

export function useMenuSurface({ menu, level }: MenuSurfaceProps) {
    const surfaceRef = useRef<HTMLDivElement | null>(null)
    const lastPosition = useRef<ReturnType<typeof positionMenu> | null>(null)
    const [position, setPosition] = useState<ReturnType<
        typeof positionMenu
    > | null>(null)
    const { customization, point, path, dir } = menu.state
    const items = menu.state.levels[level]
    const layoutMeta = getSurfaceLayoutMeta(items)
    const parentId = path[level - 1]
    const parentItem =
        level > 0 && parentId !== undefined
            ? (menu.state.indexes[level - 1]?.byId.get(parentId) ??
              menu.state.levels[level - 1]?.find(
                  (item) => item.id === parentId,
              ))
            : undefined
    const surfaceLabel =
        parentItem && 'label' in parentItem
            ? `${menu.state.ariaLabel}: ${parentItem.label}`
            : menu.state.ariaLabel
    const side = level
        ? dir === 'rtl'
            ? 'left'
            : 'right'
        : (customization.side ??
          (point ? (dir === 'rtl' ? 'left' : 'right') : 'bottom'))
    const align = level ? 'start' : (customization.align ?? 'start')
    const padding = Math.max(0, customization.collisionPadding ?? 8)
    const offset = customization.sideOffset ?? 6
    const pointX = point?.x
    const pointY = point?.y
    const portalTarget = customization.portalContainer ?? menu.state.portalHost
    const getAnchor = menu.handler.getAnchor
    const registerSurface = menu.handler.setSurface
    const notifyReady = menu.handler.handleSurfaceReady
    const setSurface = useCallback(
        (node: HTMLDivElement | null) => {
            surfaceRef.current = node
            registerSurface(level, node)
        },
        [level, registerSurface],
    )

    useLayoutEffect(() => {
        const anchor = getAnchor(level, parentId)
        const element = surfaceRef.current
        const doc = element?.ownerDocument
        const win = doc?.defaultView
        if (!portalTarget || !element || !win || !anchor) return
        const scheduled = { frame: null as number | null, disposed: false }
        const viewport = win.visualViewport
        const usesPointAnchor =
            level === 0 && pointX !== undefined && pointY !== undefined
        let lastElementWidth = -1
        let lastElementHeight = -1
        let lastAnchorWidth = -1
        let lastAnchorHeight = -1

        function update() {
            if (scheduled.disposed || !element || !win || !anchor) return
            const rect = usesPointAnchor
                ? {
                      left: pointX,
                      right: pointX,
                      top: pointY,
                      bottom: pointY,
                      width: 0,
                      height: 0,
                  }
                : anchor.getBoundingClientRect()
            const elementWidth = element.offsetWidth
            const elementHeight = element.offsetHeight
            lastElementWidth = elementWidth
            lastElementHeight = elementHeight
            lastAnchorWidth = rect.width
            lastAnchorHeight = rect.height
            const next = positionMenu(
                rect,
                elementWidth,
                elementHeight,
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
            if (scheduled.disposed || scheduled.frame !== null) return
            scheduled.frame = win.requestAnimationFrame(() => {
                scheduled.frame = null
                update()
            })
        }
        const handleResizeEntries = (entries: ResizeObserverEntry[]) => {
            if (entries.length > 0) {
                let changed = false
                for (let index = 0; index < entries.length; index++) {
                    const entry = entries[index]!
                    const box = entry.borderBoxSize?.[0]
                    if (!box) {
                        changed = true
                        break
                    }
                    if (entry.target === element) {
                        if (
                            Math.round(box.inlineSize) !== lastElementWidth ||
                            Math.round(box.blockSize) !== lastElementHeight
                        ) {
                            changed = true
                            break
                        }
                    } else if (entry.target === anchor) {
                        if (
                            Math.abs(box.inlineSize - lastAnchorWidth) > 0.5 ||
                            Math.abs(box.blockSize - lastAnchorHeight) > 0.5
                        ) {
                            changed = true
                            break
                        }
                    } else {
                        changed = true
                        break
                    }
                }
                if (!changed) return
            }
            scheduleUpdate()
        }
        const handleScroll = (event: Event) => {
            const target = event.target
            if (target === element) return
            if (
                target === doc ||
                target === doc.documentElement ||
                target === doc.body ||
                (target !== null && containsComposed(target, anchor))
            ) {
                scheduleUpdate()
            }
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
        const observer = Resize ? new Resize(handleResizeEntries) : null
        const parentSurface = level
            ? anchor.closest('[data-rentner-menu-content]')
            : null
        // A parent's translation does not resize its submenu trigger.
        // Re-measure after that parent has committed its new coordinates.
        parentSurface?.addEventListener(positionEvent, update)
        observer?.observe(element)
        if (!usesPointAnchor) observer?.observe(anchor)
        win.addEventListener('resize', scheduleUpdate)
        doc.addEventListener('scroll', handleScroll, {
            capture: true,
            passive: true,
        })
        viewport?.addEventListener('resize', scheduleUpdate)
        viewport?.addEventListener('scroll', scheduleUpdate, { passive: true })
        return () => {
            scheduled.disposed = true
            if (scheduled.frame !== null)
                win.cancelAnimationFrame(scheduled.frame)
            observer?.disconnect()
            parentSurface?.removeEventListener(positionEvent, update)
            win.removeEventListener('resize', scheduleUpdate)
            doc.removeEventListener('scroll', handleScroll, true)
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
        portalTarget,
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
        const element = surfaceRef.current
        if (portalTarget && element && position) {
            notifyReady(level)
            const win = element.ownerDocument.defaultView
            if (win) element.dispatchEvent(new win.Event(positionEvent))
        }
    }, [portalTarget, position, level, notifyReady])

    return {
        state: {
            position,
            surfaceLabel,
            items,
            groups: layoutMeta.groups,
            reserveIcon: layoutMeta.reserveIcon,
            reserveIndicator: layoutMeta.reserveIndicator,
        },
        handler: { setSurface },
    }
}
