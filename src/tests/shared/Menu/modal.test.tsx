import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { StrictMode, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useMenuModal } from '../../../shared/Menu/Hooks/useMenuModal.ts'

const noop = () => {}

afterEach(() => {
    cleanup()
    document.body.replaceChildren()
    document.body.removeAttribute('style')
    document.documentElement.removeAttribute('style')
})

function Harness({
    open = true,
    modal = true,
    host = document.body,
    dismiss = noop,
    focusFirst,
    map,
}: {
    open?: boolean
    modal?: boolean
    host?: HTMLElement | ShadowRoot
    dismiss?: () => void
    focusFirst?: () => void
    map?: RefObject<Map<number, HTMLDivElement>>
}) {
    const ownMap = useRef(new Map<number, HTMLDivElement>())
    const surfaces = map ?? ownMap
    useMenuModal({
        open,
        modal,
        ownerDocument: host.ownerDocument,
        surfaces,
        dismiss,
        focusFirst:
            focusFirst ??
            (() => surfaces.current.get(0)?.querySelector('button')?.focus()),
    })
    return createPortal(
        <div
            ref={(node) => {
                if (node) surfaces.current.set(0, node)
                else surfaces.current.delete(0)
            }}
            tabIndex={-1}
            data-testid="modal-surface"
        >
            <button type="button">Inside</button>
        </div>,
        host,
    )
}

function background() {
    const button = document.createElement('button')
    button.textContent = 'Outside'
    document.body.append(button)
    return button
}

describe('optional menu modality', () => {
    test('closed or nonmodal menus leave outside content and scrolling alone', () => {
        const outside = background()
        const view = render(<Harness modal={false} />)
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('')
        view.rerender(<Harness open={false} />)
        expect(outside.hasAttribute('aria-hidden')).toBe(false)
        expect(document.body.style.overflow).toBe('')
    })

    test('restores preexisting inert, aria-hidden and overflow declarations exactly', () => {
        const outside = background()
        outside.setAttribute('inert', 'retained')
        outside.setAttribute('aria-hidden', 'false')
        document.body.style.setProperty('overflow-x', 'clip', 'important')
        document.body.style.setProperty('overflow-y', 'scroll')
        document.documentElement.style.setProperty(
            'overflow',
            'auto',
            'important',
        )
        const bodyStyle = document.body.style.cssText
        const rootStyle = document.documentElement.style.cssText
        const view = render(<Harness />)
        expect(outside.getAttribute('aria-hidden')).toBe('true')
        expect(document.body.style.overflow).toBe('hidden')
        expect(document.documentElement.style.overflow).toBe('hidden')
        view.unmount()
        expect(outside.getAttribute('inert')).toBe('retained')
        expect(outside.getAttribute('aria-hidden')).toBe('false')
        expect(document.body.style.cssText).toBe(bodyStyle)
        expect(document.documentElement.style.cssText).toBe(rootStyle)
    })

    test('restores inline overflow priorities without discarding unrelated style changes', () => {
        document.body.style.setProperty('overflow', 'scroll', 'important')
        document.documentElement.style.setProperty(
            'overflow-x',
            'clip',
            'important',
        )
        document.documentElement.style.setProperty('overflow-y', 'auto')
        const view = render(<Harness />)
        document.body.style.setProperty('color', 'red')
        document.documentElement.style.setProperty('background-color', 'blue')
        view.unmount()
        expect(document.body.style.getPropertyValue('overflow')).toBe('scroll')
        expect(document.body.style.getPropertyPriority('overflow')).toBe(
            'important',
        )
        expect(
            document.documentElement.style.getPropertyValue('overflow-x'),
        ).toBe('clip')
        expect(
            document.documentElement.style.getPropertyPriority('overflow-x'),
        ).toBe('important')
        expect(
            document.documentElement.style.getPropertyValue('overflow-y'),
        ).toBe('auto')
        expect(
            document.documentElement.style.getPropertyPriority('overflow-y'),
        ).toBe('')
        expect(document.body.style.color).toBe('red')
        expect(document.documentElement.style.backgroundColor).toBe('blue')
    })

    test('retains a dialog and explicit portal ancestors while hiding sibling branches', () => {
        const dialog = document.createElement('dialog')
        const host = document.createElement('section')
        const sibling = document.createElement('button')
        const outside = background()
        dialog.append(host, sibling)
        document.body.append(dialog)
        const view = render(<Harness host={host} />)
        expect(dialog.hasAttribute('inert')).toBe(false)
        expect(host.hasAttribute('aria-hidden')).toBe(false)
        expect(view.getByTestId('modal-surface').hasAttribute('inert')).toBe(
            false,
        )
        expect(sibling.hasAttribute('inert')).toBe(true)
        expect(outside.hasAttribute('inert')).toBe(true)
        view.unmount()
        expect(sibling.hasAttribute('inert')).toBe(false)
    })

    test.each(['open', 'closed'] as const)(
        'preserves a %s shadow portal path and isolates dynamic shadow siblings',
        async (mode) => {
            const host = document.createElement('section')
            const root = host.attachShadow({ mode })
            const sibling = document.createElement('button')
            sibling.setAttribute('aria-hidden', 'false')
            sibling.setAttribute('inert', 'retained')
            root.append(sibling)
            document.body.append(host)
            const outside = background()
            const dismiss = mock()
            const view = render(<Harness host={root} dismiss={dismiss} />)
            const inside = root.querySelector<HTMLButtonElement>(
                '[data-testid] button',
            )!
            expect(host.hasAttribute('inert')).toBe(false)
            expect(host.hasAttribute('aria-hidden')).toBe(false)
            expect(sibling.getAttribute('aria-hidden')).toBe('true')
            expect(outside.hasAttribute('inert')).toBe(true)
            expect(fireEvent.pointerDown(inside)).toBe(true)
            expect(fireEvent.click(inside)).toBe(true)
            expect(dismiss).not.toHaveBeenCalled()
            fireEvent.focusIn(outside)
            expect(root.activeElement).toBe(inside)
            const dynamic = document.createElement('button')
            root.append(dynamic)
            await waitFor(() =>
                expect(dynamic.hasAttribute('inert')).toBe(true),
            )
            fireEvent.pointerDown(dynamic)
            fireEvent.click(dynamic)
            expect(dismiss).toHaveBeenCalledTimes(1)
            view.unmount()
            expect(host.hasAttribute('inert')).toBe(false)
            expect(sibling.getAttribute('inert')).toBe('retained')
            expect(sibling.getAttribute('aria-hidden')).toBe('false')
            expect(dynamic.hasAttribute('inert')).toBe(false)
            expect(outside.hasAttribute('inert')).toBe(false)
        },
    )

    test('promoting a shadow portal restores its host while retaining the older modal lock', () => {
        const host = document.createElement('section')
        host.setAttribute('aria-hidden', 'false')
        const root = host.attachShadow({ mode: 'open' })
        document.body.append(host)
        const first = render(<Harness />)
        expect(host.hasAttribute('inert')).toBe(true)
        const second = render(<Harness host={root} />)
        expect(host.hasAttribute('inert')).toBe(false)
        expect(host.getAttribute('aria-hidden')).toBe('false')
        second.unmount()
        expect(host.hasAttribute('inert')).toBe(true)
        expect(document.body.style.overflow).toBe('hidden')
        first.unmount()
        expect(host.hasAttribute('inert')).toBe(false)
        expect(host.getAttribute('aria-hidden')).toBe('false')
    })

    test('clicking an open shadow portal host outside the menu cannot activate its handler', () => {
        const host = document.createElement('section')
        const root = host.attachShadow({ mode: 'open' })
        document.body.append(host)
        const dismiss = mock()
        const action = mock()
        host.addEventListener('click', action)
        render(<Harness host={root} dismiss={dismiss} />)
        expect(fireEvent.click(host)).toBe(false)
        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(action).not.toHaveBeenCalled()
    })

    test('closed shadow hosts exclude padding hits while surfaces remain hittable and restore exact inline styles', () => {
        const host = document.createElement('section')
        const root = host.attachShadow({ mode: 'closed' })
        const map = { current: new Map<number, HTMLDivElement>() }
        host.style.setProperty('pointer-events', 'auto', 'important')
        document.body.append(host)
        const view = render(<Harness host={root} map={map} modal={false} />)
        const surface = map.current.get(0)!
        surface.style.setProperty('pointer-events', 'none')
        view.rerender(<Harness host={root} map={map} />)
        expect(host.style.getPropertyValue('pointer-events')).toBe('none')
        expect(host.style.getPropertyPriority('pointer-events')).toBe(
            'important',
        )
        expect(surface.style.getPropertyValue('pointer-events')).toBe('auto')
        expect(surface.style.getPropertyPriority('pointer-events')).toBe(
            'important',
        )
        host.style.setProperty('color', 'red')
        surface.style.setProperty('color', 'blue')
        view.rerender(<Harness host={root} map={map} modal={false} />)
        expect(host.style.getPropertyValue('pointer-events')).toBe('auto')
        expect(host.style.getPropertyPriority('pointer-events')).toBe(
            'important',
        )
        expect(surface.style.getPropertyValue('pointer-events')).toBe('none')
        expect(surface.style.getPropertyPriority('pointer-events')).toBe('')
        expect(host.style.color).toBe('red')
        expect(surface.style.color).toBe('blue')
    })

    test('closed shadow pointer ownership follows stacked modal promotion and cleanup', () => {
        const host = document.createElement('section')
        const root = host.attachShadow({ mode: 'closed' })
        const map = { current: new Map<number, HTMLDivElement>() }
        document.body.append(host)
        const first = render(<Harness host={root} map={map} />)
        const surface = map.current.get(0)!
        expect(host.style.pointerEvents).toBe('none')
        expect(surface.style.pointerEvents).toBe('auto')
        const second = render(<Harness />)
        expect(host.style.pointerEvents).toBe('')
        expect(surface.style.pointerEvents).toBe('')
        expect(host.hasAttribute('inert')).toBe(true)
        second.unmount()
        expect(host.style.pointerEvents).toBe('none')
        expect(surface.style.pointerEvents).toBe('auto')
        first.unmount()
        expect(host.style.pointerEvents).toBe('')
        expect(surface.style.pointerEvents).toBe('')
        expect(host.hasAttribute('inert')).toBe(false)
    })

    test('nested closed roots retain both host pointer styles until their modal unmounts', () => {
        const outer = document.createElement('section')
        const outerRoot = outer.attachShadow({ mode: 'closed' })
        const inner = document.createElement('section')
        const innerRoot = inner.attachShadow({ mode: 'closed' })
        outerRoot.append(inner)
        document.body.append(outer)
        outer.style.setProperty('pointer-events', 'auto')
        inner.style.setProperty('pointer-events', 'auto', 'important')
        const view = render(<Harness host={innerRoot} />)
        expect(outer.style.pointerEvents).toBe('none')
        expect(inner.style.pointerEvents).toBe('none')
        expect(
            innerRoot.querySelector<HTMLElement>('[data-testid]')?.style
                .pointerEvents,
        ).toBe('auto')
        view.unmount()
        expect(outer.style.pointerEvents).toBe('auto')
        expect(outer.style.getPropertyPriority('pointer-events')).toBe('')
        expect(inner.style.pointerEvents).toBe('auto')
        expect(inner.style.getPropertyPriority('pointer-events')).toBe(
            'important',
        )
    })

    test('isolates newly inserted content and restores a branch newly used by a submenu portal', async () => {
        const map = { current: new Map<number, HTMLDivElement>() }
        const host = document.createElement('section')
        document.body.append(host)
        render(<Harness map={map} />)
        expect(host.hasAttribute('inert')).toBe(true)
        const submenu = document.createElement('div')
        map.current.set(1, submenu)
        host.append(submenu)
        const outside = background()
        await waitFor(() => {
            expect(host.hasAttribute('inert')).toBe(false)
            expect(outside.getAttribute('aria-hidden')).toBe('true')
        })
        map.current.delete(1)
        submenu.remove()
        await waitFor(() => expect(host.hasAttribute('inert')).toBe(true))
    })

    test('programmatic focus outside returns to the active menu', () => {
        const outside = background()
        const view = render(<Harness />)
        const inside = view.getByText('Inside')
        // Dispatch directly because native inert prevents focus before focusin in browsers.
        fireEvent.focusIn(outside)
        expect(document.activeElement).toBe(inside)
    })

    test('falls back to the menu surface when there is no focusable first item', () => {
        const outside = background()
        const view = render(<Harness focusFirst={noop} />)
        fireEvent.focusIn(outside)
        expect(document.activeElement).toBe(view.getByTestId('modal-surface'))
        view.unmount()
        outside.focus()
        expect(document.activeElement).toBe(outside)
    })

    test('outside pointer dismisses once and blocks the following click after unmount', () => {
        const outside = background()
        const action = mock()
        outside.addEventListener('click', action)
        const dismiss = mock(() => view.unmount())
        const view = render(<Harness dismiss={dismiss} />)
        expect(fireEvent.pointerDown(outside)).toBe(false)
        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(fireEvent.click(outside)).toBe(false)
        expect(action).not.toHaveBeenCalled()
        fireEvent.click(outside)
        expect(action).toHaveBeenCalledTimes(1)
    })

    test('blocks delayed touch compatibility clicks after pointerup and unmount', async () => {
        const outside = background()
        const action = mock()
        outside.addEventListener('click', action)
        const view = render(<Harness dismiss={() => view.unmount()} />)
        fireEvent.pointerDown(outside, { pointerType: 'touch' })
        fireEvent.pointerUp(outside, { pointerType: 'touch' })
        await new Promise((resolve) => setTimeout(resolve, 10))
        expect(fireEvent.click(outside)).toBe(false)
        expect(action).not.toHaveBeenCalled()
    })

    test('a cancelled outside pointer does not consume the next independent click', () => {
        const outside = background()
        const action = mock()
        outside.addEventListener('click', action)
        const view = render(<Harness dismiss={() => view.unmount()} />)
        fireEvent.pointerDown(outside)
        fireEvent.pointerCancel(outside)
        expect(fireEvent.click(outside)).toBe(true)
        expect(action).toHaveBeenCalledTimes(1)
    })

    test('a new pointer sequence after dismissing is not blocked by the previous guard', () => {
        const outside = background()
        const action = mock()
        outside.addEventListener('click', action)
        const view = render(<Harness dismiss={() => view.unmount()} />)
        fireEvent.pointerDown(outside)
        expect(fireEvent.pointerDown(outside)).toBe(true)
        expect(fireEvent.click(outside)).toBe(true)
        expect(action).toHaveBeenCalledTimes(1)
    })

    test('controlled refusal to dismiss still blocks outside activation without duplicate dismissal', () => {
        const outside = background()
        const action = mock()
        const dismiss = mock()
        outside.addEventListener('click', action)
        render(<Harness dismiss={dismiss} />)
        fireEvent.pointerDown(outside)
        fireEvent.click(outside)
        expect(dismiss).toHaveBeenCalledTimes(1)
        expect(action).not.toHaveBeenCalled()
        expect(outside.hasAttribute('inert')).toBe(true)
    })

    test('pointer and click inside the modal continue to work', () => {
        const dismiss = mock()
        const view = render(<Harness dismiss={dismiss} />)
        const inside = view.getByText('Inside')
        expect(fireEvent.pointerDown(inside)).toBe(true)
        expect(fireEvent.click(inside)).toBe(true)
        expect(dismiss).not.toHaveBeenCalled()
    })

    test('the last modal owns focus and outside isolation; removing it restores the previous modal', () => {
        const outside = background()
        const firstHost = document.createElement('section')
        const secondHost = document.createElement('section')
        document.body.append(firstHost, secondHost)
        const first = render(<Harness host={firstHost} />)
        const second = render(<Harness host={secondHost} />)
        expect(firstHost.hasAttribute('inert')).toBe(true)
        expect(secondHost.hasAttribute('inert')).toBe(false)
        fireEvent.focusIn(outside)
        expect(document.activeElement).toBe(secondHost.querySelector('button'))
        second.unmount()
        expect(firstHost.hasAttribute('inert')).toBe(false)
        expect(secondHost.hasAttribute('inert')).toBe(true)
        expect(document.body.style.overflow).toBe('hidden')
        fireEvent.focusIn(outside)
        expect(document.activeElement).toBe(firstHost.querySelector('button'))
        first.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('')
    })

    test('removing an older modal keeps the newer modal lock until its own cleanup', () => {
        const outside = background()
        const first = render(<Harness />)
        const second = render(<Harness />)
        first.unmount()
        expect(outside.hasAttribute('inert')).toBe(true)
        expect(document.body.style.overflow).toBe('hidden')
        second.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('')
    })

    test('turning modality off, closing, and reopening each restore or acquire their own lock', () => {
        const outside = background()
        const view = render(<Harness />)
        view.rerender(<Harness modal={false} />)
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('')
        view.rerender(<Harness />)
        expect(outside.hasAttribute('inert')).toBe(true)
        view.rerender(<Harness open={false} />)
        expect(outside.hasAttribute('aria-hidden')).toBe(false)
        expect(document.body.style.overflow).toBe('')
        view.rerender(<Harness />)
        expect(outside.hasAttribute('inert')).toBe(true)
        view.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
    })

    test('a nested modal inside a retained portal ancestor keeps its path interactive', () => {
        const outside = background()
        const first = render(<Harness />)
        const ancestor = first.getByTestId('modal-surface')
        const parentButton = ancestor.querySelector('button')!
        const nestedHost = document.createElement('section')
        ancestor.append(nestedHost)
        const second = render(<Harness host={nestedHost} />)
        expect(ancestor.hasAttribute('inert')).toBe(false)
        expect(nestedHost.hasAttribute('inert')).toBe(false)
        expect(parentButton.hasAttribute('inert')).toBe(true)
        expect(outside.hasAttribute('inert')).toBe(true)
        second.unmount()
        expect(parentButton.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('hidden')
        first.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
    })

    test('StrictMode replay cleans up every owned mutation', () => {
        const outside = background()
        const view = render(
            <StrictMode>
                <Harness />
            </StrictMode>,
        )
        expect(outside.hasAttribute('inert')).toBe(true)
        view.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(outside.hasAttribute('aria-hidden')).toBe(false)
        expect(document.body.style.overflow).toBe('')
    })

    test('separate documents restore their locks independently', () => {
        const other = document.implementation.createHTMLDocument('Other')
        const outside = background()
        const first = render(<Harness />)
        const second = render(<Harness host={other.body} />)
        first.unmount()
        expect(outside.hasAttribute('inert')).toBe(false)
        expect(document.body.style.overflow).toBe('')
        expect(other.body.style.overflow).toBe('hidden')
        second.unmount()
        expect(other.body.style.overflow).toBe('')
    })
})
