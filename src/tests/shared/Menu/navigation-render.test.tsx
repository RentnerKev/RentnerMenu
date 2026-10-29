import { afterEach, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import { Menu } from '../../../index.ts'
import type { MenuItem } from '../../../index.ts'

afterEach(cleanup)

test('closed row menus do not normalize item labels until first opened', () => {
    const labelRead = mock(() => 'Action')
    const items = Object.freeze(
        Array.from({ length: 100 }, (_, index) => ({
            id: String(index),
            get label() {
                return labelRead()
            },
        })),
    )
    render(
        <>
            {Array.from({ length: 50 }, (_, index) => (
                <Menu key={index} ariaLabel={`Row ${index}`} items={items} />
            ))}
        </>,
    )
    expect(labelRead).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Row 1', exact: true }))
    expect(labelRead).toHaveBeenCalled()
    expect(screen.getAllByRole('menuitem')).toHaveLength(100)
})

test('keyboard and pointer focus changes skip React commits and keep the current action', () => {
    const commits = mock()
    const selected = mock()
    const items = Array.from({ length: 250 }, (_, index) => ({
        id: String(index),
        label: `Item ${index}`,
        onSelect: selected,
    }))
    render(
        <Profiler id="menu" onRender={commits}>
            <Menu ariaLabel="Commands" items={items} />
        </Profiler>,
    )
    fireEvent.click(screen.getByRole('button'))
    commits.mockClear()
    for (let index = 0; index < 30; index++)
        fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Item 30')
    expect(commits).not.toHaveBeenCalled()
    fireEvent.pointerOver(
        screen.getByRole('menuitem', { name: 'Item 42', exact: true }),
        { pointerType: 'mouse', clientX: 10, clientY: 40 },
    )
    expect(document.activeElement?.textContent).toBe('Item 42')
    expect(commits).not.toHaveBeenCalled()
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(selected).toHaveBeenCalledTimes(1)
    expect(selected.mock.calls[0]?.[0].id).toBe('42')
})

test('changed readonly item arrays invalidate navigation indexes and preserve updated callbacks', () => {
    const previous = mock()
    const current = mock()
    const initial: readonly MenuItem[] = Object.freeze([
        { id: 'first', label: 'First', onSelect: previous },
        { id: 'second', label: 'Second' },
    ])
    const view = render(<Menu ariaLabel="Commands" items={initial} />)
    fireEvent.click(screen.getByRole('button'))
    const updated: readonly MenuItem[] = Object.freeze([
        { id: 'first', label: 'Renamed', onSelect: current },
        { id: 'second', label: 'Second', disabled: true },
        { id: 'third', label: 'Third' },
    ])
    view.rerender(<Menu ariaLabel="Commands" items={updated} />)
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement?.textContent).toBe('Third')
    fireEvent.keyDown(document.activeElement!, { key: 'r' })
    expect(document.activeElement?.textContent).toBe('Renamed')
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    expect(previous).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledTimes(1)
})
