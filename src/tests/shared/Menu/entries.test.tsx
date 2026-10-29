import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MenuEntry } from '../../../shared/Menu/Components/MenuEntry.tsx'
import { Menu } from '../../../shared/Menu/Components/Menu.tsx'
import type { MenuEntryProps } from '../../../shared/Menu/Types/menu.entry.ts'
import type { MenuItem } from '../../../shared/Menu/Types/menu.types.ts'

afterEach(cleanup)

function entryProps(item: MenuItem): MenuEntryProps {
    return {
        item,
        menuId: 'entries',
        level: 0,
        dir: 'ltr',
        expanded: false,
        classNames: undefined,
        setItemNode: mock(),
        handleItemEnter: mock(),
        handleItemFocus: mock(),
        handleItemLeave: mock(),
        handleSelect: mock(),
    }
}

function CountedIcon({ onRender }: { onRender: () => void }) {
    onRender()
    return <span>Icon</span>
}

describe('native menu entries', () => {
    test('links retain native destination, new-tab, rel and download attributes', () => {
        const props = entryProps({
            id: 'link',
            type: 'link',
            label: 'Download',
            href: '/manual.pdf',
            target: '_blank',
            rel: 'noopener noreferrer',
            download: 'manual.pdf',
            description: 'A manual',
        })
        render(<MenuEntry {...props} />)
        const link = screen.getByRole('menuitem', { name: 'Download' })
        expect(link.tagName).toBe('A')
        expect(link.getAttribute('href')).toBe('/manual.pdf')
        expect(link.getAttribute('target')).toBe('_blank')
        expect(link.getAttribute('rel')).toBe('noopener noreferrer')
        expect(link.getAttribute('download')).toBe('manual.pdf')
        expect(link.getAttribute('aria-describedby')).toBe(
            'entries-description-0-link',
        )
    })

    test.each(['ctrlKey', 'metaKey', 'shiftKey', 'altKey'] as const)(
        'preserves the native %s activation event',
        (modifier) => {
            const selected = mock(
                (_level: number, _id: string, _event: Event) => {},
            )
            const props = entryProps({
                id: 'link',
                type: 'link',
                label: 'Visit',
                href: '#destination',
            })
            render(<MenuEntry {...props} handleSelect={selected} />)
            expect(
                fireEvent.click(screen.getByRole('menuitem'), {
                    [modifier]: true,
                }),
            ).toBe(true)
            expect(selected).toHaveBeenCalledTimes(1)
            const event = selected.mock.calls[0]![2] as MouseEvent
            expect(event[modifier]).toBe(true)
            expect(event.defaultPrevented).toBe(false)
        },
    )

    test('middle click selects once without canceling native behavior; right click does not select', () => {
        const props = entryProps({
            id: 'link',
            type: 'link',
            label: 'Visit',
            href: '#destination',
        })
        render(<MenuEntry {...props} />)
        const link = screen.getByRole('menuitem')
        expect(
            fireEvent(
                link,
                new MouseEvent('auxclick', {
                    bubbles: true,
                    cancelable: true,
                    button: 1,
                }),
            ),
        ).toBe(true)
        expect(props.handleSelect).toHaveBeenCalledTimes(1)
        fireEvent(
            link,
            new MouseEvent('auxclick', {
                bubbles: true,
                cancelable: true,
                button: 2,
            }),
        )
        expect(props.handleSelect).toHaveBeenCalledTimes(1)
    })

    test('disabled links omit href and cancel pointer, primary and auxiliary activation', () => {
        const props = entryProps({
            id: 'link',
            type: 'link',
            label: 'Unavailable',
            href: '#destination',
            disabled: true,
        })
        render(<MenuEntry {...props} />)
        const link = screen.getByRole('menuitem')
        expect(link.getAttribute('href')).toBeNull()
        expect(link.getAttribute('aria-disabled')).toBe('true')
        expect(fireEvent.pointerDown(link)).toBe(false)
        expect(fireEvent.click(link)).toBe(false)
        expect(
            fireEvent(
                link,
                new MouseEvent('auxclick', {
                    bubbles: true,
                    cancelable: true,
                    button: 1,
                }),
            ),
        ).toBe(false)
        fireEvent.pointerEnter(link, { pointerType: 'mouse' })
        fireEvent.focus(link)
        expect(props.handleSelect).not.toHaveBeenCalled()
        expect(props.handleItemEnter).not.toHaveBeenCalled()
        expect(props.handleItemFocus).not.toHaveBeenCalled()
    })

    test('selection prevention cancels the original link event and keeps the menu open', () => {
        const selected = mock((event: { preventDefault: () => void }) =>
            event.preventDefault(),
        )
        render(
            <Menu
                ariaLabel="Links"
                items={[
                    {
                        id: 'link',
                        type: 'link',
                        label: 'Stay',
                        href: '#destination',
                        onSelect: selected,
                    },
                ]}
            />,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(fireEvent.click(screen.getByRole('menuitem'))).toBe(false)
        expect(selected).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('menu')).toBeTruthy()
    })

    test('an already prevented DOM event does not select or navigate', () => {
        const props = entryProps({
            id: 'link',
            type: 'link',
            label: 'Stay',
            href: '#destination',
        })
        render(<MenuEntry {...props} />)
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
        })
        event.preventDefault()
        expect(fireEvent(screen.getByRole('menuitem'), event)).toBe(false)
        expect(props.handleSelect).not.toHaveBeenCalled()
    })

    test('indeterminate checkbox exposes mixed state and a dash, true exposes a check', () => {
        const props = entryProps({
            id: 'mixed',
            type: 'checkbox',
            label: 'Mixed',
            checked: 'indeterminate',
            onCheckedChange: mock(),
        })
        const view = render(<MenuEntry {...props} />)
        const checkbox = screen.getByRole('menuitemcheckbox')
        expect(checkbox.getAttribute('aria-checked')).toBe('mixed')
        expect(
            checkbox
                .querySelector('[data-rentner-menu-indicator] path')
                ?.getAttribute('d'),
        ).toBe('M4 8h8')
        view.rerender(
            <MenuEntry
                {...props}
                item={{
                    id: 'mixed',
                    type: 'checkbox',
                    label: 'Mixed',
                    checked: true,
                    onCheckedChange: mock(),
                }}
            />,
        )
        expect(checkbox.getAttribute('aria-checked')).toBe('true')
        expect(
            checkbox
                .querySelector('[data-rentner-menu-indicator] path')
                ?.getAttribute('d'),
        ).toBe('m3.5 8 3 3 6-6')
    })

    test('memoized leaves skip unchanged render work and preserve node ref identity', () => {
        const onRender = mock()
        const props = entryProps({
            id: 'stable',
            label: 'Stable',
            icon: <CountedIcon onRender={onRender} />,
        })
        const view = render(<MenuEntry {...props} />)
        const button = screen.getByRole('menuitem')
        view.rerender(<MenuEntry {...props} />)
        expect(onRender).toHaveBeenCalledTimes(1)
        expect(props.setItemNode).toHaveBeenCalledTimes(1)
        expect(props.setItemNode).toHaveBeenCalledWith(0, 'stable', button)
        view.rerender(<MenuEntry {...props} expanded />)
        expect(props.setItemNode).toHaveBeenCalledTimes(1)
        view.unmount()
        expect(props.setItemNode).toHaveBeenLastCalledWith(0, 'stable', null)
    })
})
