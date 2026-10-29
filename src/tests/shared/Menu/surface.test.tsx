import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { Menu } from '../../../index.ts'

afterEach(() => {
    cleanup()
    mock.restore()
})

function setupFrames() {
    const frames = new Map<number, FrameRequestCallback>()
    let nextId = 0
    spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        frames.set(++nextId, callback)
        return nextId
    })
    const cancel = spyOn(window, 'cancelAnimationFrame').mockImplementation(
        (id) => {
            frames.delete(id)
        },
    )
    return {
        frames,
        cancel,
        flush() {
            act(() => {
                const pending = [...frames.values()]
                frames.clear()
                pending.forEach((callback) => callback(0))
            })
        },
    }
}

function menu(container?: HTMLElement) {
    return (
        <Menu
            ariaLabel="Commands"
            items={[{ id: 'first', label: 'First' }]}
            portalContainer={container}
        />
    )
}

describe('menu surface positioning lifecycle', () => {
    test('positions and focuses the first item synchronously without an animation frame', () => {
        const { frames } = setupFrames()
        render(menu())
        fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
        expect(document.activeElement).toBe(screen.getByRole('menuitem'))
        expect(screen.getByRole('menu').style.visibility).toBe('visible')
        expect(screen.getByRole('menu').style.top).not.toBe('')
        expect(frames.size).toBe(0)
    })

    test('coalesces scroll, resize and observer notifications and skips unchanged commits', () => {
        const { frames, flush } = setupFrames()
        const observers: (() => void)[] = []
        const disconnect = mock()
        const OriginalResize = window.ResizeObserver
        const viewportDescriptor = Object.getOwnPropertyDescriptor(
            window,
            'visualViewport',
        )
        const viewport = Object.assign(new EventTarget(), {
            width: 1024,
            height: 768,
            offsetLeft: 0,
            offsetTop: 0,
        })
        Object.defineProperty(window, 'visualViewport', {
            configurable: true,
            value: viewport,
        })
        class TestResizeObserver implements ResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                observers.push(() => callback([], this))
            }
            observe = mock()
            unobserve = mock()
            disconnect = disconnect
        }
        Object.defineProperty(window, 'ResizeObserver', {
            configurable: true,
            value: TestResizeObserver,
        })
        try {
            const commits = mock()
            const view = render(
                <Profiler id="menu" onRender={commits}>
                    {menu()}
                </Profiler>,
            )
            const anchor = screen.getByRole('button')
            const rectangle = spyOn(anchor, 'getBoundingClientRect')
            fireEvent.click(anchor)
            commits.mockClear()
            rectangle.mockClear()
            act(() => {
                fireEvent.scroll(document)
                fireEvent.resize(window)
                viewport.dispatchEvent(new Event('scroll'))
                viewport.dispatchEvent(new Event('resize'))
                observers.forEach((callback) => callback())
            })
            expect(frames.size).toBe(1)
            expect(rectangle).not.toHaveBeenCalled()
            flush()
            expect(rectangle).toHaveBeenCalledTimes(1)
            expect(commits).not.toHaveBeenCalled()

            rectangle.mockReturnValue(new DOMRect(100, 100, 50, 20))
            fireEvent.resize(window)
            flush()
            expect(screen.getByRole('menu').style.left).toBe('100px')
            expect(screen.getByRole('menu').style.top).toBe('126px')
            expect(commits).toHaveBeenCalledTimes(1)
            fireEvent.resize(window)
            expect(frames.size).toBe(1)
            view.unmount()
            expect(frames.size).toBe(0)
            expect(disconnect).toHaveBeenCalled()
            act(() => {
                fireEvent.scroll(document)
                fireEvent.resize(window)
                viewport.dispatchEvent(new Event('scroll'))
                viewport.dispatchEvent(new Event('resize'))
                observers.forEach((callback) => callback())
            })
            expect(frames.size).toBe(0)
        } finally {
            if (viewportDescriptor)
                Object.defineProperty(
                    window,
                    'visualViewport',
                    viewportDescriptor,
                )
            else Reflect.deleteProperty(window, 'visualViewport')
            Object.defineProperty(window, 'ResizeObserver', {
                configurable: true,
                value: OriginalResize,
            })
        }
    })

    test('opens native popovers and closes each surface on replacement and unmount', () => {
        const showDescriptor = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            'showPopover',
        )
        const hideDescriptor = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            'hidePopover',
        )
        const show = mock()
        const hide = mock()
        Object.defineProperty(HTMLElement.prototype, 'showPopover', {
            configurable: true,
            value: show,
        })
        Object.defineProperty(HTMLElement.prototype, 'hidePopover', {
            configurable: true,
            value: hide,
        })
        const destination = document.createElement('div')
        document.body.append(destination)
        try {
            const view = render(menu())
            fireEvent.click(screen.getByRole('button'))
            const previous = screen.getByRole('menu')
            expect(previous.getAttribute('popover')).toBe('manual')
            expect(show).toHaveBeenCalledTimes(1)
            view.rerender(menu(destination))
            expect(hide).toHaveBeenCalledTimes(1)
            expect(previous.hasAttribute('popover')).toBe(false)
            expect(show).toHaveBeenCalledTimes(2)
            expect(screen.getByRole('menu').getAttribute('popover')).toBe(
                'manual',
            )
            view.unmount()
            expect(hide).toHaveBeenCalledTimes(2)
        } finally {
            destination.remove()
            if (showDescriptor)
                Object.defineProperty(
                    HTMLElement.prototype,
                    'showPopover',
                    showDescriptor,
                )
            else Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
            if (hideDescriptor)
                Object.defineProperty(
                    HTMLElement.prototype,
                    'hidePopover',
                    hideDescriptor,
                )
            else Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
        }
    })
    test('reparents an open surface and disposes its pending frame', () => {
        const { frames, cancel } = setupFrames()
        const first = document.createElement('div')
        const second = document.createElement('div')
        document.body.append(first, second)
        try {
            const view = render(menu(first))
            fireEvent.click(screen.getByRole('button'))
            const oldSurface = screen.getByRole('menu')
            fireEvent.resize(window)
            expect(frames.size).toBe(1)
            view.rerender(menu(second))
            expect(first.querySelector('[role="menu"]')).toBeNull()
            expect(second.querySelector('[role="menu"]')).toBe(
                screen.getByRole('menu'),
            )
            expect(screen.getByRole('menu')).not.toBe(oldSurface)
            expect(screen.getByRole('menu').style.visibility).toBe('visible')
            expect(frames.size).toBe(0)
            expect(cancel).toHaveBeenCalled()
        } finally {
            first.remove()
            second.remove()
        }
    })
})
