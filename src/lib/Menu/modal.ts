import type { MenuModalOptions } from '../../shared/Menu/Types/menu.modal.ts'

type Modal = Pick<MenuModalOptions, 'surfaces' | 'dismiss' | 'focusFirst'>
type HiddenElement = { inert: string | null; ariaHidden: string | null }
type ScrollStyle = {
    style: CSSStyleDeclaration
    values: [string, string, string][]
}
type PointerStyle = { value: string; priority: string }

const documents = new WeakMap<
    Document,
    ReturnType<typeof createDocumentModal>
>()
const overflowProperties = ['overflow', 'overflow-x', 'overflow-y']

function restoreAttribute(
    element: Element,
    name: string,
    value: string | null,
) {
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
}

function stop(event: Event) {
    event.preventDefault()
    event.stopImmediatePropagation()
}

function containingShadowRoot(element: Element) {
    const root = element.getRootNode()
    return root.nodeType === 11 && 'host' in root ? (root as ShadowRoot) : null
}

function createDocumentModal(doc: Document) {
    const modals: Modal[] = []
    const hidden = new Map<Element, HiddenElement>()
    const pointerStyles = new Map<CSSStyleDeclaration, PointerStyle>()
    let scrollStyles: ScrollStyle[] = []
    let observer: MutationObserver | undefined
    let listening = false
    let redirecting = false
    let blockedClick = false
    let clickTimer: ReturnType<typeof setTimeout> | undefined
    let shadowRoots = new Set<ShadowRoot>()

    function top() {
        return modals.at(-1)
    }

    function surfaces(modal: Modal) {
        return [...modal.surfaces.current.values()].filter(
            (surface) => surface.isConnected && surface.ownerDocument === doc,
        )
    }

    function inside(modal: Modal, event: Event) {
        const path = event.composedPath()
        return surfaces(modal).some((surface) => path.includes(surface))
    }

    function deferredToShadowRoot(event: Event) {
        const path = event.composedPath()
        // Closed roots hide internal targets until their own capture listeners run.
        return [...shadowRoots].some(
            (root) =>
                root.mode === 'closed' &&
                path.includes(root.host) &&
                !path.includes(root),
        )
    }

    function observeRoots(roots: Set<ShadowRoot>) {
        for (const root of shadowRoots) {
            if (roots.has(root)) continue
            root.removeEventListener('pointerdown', handlePointerDown, true)
            root.removeEventListener('click', handleClick, true)
            root.removeEventListener('focusin', handleFocus, true)
        }
        for (const root of roots) {
            if (shadowRoots.has(root)) continue
            root.addEventListener('pointerdown', handlePointerDown, true)
            root.addEventListener('click', handleClick, true)
            root.addEventListener('focusin', handleFocus, true)
        }
        shadowRoots = roots
        observer?.disconnect()
        if (!modals.length) return
        observer?.observe(doc.documentElement, {
            childList: true,
            subtree: true,
        })
        for (const root of roots)
            observer?.observe(root, { childList: true, subtree: true })
    }

    function restoreElement(element: Element, value: HiddenElement) {
        restoreAttribute(element, 'inert', value.inert)
        restoreAttribute(element, 'aria-hidden', value.ariaHidden)
    }

    function updatePointerStyles(
        roots: Set<ShadowRoot>,
        retained: HTMLDivElement[],
    ) {
        const targets = new Map<CSSStyleDeclaration, string>()
        const lockedHosts = new Set<Element>()
        for (const root of roots) {
            if (
                root.mode !== 'closed' ||
                retained.some((surface) => surface.contains(root.host))
            )
                continue
            // User-created shadow hosts are HTML elements with inline styles.
            targets.set((root.host as HTMLElement).style, 'none')
            lockedHosts.add(root.host)
        }
        for (const surface of retained) {
            let ancestor: Element | null = surface
            while (ancestor) {
                if (lockedHosts.has(ancestor)) {
                    targets.set(surface.style, 'auto')
                    break
                }
                ancestor =
                    ancestor.parentElement ??
                    containingShadowRoot(ancestor)?.host ??
                    null
            }
        }
        for (const [style, original] of pointerStyles) {
            if (targets.has(style)) continue
            if (original.value)
                style.setProperty(
                    'pointer-events',
                    original.value,
                    original.priority,
                )
            else style.removeProperty('pointer-events')
            pointerStyles.delete(style)
        }
        for (const [style, value] of targets) {
            if (!pointerStyles.has(style))
                pointerStyles.set(style, {
                    value: style.getPropertyValue('pointer-events'),
                    priority: style.getPropertyPriority('pointer-events'),
                })
            // Exclude uncovered host padding while keeping menu descendants hittable.
            style.setProperty('pointer-events', value, 'important')
        }
    }

    function refresh() {
        const current = top()
        const retained = current ? surfaces(current) : []
        const outside = new Set<Element>()
        const ancestors = new Set<Element>()
        const roots = new Set<ShadowRoot>()
        for (const surface of retained) {
            let ancestor: Element | null = surface
            while (ancestor) {
                ancestors.add(ancestor)
                if (ancestor.parentElement) ancestor = ancestor.parentElement
                else {
                    const root = containingShadowRoot(ancestor)
                    if (root) roots.add(root)
                    ancestor = root?.host ?? null
                }
            }
        }
        const rootsByHost = new Map([...roots].map((root) => [root.host, root]))
        function visit(parent: Element | ShadowRoot) {
            for (const child of parent.children) {
                if (retained.some((surface) => surface === child)) continue
                if (ancestors.has(child)) {
                    visit(child)
                    const root = rootsByHost.get(child)
                    if (root) visit(root)
                } else outside.add(child)
            }
        }
        if (retained.length && doc.body) visit(doc.body)
        for (const [element, value] of hidden) {
            if (outside.has(element)) continue
            restoreElement(element, value)
            hidden.delete(element)
        }
        for (const element of outside) {
            if (hidden.has(element)) continue
            hidden.set(element, {
                inert: element.getAttribute('inert'),
                ariaHidden: element.getAttribute('aria-hidden'),
            })
            element.setAttribute('inert', '')
            element.setAttribute('aria-hidden', 'true')
        }
        updatePointerStyles(roots, retained)
        observeRoots(roots)
    }

    function lockScroll() {
        scrollStyles = [doc.documentElement, doc.body]
            .filter((element) => element !== null)
            .map(({ style }) => {
                const values: ScrollStyle['values'] = []
                for (let index = 0; index < style.length; index++) {
                    const name = style.item(index)
                    if (overflowProperties.includes(name)) {
                        values.push([
                            name,
                            style.getPropertyValue(name),
                            style.getPropertyPriority(name),
                        ])
                    }
                }
                style.setProperty('overflow', 'hidden', 'important')
                return { style, values }
            })
    }

    function unlockScroll() {
        for (const { style, values } of scrollStyles) {
            for (const name of overflowProperties) style.removeProperty(name)
            for (const [name, value, priority] of values)
                style.setProperty(name, value, priority)
        }
        scrollStyles = []
    }

    function stopListening() {
        if (modals.length || blockedClick || !listening) return
        listening = false
        doc.removeEventListener('pointerdown', handlePointerDown, true)
        doc.removeEventListener('pointerup', handlePointerEnd, true)
        doc.removeEventListener('pointercancel', clearBlockedClick, true)
        doc.removeEventListener('click', handleClick, true)
        doc.removeEventListener('focusin', handleFocus, true)
        documents.delete(doc)
    }

    function clearBlockedClick() {
        blockedClick = false
        clearTimeout(clickTimer)
        stopListening()
    }

    function handlePointerDown(event: Event) {
        if (deferredToShadowRoot(event)) return
        clearBlockedClick()
        const current = top()
        if (!current || inside(current, event)) return
        stop(event)
        // Keep the click guard alive when dismiss synchronously unmounts the menu.
        blockedClick = true
        clickTimer = setTimeout(clearBlockedClick, 30_000)
        current.dismiss()
    }

    function handlePointerEnd() {
        if (!blockedClick) return
        clearTimeout(clickTimer)
        // Touch compatibility clicks may arrive in a later task after pointerup.
        clickTimer = setTimeout(clearBlockedClick, 500)
    }

    function handleClick(event: Event) {
        if (deferredToShadowRoot(event)) return
        if (blockedClick) {
            stop(event)
            clearBlockedClick()
            return
        }
        const current = top()
        if (!current || inside(current, event)) return
        stop(event)
        current.dismiss()
    }

    function handleFocus(event: Event) {
        if (deferredToShadowRoot(event)) return
        const current = top()
        if (!current || redirecting || inside(current, event)) return
        event.stopImmediatePropagation()
        redirecting = true
        try {
            current.focusFirst()
            const retained = surfaces(current)
            if (
                !retained.some((surface) =>
                    surface.contains(
                        containingShadowRoot(surface)?.activeElement ??
                            doc.activeElement,
                    ),
                )
            )
                retained[0]?.focus({ preventScroll: true })
        } finally {
            redirecting = false
        }
    }

    function register(modal: Modal) {
        if (!modals.length) {
            lockScroll()
            const Observer = doc.defaultView?.MutationObserver
            observer = Observer ? new Observer(refresh) : undefined
        }
        modals.push(modal)
        if (!listening) {
            listening = true
            doc.addEventListener('pointerdown', handlePointerDown, true)
            doc.addEventListener('pointerup', handlePointerEnd, true)
            doc.addEventListener('pointercancel', clearBlockedClick, true)
            doc.addEventListener('click', handleClick, true)
            doc.addEventListener('focusin', handleFocus, true)
        }
        refresh()
        return () => {
            const index = modals.indexOf(modal)
            if (index < 0) return
            modals.splice(index, 1)
            if (!modals.length) {
                observer?.disconnect()
                observer = undefined
                unlockScroll()
            }
            refresh()
            stopListening()
        }
    }

    return { register, refresh }
}

export function registerMenuModal(doc: Document, modal: Modal) {
    let manager = documents.get(doc)
    if (!manager) {
        manager = createDocumentModal(doc)
        documents.set(doc, manager)
    }
    return manager.register(modal)
}

export function refreshMenuModal(doc: Document) {
    documents.get(doc)?.refresh()
}
