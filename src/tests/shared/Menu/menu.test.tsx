import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import { createRef, useState } from 'react'
import { renderToString } from 'react-dom/server'
import { ContextMenu, Menu, MenuProvider } from '../../../index.ts'
import type { MenuItem, MenuSelectEvent } from '../../../index.ts'

afterEach(cleanup)

const items: MenuItem[] = [
    { id: 'label', type: 'label', label: 'Actions' },
    { id: 'first', label: 'First' },
    { id: 'disabled', label: 'Unavailable', disabled: true },
    { id: 'last', label: 'Last' },
    {
        id: 'more',
        label: 'More',
        type: 'submenu',
        items: [{ id: 'child', label: 'Child' }],
    },
]

function key(pressedKey: string, options = {}) {
    fireEvent.keyDown(document.activeElement ?? document.body, {
        key: pressedKey,
        ...options,
    })
}

function ControlledContextExample() {
    const [open, setOpen] = useState(false)
    return (
        <ContextMenu
            ariaLabel="Context"
            items={items}
            open={open}
            onOpenChange={setOpen}
        >
            Target
        </ContextMenu>
    )
}

describe('native menu interactions', () => {
    test('empty-string item and submenu IDs remain keyboard actionable', () => {
        const action = mock()
        const view = render(
            <Menu
                ariaLabel="Commands"
                items={[{ id: '', label: 'Empty ID' }]}
                onAction={action}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        key('Enter')
        expect(action).toHaveBeenCalledWith('', expect.anything())
        view.rerender(
            <Menu
                ariaLabel="Commands"
                items={[
                    {
                        id: '',
                        label: 'Empty submenu ID',
                        type: 'submenu',
                        items: [{ id: 'child', label: 'Child' }],
                    },
                ]}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        key('ArrowRight')
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'Child' }),
        )
        expect(screen.getAllByRole('menu')).toHaveLength(2)
    })
    test('opens from keyboard, skips disabled items, supports bounds and restores focus', async () => {
        render(<Menu ariaLabel="Commands" items={items} loop={false} />)
        const trigger = screen.getByRole('button', { name: 'Commands' })
        trigger.focus()
        key('ArrowUp')
        await waitFor(() =>
            expect(document.activeElement?.textContent).toContain('More'),
        )
        key('Home')
        expect(document.activeElement?.textContent).toBe('First')
        key('ArrowDown')
        expect(document.activeElement?.textContent).toBe('Last')
        key('Escape')
        expect(screen.queryByRole('menu')).toBeNull()
        expect(document.activeElement).toBe(trigger)
    })
    test('typeahead and RTL submenu arrows use the current level', async () => {
        render(<Menu ariaLabel="Commands" items={items} dir="rtl" />)
        fireEvent.click(screen.getByRole('button'))
        key('m')
        key('ArrowLeft')
        await waitFor(() =>
            expect(document.activeElement?.textContent).toBe('Child'),
        )
        expect(screen.getAllByRole('menu')).toHaveLength(2)
        key('ArrowRight')
        expect(document.activeElement?.textContent).toContain('More')
        expect(screen.getAllByRole('menu')).toHaveLength(1)
    })
    test('preventDefault in item or common selection retains the menu', () => {
        const action = mock((_id: string, event: MenuSelectEvent) =>
            event.preventDefault(),
        )
        const select = mock((event: MenuSelectEvent) => event.preventDefault())
        render(
            <Menu
                ariaLabel="Commands"
                items={[{ id: 'keep', label: 'Keep', onSelect: select }]}
                onAction={action}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        key('Enter')
        expect(select).toHaveBeenCalledTimes(1)
        expect(action).toHaveBeenCalledWith(
            'keep',
            expect.objectContaining({ defaultPrevented: true }),
        )
        expect(screen.getByRole('menu')).toBeTruthy()
    })
    test('checkbox/radio callbacks preserve controlled state', () => {
        const check = mock()
        const radio = mock()
        render(
            <Menu
                ariaLabel="Options"
                items={[
                    {
                        id: 'checked',
                        type: 'checkbox',
                        label: 'Checked',
                        checked: true,
                        onCheckedChange: check,
                        closeOnSelect: false,
                    },
                    {
                        id: 'radio',
                        type: 'radio',
                        name: 'mode',
                        label: 'Mode',
                        checked: false,
                        onCheckedChange: radio,
                        closeOnSelect: false,
                    },
                ]}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        fireEvent.click(screen.getByRole('menuitemcheckbox'))
        expect(check).toHaveBeenCalledWith(false)
        expect(
            screen.getByRole('menuitemcheckbox').getAttribute('aria-checked'),
        ).toBe('true')
        fireEvent.click(screen.getByRole('menuitemradio'))
        expect(radio).toHaveBeenCalledTimes(1)
    })
    test('controlled open only changes when the consumer accepts the request', () => {
        const change = mock()
        const view = render(
            <Menu
                ariaLabel="Commands"
                items={items}
                open={false}
                onOpenChange={change}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(change).toHaveBeenCalledWith(true)
        expect(screen.queryByRole('menu')).toBeNull()
        view.rerender(
            <Menu
                ariaLabel="Commands"
                items={items}
                open
                onOpenChange={change}
            />,
        )
        expect(screen.getByRole('menu')).toBeTruthy()
    })
    test('controlled external close and reopen restores first-item focus and Escape handling', () => {
        const change = mock()
        const view = render(
            <Menu
                ariaLabel="Commands"
                items={items}
                open
                onOpenChange={change}
            />,
        )
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'First' }),
        )
        key('ArrowDown')
        view.rerender(
            <Menu
                ariaLabel="Commands"
                items={items}
                open={false}
                onOpenChange={change}
            />,
        )
        view.rerender(
            <Menu
                ariaLabel="Commands"
                items={items}
                open
                onOpenChange={change}
            />,
        )
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'First' }),
        )
        key('Escape')
        expect(change).toHaveBeenLastCalledWith(false)
    })
    test('composes prevented trigger handlers and forwards the native ref', () => {
        const ref = createRef<HTMLButtonElement>()
        render(
            <Menu
                ariaLabel="Commands"
                items={items}
                triggerRef={ref}
                triggerProps={{ onClick: (event) => event.preventDefault() }}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(screen.queryByRole('menu')).toBeNull()
        expect(ref.current).toBe(screen.getByRole('button'))
    })
    test('runs React 19 callback ref cleanup rather than calling it again with null', () => {
        const releases: string[] = []
        const callback = mock((node: HTMLButtonElement | null) => {
            expect(node).not.toBeNull()
            return () => {
                releases.push('released')
            }
        })
        const view = render(
            <Menu ariaLabel="Commands" items={items} triggerRef={callback} />,
        )
        const beforeUnmount = releases.length
        view.unmount()
        expect(releases.length).toBe(beforeUnmount + 1)
        expect(callback.mock.calls.every(([node]) => node !== null)).toBe(true)
    })
    test('disabled selection never emits an action and keyboard handler cancellation prevents opening', () => {
        const action = mock()
        const view = render(
            <Menu ariaLabel="Commands" items={items} onAction={action} />,
        )
        fireEvent.click(screen.getByRole('button'))
        fireEvent.click(screen.getByRole('menuitem', { name: 'Unavailable' }))
        expect(action).not.toHaveBeenCalled()
        view.unmount()
        render(
            <Menu
                ariaLabel="Commands"
                items={items}
                triggerProps={{ onKeyDown: (event) => event.preventDefault() }}
            />,
        )
        fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
        expect(screen.queryByRole('menu')).toBeNull()
    })
    test('outside pointer and Tab dismiss without stealing destination focus', () => {
        render(
            <>
                <Menu ariaLabel="Commands" items={items} />
                <button type="button">After</button>
            </>,
        )
        fireEvent.click(screen.getByRole('button', { name: 'Commands' }))
        fireEvent.pointerDown(screen.getByRole('button', { name: 'After' }))
        expect(screen.queryByRole('menu')).toBeNull()
        fireEvent.click(screen.getByRole('button', { name: 'Commands' }))
        key('Tab')
        expect(screen.queryByRole('menu')).toBeNull()
    })
    test('repairs active focus when an item becomes disabled', () => {
        const view = render(<Menu ariaLabel="Commands" items={items} />)
        fireEvent.click(screen.getByRole('button'))
        view.rerender(
            <Menu
                ariaLabel="Commands"
                items={items.map((item) =>
                    item.id === 'first' ? { ...item, disabled: true } : item,
                )}
            />,
        )
        expect(document.activeElement?.textContent).toBe('Last')
    })
    test('nested providers merge slots and direct component settings win', () => {
        render(
            <MenuProvider
                dir="rtl"
                classNames={{ content: 'outer-content', item: 'outer-item' }}
            >
                <MenuProvider classNames={{ content: 'inner-content' }}>
                    <Menu ariaLabel="Commands" items={items} dir="ltr" />
                </MenuProvider>
            </MenuProvider>,
        )
        fireEvent.click(screen.getByRole('button'))
        const menu = screen.getByRole('menu')
        expect(menu.className).toContain('inner-content')
        expect(menu.getAttribute('dir')).toBe('ltr')
        expect(
            screen.getByRole('menuitem', { name: 'First' }).className,
        ).toContain('outer-item')
    })
    test('empty menus remain keyboard dismissible and SSR excludes portals', () => {
        expect(
            renderToString(<Menu ariaLabel="SSR" items={items} defaultOpen />),
        ).toContain('aria-expanded="true"')
        render(<Menu ariaLabel="Empty" items={[]} />)
        fireEvent.click(screen.getByRole('button'))
        expect(document.activeElement).toBe(screen.getByRole('menu'))
        key('Escape')
        expect(screen.queryByRole('menu')).toBeNull()
    })
    test('custom portal container receives the menu and unmount removes it', () => {
        const container = document.createElement('div')
        document.body.append(container)
        const view = render(
            <Menu
                ariaLabel="Commands"
                items={items}
                portalContainer={container}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(container.querySelector('[role="menu"]')).toBeTruthy()
        view.unmount()
        expect(container.childElementCount).toBe(0)
        container.remove()
    })
    test('escape cancellation is respected', () => {
        render(
            <Menu
                ariaLabel="Commands"
                items={items}
                onEscapeKeyDown={(event) => event.preventDefault()}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        key('Escape')
        expect(screen.getByRole('menu')).toBeTruthy()
    })
})

describe('context menus', () => {
    test('Tab restores the originating descendant before native navigation continues', () => {
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                <button type="button">First child</button>
                <button type="button">Origin</button>
            </ContextMenu>,
        )
        const origin = screen.getByRole('button', { name: 'Origin' })
        origin.focus()
        key('F10', { shiftKey: true })
        key('Tab')
        expect(document.activeElement).toBe(origin)
        expect(screen.queryByRole('menu')).toBeNull()
    })
    test('retargeting an already open context menu closes old submenus', () => {
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                Target
            </ContextMenu>,
        )
        const target = screen.getByRole('group')
        fireEvent.contextMenu(target)
        key('End')
        key('ArrowRight')
        expect(screen.getAllByRole('menu')).toHaveLength(2)
        fireEvent.contextMenu(target, { clientX: 140, clientY: 180 })
        expect(screen.getAllByRole('menu')).toHaveLength(1)
        expect(document.activeElement).toBe(
            screen.getByRole('menuitem', { name: 'First' }),
        )
    })
    test('a stationary touch press opens, movement cancels and unmount clears the pending timer', async () => {
        const changed = mock()
        const view = render(
            <ContextMenu
                ariaLabel="Context"
                items={items}
                longPress
                onOpenChange={changed}
            >
                Target
            </ContextMenu>,
        )
        const target = screen.getByRole('group', { name: 'Context' })
        fireEvent.pointerDown(target, {
            pointerType: 'touch',
            isPrimary: true,
            clientX: 50,
            clientY: 70,
        })
        fireEvent.pointerMove(target, {
            pointerType: 'touch',
            isPrimary: true,
            clientX: 80,
            clientY: 90,
        })
        await new Promise((resolve) => setTimeout(resolve, 580))
        expect(screen.queryByRole('menu')).toBeNull()
        fireEvent.pointerDown(target, {
            pointerType: 'touch',
            isPrimary: true,
            clientX: 50,
            clientY: 70,
        })
        await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy(), {
            timeout: 900,
        })
        key('Escape')
        changed.mockClear()
        fireEvent.pointerDown(target, {
            pointerType: 'touch',
            isPrimary: true,
            clientX: 50,
            clientY: 70,
        })
        view.unmount()
        await new Promise((resolve) => setTimeout(resolve, 580))
        expect(changed).not.toHaveBeenCalled()
    })
    test('supports native contextmenu and Shift+F10 while restoring origin focus', () => {
        render(
            <ContextMenu ariaLabel="Context" items={items}>
                <span>Target</span>
            </ContextMenu>,
        )
        const target = screen.getByText('Target').parentElement!
        target.focus()
        fireEvent.contextMenu(target, { clientX: 50, clientY: 70 })
        expect(screen.getByRole('menu')).toBeTruthy()
        key('Escape')
        expect(document.activeElement).toBe(target)
        key('F10', { shiftKey: true })
        expect(screen.getByRole('menu')).toBeTruthy()
    })
    test('controlled toggle consumers receive each close request', () => {
        render(<ControlledContextExample />)
        fireEvent.contextMenu(screen.getByText('Target'))
        key('Escape')
        expect(screen.queryByRole('menu')).toBeNull()
    })
    test('respects target preventDefault and disabled context menus', () => {
        render(
            <ContextMenu
                ariaLabel="Context"
                items={items}
                targetProps={{
                    onContextMenu: (event) => event.preventDefault(),
                }}
            >
                Target
            </ContextMenu>,
        )
        fireEvent.contextMenu(screen.getByText('Target'))
        expect(screen.queryByRole('menu')).toBeNull()
    })
})
