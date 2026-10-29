import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, forwardRef } from 'react'
import type { ComponentPropsWithRef } from 'react'
import { Menu } from '../../../shared/Menu/Components/Menu.tsx'

afterEach(cleanup)

const items = [{ id: 'action', label: 'Action' }]
const CustomButton = forwardRef<
    HTMLButtonElement,
    ComponentPropsWithRef<'button'>
>(function CustomButton(props, ref) {
    return <button {...props} ref={ref} />
})

describe('custom menu button triggers', () => {
    test('forwards props and refs to one button and preserves custom styling', () => {
        const childRef = createRef<HTMLButtonElement>()
        const triggerRef = createRef<HTMLButtonElement>()
        render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerRef={triggerRef}
                classNames={{ trigger: 'theme-trigger' }}
                triggerProps={{
                    className: 'trigger-props',
                    style: { opacity: 0.8 },
                }}
                trigger={
                    <CustomButton
                        ref={childRef}
                        className="custom"
                        style={{ color: 'red' }}
                    >
                        Custom command
                    </CustomButton>
                }
            />,
        )
        const button = screen.getByRole('button', { name: 'Commands' })
        expect(screen.getAllByRole('button')).toHaveLength(1)
        expect(button.querySelector('button')).toBeNull()
        expect(childRef.current).toBe(button)
        expect(triggerRef.current).toBe(button)
        expect(button.className).toContain('custom theme-trigger trigger-props')
        expect(button.className).not.toContain('bg-rentner-control')
        expect(button.style.color).toBe('red')
        expect(button.style.opacity).toBe('0.8')
        expect(button.getAttribute('aria-haspopup')).toBe('menu')
        fireEvent.click(button)
        expect(button.getAttribute('aria-expanded')).toBe('true')
        expect(button.getAttribute('aria-controls')).toBe(
            screen.getByRole('menu').id,
        )
    })

    test('composes child, trigger props and menu actions in order', () => {
        const calls: string[] = []
        const childFocus = mock()
        const parentFocus = mock()
        render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                onOpenChange={() => calls.push('menu')}
                triggerProps={{
                    onClick: () => calls.push('props'),
                    onFocus: parentFocus,
                }}
                trigger={
                    <button
                        onClick={() => calls.push('child')}
                        onFocus={childFocus}
                    >
                        Custom
                    </button>
                }
            />,
        )
        const button = screen.getByRole('button')
        fireEvent.focus(button)
        expect(childFocus).toHaveBeenCalledTimes(1)
        expect(parentFocus).toHaveBeenCalledTimes(1)
        fireEvent.click(button)
        expect(calls).toEqual(['child', 'props', 'menu'])
    })

    test('child prevention skips downstream handlers and triggerProps prevention skips opening', () => {
        const onClick = mock()
        const view = render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerProps={{ onClick }}
                trigger={
                    <button onClick={(event) => event.preventDefault()}>
                        Custom
                    </button>
                }
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(onClick).not.toHaveBeenCalled()
        expect(screen.queryByRole('menu')).toBeNull()
        view.rerender(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerProps={{ onClick: (event) => event.preventDefault() }}
                trigger={<button>Custom</button>}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(screen.queryByRole('menu')).toBeNull()
    })

    test.each(['ArrowDown', 'ArrowUp', 'Enter', ' '])(
        'opens with %s and keeps keyboard composition',
        (key) => {
            const childKey = mock()
            const propsKey = mock()
            render(
                <Menu
                    asChild
                    ariaLabel="Commands"
                    items={items}
                    triggerProps={{ onKeyDown: propsKey }}
                    trigger={
                        <CustomButton onKeyDown={childKey}>Custom</CustomButton>
                    }
                />,
            )
            fireEvent.keyDown(screen.getByRole('button'), { key })
            expect(childKey).toHaveBeenCalledTimes(1)
            expect(propsKey).toHaveBeenCalledTimes(1)
            expect(screen.getByRole('menu')).toBeTruthy()
            expect(document.activeElement).toBe(screen.getByRole('menuitem'))
        },
    )

    test('child keyboard prevention retains a closed menu', () => {
        render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                trigger={
                    <button onKeyDown={(event) => event.preventDefault()}>
                        Custom
                    </button>
                }
            />,
        )
        fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' })
        expect(screen.queryByRole('menu')).toBeNull()
    })

    test.each([true, false])(
        'disabled button cannot open (menu disabled: %s)',
        (menuDisabled) => {
            render(
                <Menu
                    asChild
                    disabled={menuDisabled}
                    ariaLabel="Commands"
                    items={items}
                    trigger={<button disabled={!menuDisabled}>Custom</button>}
                />,
            )
            const button = screen.getByRole('button') as HTMLButtonElement
            expect(button.disabled).toBe(true)
            fireEvent.click(button)
            fireEvent.keyDown(button, { key: 'ArrowDown' })
            expect(screen.queryByRole('menu')).toBeNull()
        },
    )

    test('callback ref cleanup is preserved without detachments on menu rerenders', () => {
        const childCleanup = mock()
        const menuCleanup = mock()
        const childRef = mock(() => childCleanup)
        const triggerRef = mock(() => menuCleanup)
        const view = render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerRef={triggerRef}
                trigger={<CustomButton ref={childRef}>Custom</CustomButton>}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(childRef).toHaveBeenCalledTimes(1)
        expect(triggerRef).toHaveBeenCalledTimes(1)
        expect(childCleanup).not.toHaveBeenCalled()
        expect(menuCleanup).not.toHaveBeenCalled()
        view.unmount()
        expect(childCleanup).toHaveBeenCalledTimes(1)
        expect(menuCleanup).toHaveBeenCalledTimes(1)
    })

    test('object refs clear on unmount', () => {
        const childRef = createRef<HTMLButtonElement>()
        const triggerRef = createRef<HTMLButtonElement>()
        const view = render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerRef={triggerRef}
                trigger={<button ref={childRef}>Custom</button>}
            />,
        )
        view.unmount()
        expect(childRef.current).toBeNull()
        expect(triggerRef.current).toBeNull()
    })

    test('replacing refs cleans up old callbacks and attaches the current button', () => {
        const childCleanup = mock()
        const menuCleanup = mock()
        const childRef = mock(() => childCleanup)
        const triggerRef = mock(() => menuCleanup)
        const nextChildRef = createRef<HTMLButtonElement>()
        const nextTriggerRef = createRef<HTMLButtonElement>()
        const view = render(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerRef={triggerRef}
                trigger={<button ref={childRef}>Custom</button>}
            />,
        )
        const button = screen.getByRole('button')
        view.rerender(
            <Menu
                asChild
                ariaLabel="Commands"
                items={items}
                triggerRef={nextTriggerRef}
                trigger={<button ref={nextChildRef}>Custom</button>}
            />,
        )
        expect(childCleanup).toHaveBeenCalledTimes(1)
        expect(menuCleanup).toHaveBeenCalledTimes(1)
        expect(nextChildRef.current).toBe(button)
        expect(nextTriggerRef.current).toBe(button)
        fireEvent.click(button)
        expect(screen.getByRole('menu')).toBeTruthy()
    })

    test('invalid trigger content fails with a clear contract error', () => {
        expect(() =>
            render(
                <Menu
                    asChild
                    ariaLabel="Commands"
                    items={items}
                    trigger="Text"
                />,
            ),
        ).toThrow('single button element')
        expect(() =>
            render(
                <Menu
                    asChild
                    ariaLabel="Commands"
                    items={items}
                    trigger={<a href="#action">Link</a>}
                />,
            ),
        ).toThrow('single button element')
    })
})
