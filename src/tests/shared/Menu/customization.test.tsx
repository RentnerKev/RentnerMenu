import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ContextMenu, Menu, MenuProvider } from '../../../index.ts'

const dimensions = new Map<string, PropertyDescriptor | undefined>()

afterEach(() => {
    cleanup()
    mock.restore()
    for (const [property, descriptor] of dimensions) {
        if (descriptor)
            Object.defineProperty(HTMLElement.prototype, property, descriptor)
        else Reflect.deleteProperty(HTMLElement.prototype, property)
    }
    dimensions.clear()
})

const items = [{ id: 'copy', label: 'Copy' }]

function measure() {
    for (const [property, value] of [
        ['offsetWidth', 120],
        ['offsetHeight', 80],
    ] as const) {
        dimensions.set(
            property,
            Object.getOwnPropertyDescriptor(HTMLElement.prototype, property),
        )
        Object.defineProperty(HTMLElement.prototype, property, {
            configurable: true,
            get: () => value,
        })
    }
}

function openContext() {
    fireEvent.contextMenu(screen.getByRole('group', { name: 'Context' }), {
        clientX: 300,
        clientY: 200,
    })
    return screen.getByRole('menu')
}

describe('context dismissal', () => {
    test('same-target pointer dismisses without canceling native activation', () => {
        const clicked = mock()
        const changed = mock()
        render(
            <ContextMenu
                ariaLabel="Context"
                items={items}
                onOpenChange={changed}
            >
                <button type="button" onClick={clicked}>
                    Target action
                </button>
            </ContextMenu>,
        )
        openContext()
        const button = screen.getByRole('button', { name: 'Target action' })
        expect(fireEvent.pointerDown(button)).toBe(true)
        expect(screen.queryAllByRole('menu').length).toBe(0)
        act(() => button.focus())
        expect(fireEvent.click(button)).toBe(true)
        expect(clicked).toHaveBeenCalledTimes(1)
        expect(document.activeElement).toBe(button)
        expect(changed.mock.calls).toEqual([[true], [false]])
    })

    test('focus can move into the target without restoring its wrapper', () => {
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                <button type="button">Target action</button>
            </ContextMenu>,
        )
        openContext()
        const button = screen.getByRole('button')
        act(() => button.focus())
        expect(screen.queryAllByRole('menu').length).toBe(0)
        expect(document.activeElement).toBe(button)
    })

    test('controlled owners retain authority over same-target dismissal', () => {
        const changed = mock()
        render(
            <ContextMenu
                ariaLabel="Context"
                items={items}
                open
                onOpenChange={changed}
            >
                Target
            </ContextMenu>,
        )
        fireEvent.pointerDown(screen.getByRole('group'))
        expect(changed).toHaveBeenCalledWith(false)
        expect(screen.getByRole('menu')).toBeTruthy()
    })

    test('embedded dropdown opens on the dismissing click and still toggles closed', () => {
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                <Menu ariaLabel="Dropdown" items={items} />
            </ContextMenu>,
        )
        openContext()
        const trigger = screen.getByRole('button', { name: 'Dropdown' })
        fireEvent.pointerDown(trigger)
        fireEvent.click(trigger)
        expect(screen.getAllByRole('menu')).toHaveLength(1)
        expect(screen.getByRole('menu', { name: 'Dropdown' })).toBeTruthy()
        fireEvent.pointerDown(trigger)
        fireEvent.click(trigger)
        expect(screen.queryAllByRole('menu').length).toBe(0)
    })
})

describe('menu positioning defaults', () => {
    test('pointer defaults open beside the click while keyboard uses the target rectangle', () => {
        measure()
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                Target
            </ContextMenu>,
        )
        const target = screen.getByRole('group')
        spyOn(target, 'getBoundingClientRect').mockReturnValue(
            new DOMRect(100, 100, 150, 40),
        )
        const menu = openContext()
        expect(menu.style.left).toBe('306px')
        expect(menu.style.top).toBe('200px')
        fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
        fireEvent.keyDown(target, { key: 'F10', shiftKey: true })
        expect(screen.getByRole('menu').style.left).toBe('100px')
        expect(screen.getByRole('menu').style.top).toBe('146px')
    })

    test('RTL pointer defaults open to the left of the click', () => {
        measure()
        render(
            <ContextMenu ariaLabel="Context" dir="rtl" items={items}>
                Target
            </ContextMenu>,
        )
        const menu = openContext()
        expect(menu.style.left).toBe('174px')
        expect(menu.style.top).toBe('200px')
    })

    test('shared provider alignment keeps its existing context inheritance', () => {
        measure()
        render(
            <MenuProvider align="end" sideOffset={10}>
                <ContextMenu ariaLabel="Context" items={items}>
                    Target
                </ContextMenu>
            </MenuProvider>,
        )
        const menu = openContext()
        expect(menu.style.left).toBe('310px')
        expect(menu.style.top).toBe('120px')
    })

    test('type defaults merge through nested providers and local props win per field', () => {
        measure()
        const view = render(
            <MenuProvider
                align="end"
                contextMenu={{ align: 'start', sideOffset: 12 }}
            >
                <MenuProvider contextMenu={{ side: 'left' }}>
                    <ContextMenu ariaLabel="Context" items={items}>
                        Target
                    </ContextMenu>
                </MenuProvider>
            </MenuProvider>,
        )
        const menu = openContext()
        expect(menu.style.left).toBe('168px')
        expect(menu.style.top).toBe('200px')
        view.rerender(
            <MenuProvider
                align="end"
                contextMenu={{ align: 'start', sideOffset: 12 }}
            >
                <MenuProvider contextMenu={{ side: 'left' }}>
                    <ContextMenu
                        ariaLabel="Context"
                        items={items}
                        side="bottom"
                        align="end"
                        sideOffset={4}
                    >
                        Target
                    </ContextMenu>
                </MenuProvider>
            </MenuProvider>,
        )
        expect(menu.style.left).toBe('180px')
        expect(menu.style.top).toBe('204px')
    })

    test('dropdown defaults remain separate from context defaults', () => {
        measure()
        render(
            <MenuProvider
                sideOffset={6}
                menu={{ align: 'end', sideOffset: 9 }}
                contextMenu={{ side: 'left', sideOffset: 20 }}
            >
                <Menu ariaLabel="Dropdown" items={items} />
            </MenuProvider>,
        )
        const trigger = screen.getByRole('button')
        spyOn(trigger, 'getBoundingClientRect').mockReturnValue(
            new DOMRect(100, 100, 150, 40),
        )
        fireEvent.click(trigger)
        expect(screen.getByRole('menu').style.left).toBe('130px')
        expect(screen.getByRole('menu').style.top).toBe('149px')
    })
})
