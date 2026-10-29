import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import { Menu } from '../../../shared/Menu/Components/Menu.tsx'

afterEach(cleanup)

const items = [
    { id: 'edit', label: 'Edit' },
    { id: 'delete', label: 'Delete', danger: true },
]
const pause = (ms: number) =>
    act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
const enter = (node: HTMLElement, pointerType = 'mouse') =>
    fireEvent.pointerEnter(node, { pointerType })
const leave = (node: HTMLElement, pointerType = 'mouse') =>
    fireEvent.pointerLeave(node, { pointerType })

function Controlled() {
    const [open, setOpen] = useState(false)
    return (
        <Menu
            ariaLabel="Actions"
            items={items}
            open={open}
            onOpenChange={setOpen}
            openOnHover
            hoverOpenDelayMs={0}
            hoverCloseDelayMs={10}
        />
    )
}

describe('opt-in mouse hover opening', () => {
    test('keeps click-only behavior by default', () => {
        render(<Menu ariaLabel="Actions" items={items} />)
        enter(screen.getByRole('button'))
        expect(screen.queryByRole('menu') === null).toBeTrue()
        fireEvent.click(screen.getByRole('button'))
        expect(screen.getByRole('menu') !== null).toBeTrue()
    })

    test('opens and closes without stealing an unrelated input focus', async () => {
        render(
            <>
                <input aria-label="Search" />
                <Menu
                    ariaLabel="Actions"
                    items={items}
                    openOnHover
                    hoverOpenDelayMs={0}
                    hoverCloseDelayMs={10}
                />
            </>,
        )
        const search = screen.getByRole('textbox')
        search.focus()
        enter(screen.getByRole('button'))
        expect(screen.getByRole('menu') !== null).toBeTrue()
        expect(document.activeElement === search).toBeTrue()
        leave(screen.getByRole('button'))
        await waitFor(() =>
            expect(screen.queryByRole('menu') === null).toBeTrue(),
        )
        expect(document.activeElement === search).toBeTrue()
    })

    test('supports a controlled open state with the same focus behavior', async () => {
        render(
            <>
                <input aria-label="Search" />
                <Controlled />
            </>,
        )
        const search = screen.getByRole('textbox')
        search.focus()
        enter(screen.getByRole('button'))
        expect(screen.getByRole('menu') !== null).toBeTrue()
        expect(document.activeElement === search).toBeTrue()
        leave(screen.getByRole('button'))
        await waitFor(() =>
            expect(screen.queryByRole('menu') === null).toBeTrue(),
        )
        expect(document.activeElement === search).toBeTrue()
    })

    test('keeps the menu open across the trigger gap and closes after leaving its surface', async () => {
        render(
            <Menu
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
                hoverCloseDelayMs={40}
            />,
        )
        const trigger = screen.getByRole('button')
        enter(trigger)
        const menu = screen.getByRole('menu')
        leave(trigger)
        await pause(10)
        enter(menu)
        await pause(70)
        expect(screen.getByRole('menu') === menu).toBeTrue()
        leave(menu)
        await waitFor(() =>
            expect(screen.queryByRole('menu') === null).toBeTrue(),
        )
    })

    test.each(['touch', 'pen'])(
        'ignores %s hover and compatibility mouse events while retaining click activation',
        (pointerType) => {
            render(
                <Menu
                    ariaLabel="Actions"
                    items={items}
                    openOnHover
                    hoverOpenDelayMs={0}
                />,
            )
            const trigger = screen.getByRole('button')
            enter(trigger, pointerType)
            fireEvent.mouseEnter(trigger)
            expect(screen.queryByRole('menu') === null).toBeTrue()
            fireEvent.click(trigger)
            expect(
                document.activeElement ===
                    screen.getByRole('menuitem', { name: 'Edit' }),
            ).toBeTrue()
        },
    )

    test('keyboard opening takes over a hover session and cancels delayed closing', async () => {
        render(
            <Menu
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
                hoverCloseDelayMs={10}
            />,
        )
        const trigger = screen.getByRole('button')
        enter(trigger)
        leave(trigger)
        fireEvent.keyDown(trigger, { key: 'ArrowUp' })
        const last = screen.getByRole('menuitem', { name: 'Delete' })
        expect(document.activeElement === last).toBeTrue()
        await pause(30)
        expect(screen.getByRole('menu') !== null).toBeTrue()
        fireEvent.keyDown(last, { key: 'Escape' })
        expect(screen.queryByRole('menu') === null).toBeTrue()
        expect(document.activeElement === trigger).toBeTrue()
    })

    test('selecting an action runs it once and restores trigger focus', () => {
        const action = mock()
        render(
            <Menu
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
                onAction={action}
            />,
        )
        const trigger = screen.getByRole('button')
        enter(trigger)
        fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
        expect(action).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('menu') === null).toBeTrue()
        expect(document.activeElement === trigger).toBeTrue()
    })

    test('cancels a delayed opening when the pointer leaves or the component unmounts', async () => {
        const changed = mock()
        const view = render(
            <Menu
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={40}
                onOpenChange={changed}
            />,
        )
        const trigger = screen.getByRole('button')
        enter(trigger)
        expect(screen.queryByRole('menu') === null).toBeTrue()
        leave(trigger)
        await pause(60)
        expect(changed).not.toHaveBeenCalled()
        enter(trigger)
        view.unmount()
        await pause(60)
        expect(changed).not.toHaveBeenCalled()
    })

    test('supports custom trigger handlers and respects preventDefault', () => {
        const childEnter = mock((event: { preventDefault: () => void }) =>
            event.preventDefault(),
        )
        const parentEnter = mock()
        render(
            <Menu
                asChild
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
                triggerProps={{ onPointerEnter: parentEnter }}
                trigger={<button onPointerEnter={childEnter}>Actions</button>}
            />,
        )
        enter(screen.getByRole('button'))
        expect(childEnter).toHaveBeenCalledTimes(1)
        expect(parentEnter).not.toHaveBeenCalled()
        expect(screen.queryByRole('menu') === null).toBeTrue()
    })

    test('never opens a disabled custom button or a modal menu on hover', () => {
        const view = render(
            <Menu
                asChild
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
                trigger={<button disabled>Actions</button>}
            />,
        )
        enter(screen.getByRole('button'))
        expect(screen.queryByRole('menu') === null).toBeTrue()
        view.rerender(
            <Menu
                modal
                ariaLabel="Actions"
                items={items}
                openOnHover
                hoverOpenDelayMs={0}
            />,
        )
        enter(screen.getByRole('button'))
        expect(screen.queryByRole('menu') === null).toBeTrue()
        fireEvent.click(screen.getByRole('button'))
        expect(screen.getByRole('menu') !== null).toBeTrue()
    })
})
