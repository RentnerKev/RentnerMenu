import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { flushSync } from 'react-dom'
import type {
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    Ref,
} from 'react'
import {
    createMenuIndexer,
    isInteractive,
    matchIndexedItem,
    menuLevels,
    nextIndexedItem,
} from '../../../lib/Menu/navigation.ts'
import {
    insidePointerCorridor,
    submenuCorridor,
} from '../../../lib/Menu/pointer.ts'
import type { PointerCorridor } from '../../../lib/Menu/pointer.ts'
import type {
    ContextMenuProps,
    MenuCommonProps,
    MenuProps,
    MenuSelectEvent,
} from '../Types/menu.types.ts'
import { useMenuCustomization } from './useMenuCustomization.ts'
import { useMenuModal } from './useMenuModal.ts'
import { useMenuHover } from './useMenuHover.ts'
import { useStableEvent } from './useStableEvent.ts'

type ItemNode = HTMLButtonElement | HTMLAnchorElement

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
    if (typeof ref === 'function') return ref(value)
    else if (ref) ref.current = value
}

export function useMenuLogic(props: MenuCommonProps, mode: 'menu' | 'context') {
    const customization = useMenuCustomization(props)
    const reactId = useId()
    const id = props.id ?? `rentner-menu-${reactId}`
    const [internalOpen, setInternalOpen] = useState(props.defaultOpen ?? false)
    const [path, setPath] = useState<string[]>([])
    const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
    const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
    // The DOM focus styles own highlighting. Navigation does not need a render.
    const active = useRef<(string | undefined)[]>([])
    const trigger = useRef<HTMLButtonElement | HTMLDivElement | null>(null)
    const surfaces = useRef(new Map<number, HTMLDivElement>())
    const itemNodes = useRef(new Map<number, Map<string, ItemNode>>())
    const beforeOpen = useRef<HTMLElement | null>(null)
    const focusRequest = useRef<{
        level: number
        edge: 'first' | 'last'
    } | null>({ level: 0, edge: 'first' })
    const pendingRestore = useRef(false)
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    )
    const graceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    )
    const grace = useRef<{ level: number; corridor: PointerCorridor } | null>(
        null,
    )
    const deferredHover = useRef<{ level: number; itemId: string } | null>(null)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    )
    const touchStart = useRef<{ x: number; y: number } | null>(null)
    const suppressContext = useRef(false)
    const suppressClick = useRef(false)
    const typeahead = useRef({ text: '', time: 0 })
    const open = (props.open ?? internalOpen) && !props.disabled
    const hover = useMenuHover({
        enabled:
            mode === 'menu' &&
            Boolean((props as MenuProps).openOnHover) &&
            !customization.modal,
        disabled: Boolean(props.disabled),
        open,
        openDelayMs: (props as MenuProps).hoverOpenDelayMs ?? 100,
        closeDelayMs: (props as MenuProps).hoverCloseDelayMs ?? 150,
        onOpen: () => {
            if (
                trigger.current instanceof HTMLButtonElement &&
                trigger.current.disabled
            )
                return
            focusRequest.current = null
            requestOpen(true)
        },
        onClose: () => requestOpen(false),
    })
    if (!open && path.length) setPath([])
    const levels = useMemo(
        () => menuLevels(props.items, path),
        [props.items, path],
    )
    const indexForItems = useMemo(() => createMenuIndexer(), [])
    const indexes = useMemo(
        () => (open ? levels.map(indexForItems) : []),
        [levels, open, indexForItems],
    )
    if (levels.length !== path.length + 1)
        setPath(path.slice(0, levels.length - 1))
    const previousOpen = useRef(false)
    const dir = customization.dir ?? 'ltr'
    const externalRef = (
        mode === 'menu'
            ? (props as MenuProps).triggerRef
            : (props as ContextMenuProps).targetRef
    ) as Ref<HTMLButtonElement | HTMLDivElement> | undefined
    const setTrigger = useCallback(
        (node: HTMLButtonElement | HTMLDivElement | null) => {
            trigger.current = node
            if (node) setPortalHost(node.ownerDocument.body)
            const cleanup = assignRef(externalRef, node)
            return () => {
                trigger.current = null
                if (typeof cleanup === 'function') cleanup()
                else assignRef(externalRef, null)
            }
        },
        [externalRef],
    )
    const getItemNode = useCallback(
        (level: number, itemId: string) =>
            itemNodes.current.get(level)?.get(itemId) ?? null,
        [],
    )
    const getAnchor = useCallback(
        (level: number, parentId: string | undefined) =>
            level > 0 && parentId !== undefined
                ? getItemNode(level - 1, parentId)
                : trigger.current,
        [getItemNode],
    )
    const setSurface = useCallback(
        (level: number, node: HTMLDivElement | null) => {
            if (node) surfaces.current.set(level, node)
            else surfaces.current.delete(level)
        },
        [],
    )
    const setItemNode = useCallback(
        (level: number, itemId: string, node: ItemNode | null) => {
            if (node) {
                let nodes = itemNodes.current.get(level)
                if (!nodes) itemNodes.current.set(level, (nodes = new Map()))
                nodes.set(itemId, node)
            } else {
                const nodes = itemNodes.current.get(level)
                nodes?.delete(itemId)
                if (!nodes?.size) itemNodes.current.delete(level)
            }
        },
        [],
    )
    const cancelHover = useCallback(() => clearTimeout(hoverTimer.current), [])
    const cancelGrace = useCallback(() => {
        clearTimeout(graceTimer.current)
        grace.current = null
        deferredHover.current = null
    }, [])
    const cancelPress = useCallback(() => {
        clearTimeout(longPressTimer.current)
        touchStart.current = null
    }, [])
    const truncatePath = useCallback((level: number) => {
        setPath((current) =>
            current.length > level ? current.slice(0, level) : current,
        )
    }, [])
    const focusNode = useCallback(
        (level: number, itemId: string | undefined) => {
            const node =
                itemId === undefined
                    ? surfaces.current.get(level)
                    : getItemNode(level, itemId)
            if (!node || node.ownerDocument.activeElement === node) return
            node.focus({ preventScroll: true })
            if (itemId !== undefined)
                node.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
        },
        [getItemNode],
    )
    const focusItem = useCallback(
        (level: number, itemId: string | undefined) => {
            active.current.length = level + 1
            active.current[level] = itemId
            focusNode(level, itemId)
        },
        [focusNode],
    )
    const handleItemFocus = useCallback((level: number, itemId: string) => {
        active.current[level] = itemId
    }, [])
    const requestOpen = useStableEvent(
        (value: boolean, restore: boolean = false) => {
            hover.handler.cancel()
            cancelHover()
            cancelGrace()
            pendingRestore.current = restore
            if (value && !open) {
                const focused = trigger.current?.ownerDocument
                    .activeElement as HTMLElement | null
                beforeOpen.current =
                    mode === 'context' && !trigger.current?.contains(focused)
                        ? trigger.current
                        : focused
                truncatePath(0)
            }
            if (props.open === undefined) setInternalOpen(value)
            if (value !== open) props.onOpenChange?.(value)
        },
    )
    const openAt = useStableEvent(
        (
            edge: 'first' | 'last',
            position: { x: number; y: number } | null = null,
        ) => {
            if (props.disabled) return
            hover.handler.takeControl()
            setPoint(position)
            truncatePath(0)
            focusRequest.current = { level: 0, edge }
            if (open)
                focusItem(
                    0,
                    indexes[0]?.enabled.at(edge === 'first' ? 0 : -1)?.id,
                )
            requestOpen(true)
        },
    )
    const openSubmenu = useStableEvent(
        (level: number, itemId: string, focus: boolean) => {
            cancelHover()
            cancelGrace()
            if (focus)
                focusRequest.current = { level: level + 1, edge: 'first' }
            setPath((current) =>
                current.length === level + 1 && current[level] === itemId
                    ? current
                    : [...current.slice(0, level), itemId],
            )
            if (focus && path[level] === itemId) {
                focusRequest.current = null
                focusItem(level + 1, indexes[level + 1]?.enabled[0]?.id)
            }
        },
    )
    const select = useStableEvent(
        (level: number, itemId: string, originalEvent: Event) => {
            const item = indexes[level]?.byId.get(itemId)
            if (
                !item ||
                !isInteractive(item) ||
                item.disabled ||
                originalEvent.defaultPrevented
            )
                return
            if (item.type === 'submenu') {
                openSubmenu(level, itemId, true)
                return
            }
            let prevented: boolean = false
            const event: MenuSelectEvent = {
                id: item.id,
                originalEvent,
                get defaultPrevented() {
                    return prevented || originalEvent.defaultPrevented
                },
                preventDefault() {
                    prevented = true
                    originalEvent.preventDefault()
                },
            }
            if (item.type === 'checkbox')
                item.onCheckedChange(item.checked !== true)
            else if (item.type === 'radio') {
                if (!item.checked) item.onCheckedChange()
            } else item.onSelect?.(event)
            props.onAction?.(item.id, event)
            if (!event.defaultPrevented && item.closeOnSelect !== false)
                requestOpen(false, true)
        },
    )
    const closeSubmenu = useStableEvent((level: number) => {
        cancelHover()
        cancelGrace()
        const parentId = path[level - 1]
        truncatePath(level - 1)
        focusItem(level - 1, parentId)
    })
    const handleKeyDown = useStableEvent(
        (level: number, event: ReactKeyboardEvent<HTMLDivElement>) => {
            if (event.defaultPrevented || event.isPropagationStopped()) return
            hover.handler.takeControl()
            const index = indexes[level]
            const current = active.current[level]
            if (event.key === 'Tab') {
                if (customization.modal) {
                    // Firefox resolves native Tab navigation before a deferred React commit.
                    // Release inert and restore origin focus before that default action.
                    flushSync(() => requestOpen(false, true))
                } else {
                    ;(mode === 'context'
                        ? (beforeOpen.current ?? trigger.current)
                        : trigger.current
                    )?.focus({ preventScroll: true })
                    requestOpen(false)
                }
                event.stopPropagation()
                return
            }
            if (event.key === 'Escape') {
                props.onEscapeKeyDown?.(event.nativeEvent)
                if (event.nativeEvent.defaultPrevented) return
                event.preventDefault()
                event.stopPropagation()
                if (level) closeSubmenu(level)
                else requestOpen(false, true)
                return
            }
            if (!index) return
            let next: string | undefined
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
                next = nextIndexedItem(
                    index,
                    current,
                    event.key === 'ArrowDown' ? 1 : -1,
                    customization.loop ?? true,
                )
            else if (event.key === 'Home' || event.key === 'End')
                next = index.enabled.at(event.key === 'Home' ? 0 : -1)?.id
            else if (
                event.key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')
            ) {
                const item =
                    current === undefined ? undefined : index.byId.get(current)
                if (item?.type === 'submenu' && !item.disabled)
                    openSubmenu(level, item.id, true)
            } else if (
                event.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft') &&
                level
            )
                closeSubmenu(level)
            else if (event.key === 'Enter' || event.key === ' ') {
                if (current !== undefined) {
                    const item = index.byId.get(current)
                    if (item?.type === 'link') {
                        // Modified Enter retains the browser's own new-tab behavior.
                        if (
                            event.key === 'Enter' &&
                            (event.ctrlKey ||
                                event.metaKey ||
                                event.shiftKey ||
                                event.altKey)
                        )
                            return
                        getItemNode(level, current)?.click()
                    } else select(level, current, event.nativeEvent)
                }
            } else if (
                event.key.length === 1 &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.nativeEvent.isComposing
            ) {
                const now = Date.now()
                typeahead.current = {
                    text:
                        (now - typeahead.current.time > 700
                            ? ''
                            : typeahead.current.text) + event.key,
                    time: now,
                }
                next = matchIndexedItem(index, current, typeahead.current.text)
            } else return
            event.preventDefault()
            event.stopPropagation()
            if (next !== undefined) {
                cancelHover()
                cancelGrace()
                truncatePath(level)
                focusItem(level, next)
            }
        },
    )
    const hoverItem = useStableEvent((level: number, itemId: string) => {
        cancelHover()
        const item = indexes[level]?.byId.get(itemId)
        if (!item || !isInteractive(item) || item.disabled) return
        focusItem(level, itemId)
        if (
            path[level] === itemId ||
            (item.type !== 'submenu' && path.length <= level)
        )
            return
        hoverTimer.current = setTimeout(
            () => {
                if (item.type === 'submenu') openSubmenu(level, itemId, false)
                else truncatePath(level)
            },
            item.type === 'submenu' ? 120 : 250,
        )
    })
    const handleItemEnter = useStableEvent(
        (
            level: number,
            itemId: string,
            event: ReactPointerEvent<HTMLElement>,
        ) => {
            if (event.pointerType === 'touch') return
            if (
                grace.current?.level === level &&
                insidePointerCorridor(
                    { x: event.clientX, y: event.clientY },
                    grace.current.corridor,
                )
            ) {
                deferredHover.current = { level, itemId }
                return
            }
            cancelGrace()
            hoverItem(level, itemId)
        },
    )
    const handleItemLeave = useStableEvent(
        (
            level: number,
            itemId: string,
            event: ReactPointerEvent<HTMLElement>,
        ) => {
            if (event.pointerType === 'touch' || path[level] !== itemId) return
            const submenu = surfaces.current.get(level + 1)
            const node = getItemNode(level, itemId)
            if (!submenu || !node) return
            const rect = submenu.getBoundingClientRect()
            const anchor = node.getBoundingClientRect()
            cancelGrace()
            grace.current = {
                level,
                corridor: submenuCorridor(
                    { x: event.clientX, y: event.clientY },
                    rect,
                    rect.left + rect.width / 2 >= anchor.left + anchor.width / 2
                        ? 'right'
                        : 'left',
                ),
            }
            graceTimer.current = setTimeout(() => {
                const pending = deferredHover.current
                cancelGrace()
                if (pending) hoverItem(pending.level, pending.itemId)
            }, 300)
        },
    )
    const handleSurfacePointerMove = useStableEvent(
        (level: number, event: ReactPointerEvent<HTMLDivElement>) => {
            const pending = deferredHover.current
            if (
                !pending ||
                grace.current?.level !== level ||
                insidePointerCorridor(
                    { x: event.clientX, y: event.clientY },
                    grace.current.corridor,
                )
            )
                return
            cancelGrace()
            hoverItem(pending.level, pending.itemId)
        },
    )
    const handleSurfaceEnter = useStableEvent(
        (level: number, event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.pointerType === 'mouse') hover.handler.enter()
            cancelHover()
            if (grace.current && level > grace.current.level) cancelGrace()
        },
    )
    const handleSurfaceLeave = useStableEvent(
        (level: number, event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.pointerType === 'mouse') hover.handler.leave()
            cancelHover()
            cancelGrace()
            hoverTimer.current = setTimeout(() => truncatePath(level), 300)
        },
    )
    const handleTriggerPointerEnter = useStableEvent(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            ;(props as MenuProps).triggerProps?.onPointerEnter?.(event)
            if (
                !event.defaultPrevented &&
                !event.currentTarget.disabled &&
                event.pointerType === 'mouse'
            )
                hover.handler.enter()
        },
    )
    const handleTriggerPointerLeave = useStableEvent(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            ;(props as MenuProps).triggerProps?.onPointerLeave?.(event)
            if (!event.defaultPrevented && event.pointerType === 'mouse')
                hover.handler.leave()
        },
    )
    const handleTriggerClick = useStableEvent(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            ;(props as MenuProps).triggerProps?.onClick?.(event)
            if (event.defaultPrevented || props.disabled) return
            hover.handler.takeControl()
            if (open) requestOpen(false, true)
            else openAt('first')
        },
    )
    const handleTriggerKeyDown = useStableEvent(
        (event: ReactKeyboardEvent<HTMLButtonElement>) => {
            ;(props as MenuProps).triggerProps?.onKeyDown?.(event)
            if (event.defaultPrevented || props.disabled) return
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault()
                openAt(event.key === 'ArrowUp' ? 'last' : 'first')
            }
        },
    )
    const handleContextMenu = useStableEvent(
        (event: ReactMouseEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onContextMenu?.(event)
            if (event.defaultPrevented || props.disabled) return
            event.preventDefault()
            if (suppressContext.current) {
                suppressContext.current = false
                return
            }
            openAt('first', { x: event.clientX, y: event.clientY })
        },
    )
    const handleTargetKeyDown = useStableEvent(
        (event: ReactKeyboardEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onKeyDown?.(event)
            if (event.defaultPrevented || props.disabled) return
            if (
                event.key === 'ContextMenu' ||
                (event.key === 'F10' && event.shiftKey)
            ) {
                event.preventDefault()
                openAt('first')
            }
        },
    )
    const handlePointerDown = useStableEvent(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onPointerDown?.(event)
            cancelPress()
            suppressClick.current = false
            suppressContext.current = false
            if (
                event.defaultPrevented ||
                !(props as ContextMenuProps).longPress ||
                props.disabled ||
                event.pointerType !== 'touch' ||
                !event.isPrimary
            )
                return
            touchStart.current = { x: event.clientX, y: event.clientY }
            const position = { x: event.clientX, y: event.clientY }
            longPressTimer.current = setTimeout(() => {
                suppressContext.current = true
                suppressClick.current = true
                openAt('first', position)
            }, 550)
        },
    )
    const handlePointerMove = useStableEvent(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onPointerMove?.(event)
            if (
                touchStart.current &&
                Math.hypot(
                    event.clientX - touchStart.current.x,
                    event.clientY - touchStart.current.y,
                ) > 10
            )
                cancelPress()
        },
    )
    const handleTargetClick = useStableEvent(
        (event: ReactMouseEvent<HTMLDivElement>) => {
            if (suppressClick.current) {
                suppressClick.current = false
                event.preventDefault()
                event.stopPropagation()
                return
            }
            ;(props as ContextMenuProps).targetProps?.onClick?.(event)
        },
    )
    const handlePointerUp = useStableEvent(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onPointerUp?.(event)
            cancelPress()
        },
    )
    const handlePointerCancel = useStableEvent(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            ;(props as ContextMenuProps).targetProps?.onPointerCancel?.(event)
            cancelPress()
        },
    )
    // The ready callback uses committed DOM refs, including a newly mounted submenu.
    const handleSurfaceReady = useCallback(
        (level: number) => {
            const request = focusRequest.current
            const surface = surfaces.current.get(level)
            if (
                request?.level !== level ||
                !surface ||
                surface.style.visibility !== 'visible'
            )
                return
            const nodes = surface.querySelectorAll<ItemNode>(
                '[data-menu-item-id]:not([aria-disabled="true"])',
            )
            const node = nodes[request.edge === 'first' ? 0 : nodes.length - 1]
            focusRequest.current = null
            focusItem(
                level,
                node?.getAttribute('data-menu-item-id') ?? undefined,
            )
        },
        [focusItem],
    )
    const dismiss = useStableEvent(() =>
        requestOpen(false, Boolean(customization.modal)),
    )
    const focusFirst = useStableEvent(() => {
        const level = Math.max(0, surfaces.current.size - 1)
        focusItem(level, indexes[level]?.enabled[0]?.id)
    })
    // Register cleanup before restoring focus on close, so the trigger is no longer inert.
    useMenuModal({
        open,
        modal: customization.modal ?? false,
        ownerDocument: portalHost?.ownerDocument,
        surfaces,
        dismiss,
        focusFirst,
    })
    useLayoutEffect(() => {
        if (!open) {
            cancelHover()
            cancelGrace()
            cancelPress()
            if (previousOpen.current && pendingRestore.current)
                (mode === 'context'
                    ? (beforeOpen.current ?? trigger.current)
                    : trigger.current
                )?.focus({ preventScroll: true })
            previousOpen.current = false
            return
        }
        if (!previousOpen.current) {
            if (!hover.refs.openedByHover.current)
                focusRequest.current ??= { level: 0, edge: 'first' }
            pendingRestore.current = !hover.refs.openedByHover.current
            typeahead.current = { text: '', time: 0 }
        }
        previousOpen.current = true
        if (portalHost && focusRequest.current)
            handleSurfaceReady(focusRequest.current.level)
    }, [
        open,
        portalHost,
        mode,
        cancelHover,
        cancelGrace,
        cancelPress,
        handleSurfaceReady,
        hover.refs.openedByHover,
    ])
    useLayoutEffect(() => {
        if (!open) return
        for (let level = 0; level < indexes.length; level++) {
            const index = indexes[level]!
            const current = active.current[level]
            if (current !== undefined && !index.enabledPositions.has(current))
                focusItem(level, index.enabled[0]?.id)
        }
    }, [indexes, open, focusItem])
    useEffect(() => {
        if (!open) return
        const doc = trigger.current?.ownerDocument
        if (!doc) return
        function outside(event: Event) {
            const nodes = event.composedPath()
            if (
                nodes.includes(trigger.current as EventTarget) ||
                [...surfaces.current.values()].some((surface) =>
                    nodes.includes(surface),
                )
            )
                return
            dismiss()
        }
        if (!customization.modal) {
            doc.addEventListener('pointerdown', outside, true)
            doc.addEventListener('focusin', outside)
        }
        const win = doc.defaultView
        win?.addEventListener('blur', dismiss)
        return () => {
            doc.removeEventListener('pointerdown', outside, true)
            doc.removeEventListener('focusin', outside)
            win?.removeEventListener('blur', dismiss)
        }
    }, [open, customization.modal, dismiss])
    useEffect(
        () => () => {
            cancelHover()
            cancelGrace()
            cancelPress()
        },
        [cancelHover, cancelGrace, cancelPress],
    )

    return {
        state: {
            open,
            id,
            levels,
            path,
            point,
            mounted: portalHost !== null,
            portalHost,
            customization,
            dir,
            ariaLabel: props.ariaLabel,
            mode,
        },
        handler: {
            handleSurfaceReady,
            setTrigger,
            setSurface,
            getAnchor,
            handleTriggerClick,
            handleTriggerKeyDown,
            handleTriggerPointerEnter,
            handleTriggerPointerLeave,
            handleContextMenu,
            handleTargetKeyDown,
            handlePointerDown,
            handlePointerMove,
            handleTargetClick,
            handlePointerUp,
            handlePointerCancel,
            handleKeyDown,
            handleItemEnter,
            handleItemLeave,
            handleSurfacePointerMove,
            handleSurfaceEnter,
            handleSurfaceLeave,
            cancelHover,
            handleSelect: select,
            handleItemFocus,
            setItemNode,
            getItemNode,
        },
    }
}
