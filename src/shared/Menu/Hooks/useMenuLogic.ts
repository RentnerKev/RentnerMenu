import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent as ReactMouseEvent,
    PointerEvent as ReactPointerEvent,
    Ref,
} from 'react'
import {
    enabledItems,
    isInteractive,
    matchItem,
    menuLevels,
    nextItem,
} from '../../../lib/Menu/navigation.ts'
import type {
    ContextMenuProps,
    MenuCommonProps,
    MenuItem,
    MenuProps,
    MenuSelectEvent,
} from '../Types/menu.types.ts'
import { useMenuCustomization } from './useMenuCustomization.ts'
import { useStableEvent } from './useStableEvent.ts'

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
    if (typeof ref === 'function') return ref(value)
    else if (ref) ref.current = value
}

function keyFor(level: number, itemId: string) {
    return JSON.stringify([level, itemId])
}

export function useMenuLogic(props: MenuCommonProps, mode: 'menu' | 'context') {
    const customization = useMenuCustomization(props)
    const reactId = useId()
    const id = props.id ?? `rentner-menu-${reactId}`
    const [internalOpen, setInternalOpen] = useState(props.defaultOpen ?? false)
    const [path, setPath] = useState<string[]>([])
    const [active, setActive] = useState<(string | undefined)[]>([])
    const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
    const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)
    const trigger = useRef<HTMLButtonElement | HTMLDivElement | null>(null)
    const surfaces = useRef(new Map<number, HTMLDivElement>())
    const itemNodes = useRef(new Map<string, HTMLButtonElement>())
    const beforeOpen = useRef<HTMLElement | null>(null)
    const focusRequest = useRef<{
        level: number
        edge: 'first' | 'last'
    } | null>({ level: 0, edge: 'first' })
    const pendingRestore = useRef(false)
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    )
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    )
    const touchStart = useRef<{ x: number; y: number } | null>(null)
    const suppressContext = useRef(false)
    const suppressClick = useRef(false)
    const typeahead = useRef({ text: '', time: 0 })
    const open = (props.open ?? internalOpen) && !props.disabled
    if (!open && path.length) setPath([])
    const levels = useMemo(
        () => menuLevels(props.items, path),
        [props.items, path],
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
            itemNodes.current.get(keyFor(level, itemId)) ?? null,
        [],
    )
    const getAnchor = useCallback(
        (level: number, parentId: string | undefined) =>
            level > 0 && parentId !== undefined
                ? (itemNodes.current.get(keyFor(level - 1, parentId)) ?? null)
                : trigger.current,
        [],
    )
    const setSurface = useCallback(
        (level: number, node: HTMLDivElement | null) => {
            if (node) surfaces.current.set(level, node)
            else surfaces.current.delete(level)
        },
        [],
    )

    function cancelHover() {
        clearTimeout(hoverTimer.current)
    }
    function cancelPress() {
        clearTimeout(longPressTimer.current)
        touchStart.current = null
    }
    function focusItem(level: number, itemId: string | undefined) {
        setActive((current) => {
            const next = current.slice(0, level + 1)
            next[level] = itemId
            return next
        })
        focusNode(level, itemId)
    }
    function focusNode(level: number, itemId: string | undefined) {
        const node =
            itemId === undefined
                ? surfaces.current.get(level)
                : itemNodes.current.get(keyFor(level, itemId))
        node?.focus({ preventScroll: true })
        if (itemId !== undefined) node?.scrollIntoView?.({ block: 'nearest' })
    }
    function requestOpen(value: boolean, restore = false) {
        cancelHover()
        pendingRestore.current = restore
        if (value && !open) {
            const focused = trigger.current?.ownerDocument
                .activeElement as HTMLElement | null
            beforeOpen.current =
                mode === 'context' && !trigger.current?.contains(focused)
                    ? trigger.current
                    : focused
            setPath([])
        }
        if (props.open === undefined) setInternalOpen(value)
        if (value !== open) props.onOpenChange?.(value)
    }
    function openAt(
        edge: 'first' | 'last',
        position: { x: number; y: number } | null = null,
    ) {
        if (props.disabled) return
        setPoint(position)
        setPath([])
        focusRequest.current = { level: 0, edge }
        if (open)
            focusItem(
                0,
                enabledItems(props.items).at(edge === 'first' ? 0 : -1)?.id,
            )
        requestOpen(true)
    }
    function openSubmenu(level: number, itemId: string, focus: boolean) {
        cancelHover()
        if (focus) focusRequest.current = { level: level + 1, edge: 'first' }
        setPath((current) => [...current.slice(0, level), itemId])
        if (focus && path[level] === itemId)
            focusItem(
                level + 1,
                enabledItems(levels[level + 1] ?? []).at(0)?.id,
            )
    }
    function select(level: number, itemId: string, originalEvent: Event) {
        const item = levels[level]?.find((candidate) => candidate.id === itemId)
        if (!item || !isInteractive(item) || item.disabled) return
        if (item.type === 'submenu') {
            openSubmenu(level, itemId, true)
            return
        }
        let prevented = false
        const event: MenuSelectEvent = {
            id: item.id,
            originalEvent,
            get defaultPrevented() {
                return prevented
            },
            preventDefault() {
                prevented = true
            },
        }
        if (item.type === 'checkbox') item.onCheckedChange(!item.checked)
        else if (item.type === 'radio') {
            if (!item.checked) item.onCheckedChange()
        } else item.onSelect?.(event)
        props.onAction?.(item.id, event)
        if (!event.defaultPrevented && item.closeOnSelect !== false)
            requestOpen(false, true)
    }
    function closeSubmenu(level: number) {
        const parentId = path[level - 1]
        setPath((current) => current.slice(0, level - 1))
        focusItem(level - 1, parentId)
    }
    function handleKeyDown(
        level: number,
        event: ReactKeyboardEvent<HTMLDivElement>,
    ) {
        if (event.defaultPrevented || event.isPropagationStopped()) return
        const items = levels[level] ?? []
        const current = active[level]
        if (event.key === 'Tab') {
            // Restore the originating tab position before native Tab advances it.
            ;(mode === 'context'
                ? (beforeOpen.current ?? trigger.current)
                : trigger.current
            )?.focus({ preventScroll: true })
            requestOpen(false)
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
        let next: string | undefined
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp')
            next = nextItem(
                items,
                current,
                event.key === 'ArrowDown' ? 1 : -1,
                customization.loop ?? true,
            )
        else if (event.key === 'Home' || event.key === 'End')
            next = enabledItems(items).at(event.key === 'Home' ? 0 : -1)?.id
        else if (event.key === (dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight')) {
            const item = items.find((candidate) => candidate.id === current)
            if (item?.type === 'submenu' && !item.disabled)
                openSubmenu(level, item.id, true)
        } else if (
            event.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft') &&
            level
        )
            closeSubmenu(level)
        else if (event.key === 'Enter' || event.key === ' ') {
            if (current !== undefined) select(level, current, event.nativeEvent)
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
            next = matchItem(items, current, typeahead.current.text)
        } else return
        event.preventDefault()
        event.stopPropagation()
        if (next !== undefined) {
            setPath((currentPath) => currentPath.slice(0, level))
            focusItem(level, next)
        }
    }
    function handleItemEnter(
        level: number,
        itemId: string,
        event: ReactPointerEvent<HTMLButtonElement>,
    ) {
        if (event.pointerType === 'touch') return
        cancelHover()
        const item = levels[level]?.find((candidate) => candidate.id === itemId)
        if (!item || !isInteractive(item) || item.disabled) return
        focusItem(level, itemId)
        if (path[level] === itemId) return
        hoverTimer.current = setTimeout(
            () => {
                if (item.type === 'submenu') openSubmenu(level, itemId, false)
                else setPath((current) => current.slice(0, level))
            },
            item.type === 'submenu' ? 120 : 250,
        )
    }
    function handleSurfaceLeave(level: number) {
        cancelHover()
        hoverTimer.current = setTimeout(
            () => setPath((current) => current.slice(0, level)),
            300,
        )
    }
    function handleTriggerClick(event: ReactMouseEvent<HTMLButtonElement>) {
        ;(props as MenuProps).triggerProps?.onClick?.(event)
        if (event.defaultPrevented || props.disabled) return
        if (open) requestOpen(false, true)
        else openAt('first')
    }
    function handleTriggerKeyDown(
        event: ReactKeyboardEvent<HTMLButtonElement>,
    ) {
        ;(props as MenuProps).triggerProps?.onKeyDown?.(event)
        if (event.defaultPrevented || props.disabled) return
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
            event.preventDefault()
            openAt(event.key === 'ArrowUp' ? 'last' : 'first')
        }
    }
    function handleContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
        ;(props as ContextMenuProps).targetProps?.onContextMenu?.(event)
        if (event.defaultPrevented || props.disabled) return
        event.preventDefault()
        if (suppressContext.current) {
            suppressContext.current = false
            return
        }
        openAt('first', { x: event.clientX, y: event.clientY })
    }
    function handleTargetKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
        ;(props as ContextMenuProps).targetProps?.onKeyDown?.(event)
        if (event.defaultPrevented || props.disabled) return
        if (
            event.key === 'ContextMenu' ||
            (event.key === 'F10' && event.shiftKey)
        ) {
            event.preventDefault()
            openAt('first')
        }
    }
    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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
        longPressTimer.current = setTimeout(() => {
            suppressContext.current = true
            suppressClick.current = true
            openAt('first', { x: event.clientX, y: event.clientY })
        }, 550)
    }
    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        ;(props as ContextMenuProps).targetProps?.onPointerMove?.(event)
        if (
            touchStart.current &&
            Math.hypot(
                event.clientX - touchStart.current.x,
                event.clientY - touchStart.current.y,
            ) > 10
        )
            cancelPress()
    }
    function handleTargetClick(event: ReactMouseEvent<HTMLDivElement>) {
        if (suppressClick.current) {
            suppressClick.current = false
            event.preventDefault()
            event.stopPropagation()
            return
        }
        ;(props as ContextMenuProps).targetProps?.onClick?.(event)
    }

    const synchronizeFocus = useStableEvent(
        (
            isOpen: boolean,
            currentPath: readonly string[],
            host: HTMLElement | null,
        ) => {
            if (!isOpen) {
                if (previousOpen.current && pendingRestore.current)
                    (mode === 'context'
                        ? (beforeOpen.current ?? trigger.current)
                        : trigger.current
                    )?.focus({ preventScroll: true })
                previousOpen.current = false
                return
            }
            if (!previousOpen.current) {
                focusRequest.current ??= { level: 0, edge: 'first' }
                pendingRestore.current = true
                typeahead.current = { text: '', time: 0 }
            }
            previousOpen.current = true
            const request = focusRequest.current
            if (
                host &&
                request &&
                request.level <= currentPath.length &&
                surfaces.current.get(request.level)?.style.visibility ===
                    'visible'
            ) {
                focusRequest.current = null
                focusNode(
                    request.level,
                    enabledItems(levels[request.level] ?? []).at(
                        request.edge === 'first' ? 0 : -1,
                    )?.id,
                )
            }
        },
    )
    const dismiss = useStableEvent(() => requestOpen(false))
    const repairDynamicItems = useStableEvent(
        (
            items: readonly MenuItem[],
            isOpen: boolean,
            currentPath: readonly string[],
        ) => {
            if (!isOpen) return
            const updatedLevels = menuLevels(items, currentPath)
            for (let level = 0; level < updatedLevels.length; level++) {
                const available = enabledItems(updatedLevels[level] ?? [])
                if (
                    active[level] !== undefined &&
                    !available.some((item) => item.id === active[level])
                )
                    focusNode(level, available[0]?.id)
            }
        },
    )
    useEffect(
        () => () => {
            clearTimeout(hoverTimer.current)
            clearTimeout(longPressTimer.current)
        },
        [],
    )
    useEffect(() => {
        synchronizeFocus(open, path, portalHost)
    }, [open, path, portalHost, synchronizeFocus])
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
        doc.addEventListener('pointerdown', outside, true)
        doc.addEventListener('focusin', outside)
        const win = doc.defaultView
        win?.addEventListener('blur', dismiss)
        return () => {
            doc.removeEventListener('pointerdown', outside, true)
            doc.removeEventListener('focusin', outside)
            win?.removeEventListener('blur', dismiss)
        }
    }, [open, dismiss])
    useEffect(() => {
        repairDynamicItems(props.items, open, path)
    }, [props.items, open, path, repairDynamicItems])

    return {
        state: {
            open,
            id,
            levels,
            path,
            active,
            point,
            mounted: portalHost !== null,
            portalHost,
            customization,
            dir,
            ariaLabel: props.ariaLabel,
            mode,
        },
        handler: {
            handleSurfaceReady(level: number) {
                const request = focusRequest.current
                if (request?.level !== level) return
                focusRequest.current = null
                focusNode(
                    level,
                    enabledItems(levels[level] ?? []).at(
                        request.edge === 'first' ? 0 : -1,
                    )?.id,
                )
            },
            setTrigger,
            setSurface,
            getAnchor,
            handleTriggerClick,
            handleTriggerKeyDown,
            handleContextMenu,
            handleTargetKeyDown,
            handlePointerDown,
            handlePointerMove,
            handleTargetClick,
            handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
                ;(props as ContextMenuProps).targetProps?.onPointerUp?.(event)
                cancelPress()
            },
            handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
                ;(props as ContextMenuProps).targetProps?.onPointerCancel?.(
                    event,
                )
                cancelPress()
            },
            handleKeyDown,
            handleItemEnter,
            handleSurfaceLeave,
            cancelHover,
            handleSelect: select,
            handleItemFocus(level: number, itemId: string) {
                setActive((current) => {
                    const next = [...current]
                    next[level] = itemId
                    return next
                })
            },
            setItemNode(
                level: number,
                itemId: string,
                node: HTMLButtonElement | null,
            ) {
                if (node) itemNodes.current.set(keyFor(level, itemId), node)
                else itemNodes.current.delete(keyFor(level, itemId))
            },
            getItemNode,
        },
    }
}
